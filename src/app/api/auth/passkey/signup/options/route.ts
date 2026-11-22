import { generateRegistrationOptions } from "@simplewebauthn/server";
import {
  ApiError,
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
} from "@/lib/security/api";
import { signupOptionsSchema } from "@/lib/validation/schemas";
import { createChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";
import { lookupPhone } from "@/lib/auth/signup";

/** Kayıtsız numara için passkey kayıt seçenekleri. Üyelik, passkey doğrulanınca oluşur. */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    enforceRateLimit("signup-options-ip", getClientIp(req), 15, 60 * 60 * 1000);
    const body = await readJson(req, signupOptionsSchema);
    enforceRateLimit("signup-options-phone", body.phone, 5, 10 * 60 * 1000);

    const { registered } = await lookupPhone(body.phone);
    if (registered) {
      throw new ApiError(409, "ALREADY_REGISTERED", "Bu numara zaten kayıtlı. Giriş yapın.");
    }

    const { rpID, rpName } = getWebAuthnConfig(req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: body.phone,
      userDisplayName: body.fullName,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        // Parmak izi / Face ID / cihaz kilidi zorunlu.
        userVerification: "required",
      },
    });

    const challenge = await createChallenge({
      challenge: options.challenge,
      purpose: "signup",
      phone: body.phone,
      fullName: body.fullName,
    });
    return jsonOk({ challengeId: challenge.id, options });
  });
}
