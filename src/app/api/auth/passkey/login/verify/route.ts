import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authIdentities, memberCredentials, members } from "@/db/schema";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  ApiError,
} from "@/lib/security/api";
import { passkeyVerifySchema } from "@/lib/validation/schemas";
import { consumeChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";
import { createSession, recordDeviceLogin } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Passkey doğrulama → cihaz biyometrisi cihazda kalır, session üretilir. */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    if (isSupabaseConfigured()) {
      throw new ApiError(501, "PASSKEY_SUPABASE_MANAGED", "Bu dağıtımda passkey yönetimi Supabase Auth üzerinden yapılır.");
    }
    enforceRateLimit("passkey-verify", getClientIp(req), 30, 15 * 60 * 1000);
    const body = await readJson(req, passkeyVerifySchema);
    const challenge = await consumeChallenge(body.challengeId, "authentication");
    if (!challenge || !challenge.phone) {
      throw new ApiError(400, "CHALLENGE_INVALID", "Doğrulama oturumu geçersiz. Tekrar deneyin.");
    }

    const credential = body.credential as AuthenticationResponseJSON;
    const [stored] = await db
      .select()
      .from(memberCredentials)
      .where(eq(memberCredentials.credentialId, credential.id))
      .limit(1);
    if (!stored) throw new ApiError(404, "PASSKEY_NOT_FOUND", "Passkey bulunamadı.");

    const [member] = await db.select().from(members).where(eq(members.id, stored.memberId)).limit(1);
    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.id, member.authUserId))
      .limit(1);
    if (!member || !identity || identity.phone !== challenge.phone) {
      throw new ApiError(403, "PASSKEY_MISMATCH", "Passkey bu numara ile eşleşmiyor.");
    }

    const { rpID, origin } = getWebAuthnConfig(req);
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: false,
      });
    } catch {
      throw new ApiError(400, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı. OTP ile giriş yapın.");
    }
    if (!verification.verified) {
      throw new ApiError(401, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı.");
    }

    // Klonlanmış authenticator tespiti için counter güncellenir.
    await db
      .update(memberCredentials)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(memberCredentials.id, stored.id));

    const userAgent = req.headers.get("user-agent");
    await createSession(identity.id, userAgent);
    await recordDeviceLogin(member.id, userAgent);
    await writeAudit({
      actorId: identity.id,
      actorRole: "MEMBER",
      action: "LOGIN_PASSKEY",
      entityType: "member",
      entityId: member.id,
      after: { phone: identity.phone },
      ip: getClientIp(req),
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
