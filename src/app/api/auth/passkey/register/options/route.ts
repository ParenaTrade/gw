import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberCredentials } from "@/db/schema";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransport } from "@simplewebauthn/server";
import { assertSameOrigin, handleRoute, jsonOk, requireMember, ApiError } from "@/lib/security/api";
import { createChallenge, getWebAuthnConfig } from "@/lib/auth/webauthn";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Passkey kayıt seçenekleri — oturum açık üye için. */
export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    if (isSupabaseConfigured()) {
      throw new ApiError(501, "PASSKEY_SUPABASE_MANAGED", "Bu dağıtımda passkey yönetimi Supabase Auth üzerinden yapılır.");
    }
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
        userVerification: "preferred",
      },
    });

    const challenge = await createChallenge({ purpose: "registration", memberId: user.member.id });
    return jsonOk({ challengeId: challenge.id, options });
  });
}
