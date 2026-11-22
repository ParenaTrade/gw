import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  ApiError,
} from "@/lib/security/api";
import { otpRequestSchema } from "@/lib/validation/schemas";
import { requestOtp } from "@/lib/auth/otp";
import { writeAudit } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    enforceRateLimit("otp-ip", ip, 20, 60 * 60 * 1000);
    const body = await readJson(req, otpRequestSchema);
    enforceRateLimit("otp-phone", body.phone, 5, 10 * 60 * 1000);

    let result: { sent: boolean; demo: boolean; devCode?: string };
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new ApiError(500, "AUTH_CONFIG", "Auth yapılandırması hatalı.");
      const { error } = await supabase.auth.signInWithOtp({
        phone: body.phone,
        options: { shouldCreateUser: true },
      });
      if (error) {
        throw new ApiError(502, "SMS_FAILED", "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.");
      }
      result = { sent: true, demo: false };
    } else {
      result = await requestOtp(body.phone, body.fullName);
    }

    await writeAudit({
      actorId: null,
      actorRole: "ANONYMOUS",
      action: "OTP_REQUESTED",
      entityType: "auth",
      after: { phone: body.phone },
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk(result);
  });
}
