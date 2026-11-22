import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberCredentials, memberDevices } from "@/db/schema";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  assertSameOrigin,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  requireMember,
  ApiError,
} from "@/lib/security/api";
import { passkeyVerifySchema } from "@/lib/validation/schemas";
import { consumeChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";
import { writeAudit } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Passkey kaydı doğrulama. Yalnızca credential PUBLIC key saklanır;
 * ham biyometrik veri / parmak izi şablonu hiçbir zaman backend'e gelmez.
 */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    if (isSupabaseConfigured()) {
      throw new ApiError(501, "PASSKEY_SUPABASE_MANAGED", "Bu dağıtımda passkey yönetimi Supabase Auth üzerinden yapılır.");
    }
    const user = await requireMember();
    const body = await readJson(req, passkeyVerifySchema);
    const challenge = await consumeChallenge(body.challengeId, "registration");
    if (!challenge || challenge.memberId !== user.member.id) {
      throw new ApiError(400, "CHALLENGE_INVALID", "Doğrulama oturumu geçersiz. Tekrar deneyin.");
    }

    const { rpID, origin } = getWebAuthnConfig(req);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch {
      throw new ApiError(400, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı. Tekrar deneyin.");
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiError(400, "PASSKEY_VERIFY_FAILED", "Passkey doğrulanamadı.");
    }

    const cred = verification.registrationInfo.credential;
    await db
      .insert(memberCredentials)
      .values({
        memberId: user.member.id,
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey).toString("base64url"),
        counter: cred.counter,
        transports: cred.transports ?? [],
        deviceName: body.deviceName ?? "Bu cihaz",
      })
      .onConflictDoNothing();

    const deviceName = body.deviceName ?? "Bu cihaz";
    const [device] = await db
      .select()
      .from(memberDevices)
      .where(and(eq(memberDevices.memberId, user.member.id), eq(memberDevices.deviceName, deviceName)))
      .limit(1);
    if (device) {
      await db.update(memberDevices).set({ passkeyEnabled: true }).where(eq(memberDevices.id, device.id));
    } else {
      await db.insert(memberDevices).values({
        memberId: user.member.id,
        deviceName,
        platform: "web",
        passkeyEnabled: true,
        lastLoginAt: new Date().toISOString(),
      });
    }

    await writeAudit({
      actorId: user.identity.id,
      actorRole: user.profile.role,
      action: "PASSKEY_REGISTERED",
      entityType: "member_device",
      entityId: user.member.id,
      after: { deviceName, passkeyEnabled: true },
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk({ registered: true });
  });
}
