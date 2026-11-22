import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
} from "@/lib/security/api";
import { registerSchema } from "@/lib/validation/schemas";
import { requestOtp } from "@/lib/auth/otp";
import { writeAudit } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/security/api";

/**
 * Üye kaydı: telefon + ad soyad alınır, OTP doğrulaması ile üyelik
 * provision edilir (verify adımında). Profil/üye kaydı idempotenttir.
 */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    enforceRateLimit("register-ip", ip, 10, 60 * 60 * 1000);
    const body = await readJson(req, registerSchema);
    enforceRateLimit("otp-phone", body.phone, 5, 10 * 60 * 1000);

    let result: { sent: boolean; demo: boolean; devCode?: string };
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new ApiError(500, "AUTH_CONFIG", "Auth yapılandırması hatalı.");
      const { error } = await supabase.auth.signInWithOtp({
        phone: body.phone,
        options: { shouldCreateUser: true, data: { full_name: body.fullName } },
      });
      if (error) throw new ApiError(502, "SMS_FAILED", "Doğrulama kodu gönderilemedi.");
      result = { sent: true, demo: false };
    } else {
      result = await requestOtp(body.phone, body.fullName);
    }

    await writeAudit({
      actorId: null,
      actorRole: "ANONYMOUS",
      action: "MEMBER_REGISTER_STARTED",
      entityType: "member",
      after: { phone: body.phone, fullName: body.fullName },
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk({ ...result, next: "/verify" });
  });
}
