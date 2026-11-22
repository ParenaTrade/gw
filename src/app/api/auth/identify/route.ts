import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
} from "@/lib/security/api";
import { identifySchema } from "@/lib/validation/schemas";
import { lookupPhone } from "@/lib/auth/signup";
import { isOtpDemoMode } from "@/lib/auth/otp";

/**
 * Giriş akışının ilk adımı: numara kayıtlı mı, passkey'i var mı?
 * - kayıtlı + passkey  → biyometrik giriş
 * - kayıtsız           → ad soyad + passkey ile kayıt
 * - kayıtlı, passkey yok (eski/seed hesap) → yalnızca demo modunda OTP yedeği
 */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    enforceRateLimit("identify-ip", getClientIp(req), 40, 15 * 60 * 1000);
    const { phone } = await readJson(req, identifySchema);
    enforceRateLimit("identify-phone", phone, 15, 15 * 60 * 1000);
    const { registered, hasPasskey } = await lookupPhone(phone);
    return jsonOk({
      phone,
      registered,
      hasPasskey,
      otpFallback: registered && !hasPasskey && isOtpDemoMode(),
    });
  });
}
