import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { COUPON_STATUSES } from "@/lib/coupons/status";

/** Tüm API girişleri Zod ile doğrulanır — client verisine güvenilmez. */

export const phoneSchema = z
  .string()
  .min(7, "Telefon numarası çok kısa.")
  .max(20, "Telefon numarası çok uzun.")
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir telefon numarası girin." });
      return z.NEVER;
    }
    return normalized;
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Ad soyad en az 3 karakter olmalı.")
  .max(80, "Ad soyad en fazla 80 karakter olmalı.");

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  fullName: fullNameSchema.optional(),
});

export const registerSchema = z.object({
  phone: phoneSchema,
  fullName: fullNameSchema,
});

export const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Kod 6 haneli olmalı."),
});

export const couponCreateSchema = z.object({
  physicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih.").optional(),
  physicalTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Geçersiz saat.").optional(),
  stakeAmount: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Tutar biçimi geçersiz (örn. 50.00).")
    .optional(),
});

export const couponListQuerySchema = z.object({
  filter: z.enum(["active", "history", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const partnerCouponQuerySchema = z.object({
  status: z.enum(COUPON_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const idParamSchema = z.string().uuid("Geçersiz kimlik.");

export const passkeyLoginOptionsSchema = z.object({ phone: phoneSchema });

/** Giriş/kayıt akışının ilk adımı: yalnızca telefon. */
export const identifySchema = z.object({ phone: phoneSchema });

/** Kayıtlı olmayan numara: ad soyad + passkey ile üyelik. */
export const signupOptionsSchema = z.object({ phone: phoneSchema, fullName: fullNameSchema });

export const passkeyVerifySchema = z.object({
  challengeId: z.string().uuid(),
  credential: z.unknown(),
  deviceName: z.string().trim().max(60).optional(),
});

export const approveBodySchema = z.object({
  confirmed: z.literal(true, { message: "Onay için kontrol kutusu işaretlenmeli." }),
});

/** Üye satır düzenleme — market ham ("MS 1") veya kanonik kabul edilir. */
export const betEditSchema = z.object({
  homeTeam: z.string().trim().min(2, "Takım adı en az 2 karakter.").max(60),
  awayTeam: z.string().trim().min(2, "Takım adı en az 2 karakter.").max(60),
  league: z.string().trim().max(60).optional(),
  marketInput: z.string().trim().min(1, "Market girin (örn. MS 1).").max(40),
  printedOdds: z
    .string()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Oran biçimi geçersiz (örn. 1.85).")
    .optional(),
  confirmMatch: z.boolean().optional(),
});
