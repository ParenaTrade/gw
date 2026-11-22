import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { authOtps } from "@/db/schema";
import { hashWithPepper, randomDigits, safeEqual } from "@/lib/security/hash";
import { ApiError } from "@/lib/security/api";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * SMS sağlayıcısı tanımlı değilse OTP demo modunda çalışır ve kod yanıtta
 * döner (UI açıkça "Demo modu" etiketi gösterir). Production'da SMS_API_KEY
 * tanımlanmalı ve OTP_DEV_MODE=false yapılmalıdır.
 */
export function isOtpDemoMode(): boolean {
  return !process.env.SMS_API_KEY?.trim() && process.env.OTP_DEV_MODE !== "false";
}

export async function requestOtp(phone: string, fullName?: string) {
  // Bellek içi rate limit'e ek olarak DB sayacı (çoklu instance'a dayanıklı).
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authOtps)
    .where(
      and(
        eq(authOtps.phone, phone),
        gt(authOtps.createdAt, new Date(Date.now() - SEND_WINDOW_MS).toISOString())
      )
    );
  if (count >= MAX_SENDS_PER_WINDOW) {
    throw new ApiError(
      429,
      "OTP_RATE_LIMITED",
      "Bu numaraya çok fazla kod gönderildi. Lütfen 10 dakika sonra tekrar deneyin."
    );
  }

  const code = randomDigits(6);
  await db.insert(authOtps).values({
    phone,
    codeHash: hashWithPepper(`${code}:${phone}`),
    pendingFullName: fullName ?? null,
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });

  return { sent: true as const, demo: isOtpDemoMode(), devCode: isOtpDemoMode() ? code : undefined };
}

export async function verifyOtpCode(phone: string, code: string) {
  const [otp] = await db
    .select()
    .from(authOtps)
    .where(
      and(
        eq(authOtps.phone, phone),
        isNull(authOtps.consumedAt),
        gt(authOtps.expiresAt, new Date().toISOString())
      )
    )
    .orderBy(desc(authOtps.createdAt))
    .limit(1);

  if (!otp) {
    throw new ApiError(400, "OTP_INVALID", "Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.");
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new ApiError(429, "OTP_ATTEMPTS", "Çok fazla hatalı deneme. Yeni kod isteyin.");
  }

  await db
    .update(authOtps)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(authOtps.id, otp.id));

  if (!safeEqual(hashWithPepper(`${code}:${phone}`), otp.codeHash)) {
    throw new ApiError(400, "OTP_INVALID", "Kod hatalı. Lütfen kontrol edip tekrar deneyin.");
  }

  await db
    .update(authOtps)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(authOtps.id, otp.id));

  return otp;
}
