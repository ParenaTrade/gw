import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authIdentities, memberCredentials, members } from "@/db/schema";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransport } from "@simplewebauthn/server";
import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  ApiError,
} from "@/lib/security/api";
import { passkeyLoginOptionsSchema } from "@/lib/validation/schemas";
import { createChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";

/** Telefon + passkey ile giriş: önce cihaz credential'ları bulunur. */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    enforceRateLimit("passkey-options", getClientIp(req), 30, 15 * 60 * 1000);
    const body = await readJson(req, passkeyLoginOptionsSchema);

    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.phone, body.phone))
      .limit(1);
    const member = identity
      ? (await db.select().from(members).where(eq(members.authUserId, identity.id)).limit(1))[0]
      : undefined;
    const creds = member
      ? await db.select().from(memberCredentials).where(eq(memberCredentials.memberId, member.id))
      : [];

    if (!member || creds.length === 0) {
      throw new ApiError(404, "PASSKEY_NOT_FOUND", "Bu numara için kayıtlı passkey yok.");
    }

    const { rpID } = getWebAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
    });

    const challenge = await createChallenge({
      challenge: options.challenge,
      purpose: "authentication",
      phone: body.phone,
      memberId: member.id,
    });
    return jsonOk({ challengeId: challenge.id, options });
  });
}
