import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberCredentials } from "@/db/schema";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransport } from "@simplewebauthn/server";
import { assertSameOrigin, handleRoute, jsonOk, requireMember } from "@/lib/security/api";
import { createChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";

/** Passkey kayıt seçenekleri — oturum açık üye için. */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const user = await requireMember();
    const { rpID, rpName } = getWebAuthnConfig(req);

    const existing = await db
      .select()
      .from(memberCredentials)
      .where(eq(memberCredentials.memberId, user.member.id));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.member.phone,
      userDisplayName: user.member.fullName,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });

    const challenge = await createChallenge({
      challenge: options.challenge,
      purpose: "registration",
      memberId: user.member.id,
    });
    return jsonOk({ challengeId: challenge.id, options });
  });
}
