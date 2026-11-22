import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  ApiError,
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
} from "@/lib/security/api";
import { passkeyVerifySchema } from "@/lib/validation/schemas";
import { consumeChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";
import { createMemberWithPasskey, detectPlatform, lookupPhone } from "@/lib/auth/signup";
import { createSession } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";

/**
 * Kayıt tamamlama: passkey doğrulanır, ardından üyelik + passkey tek
 * transaction'da oluşturulur ve oturum açılır. Yalnızca public key saklanır.
 */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    enforceRateLimit("signup-verify-ip", ip, 15, 60 * 60 * 1000);
    const body = await readJson(req, passkeyVerifySchema);

    const challenge = await consumeChallenge(body.challengeId, "signup");
    if (!challenge || !challenge.phone || !challenge.fullName) {
      throw new ApiError(400, "CHALLENGE_INVALID", "Kayıt oturumu geçersiz veya süresi dolmuş. Tekrar deneyin.");
    }

    const { rpID, origin } = getWebAuthnConfig(req);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new ApiError(400, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı. Tekrar deneyin.");
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiError(400, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı.");
    }

    // Challenge alındıktan sonra numara başkası tarafından kaydedilmiş olabilir.
    if ((await lookupPhone(challenge.phone)).registered) {
      throw new ApiError(409, "ALREADY_REGISTERED", "Bu numara zaten kayıtlı. Giriş yapın.");
    }

    const userAgent = req.headers.get("user-agent");
    const { deviceName, platform } = detectPlatform(userAgent);
    const cred = verification.registrationInfo.credential;
    const { identity, member } = await createMemberWithPasskey({
      phone: challenge.phone,
      fullName: challenge.fullName,
      credential: {
        id: cred.id,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports,
      },
      deviceName: body.deviceName ?? deviceName,
      platform,
    });

    await createSession(identity.id, userAgent);
    await writeAudit({
      actorId: identity.id,
      actorRole: "MEMBER",
      action: "MEMBER_REGISTERED_PASSKEY",
      entityType: "member",
      entityId: member.id,
      after: { phone: challenge.phone, memberCode: member.memberCode },
      ip,
      userAgent,
    });

    return jsonOk({
      member: {
        id: member.id,
        memberCode: member.memberCode,
        fullName: member.fullName,
        phone: member.phone,
      },
    });
  });
}
