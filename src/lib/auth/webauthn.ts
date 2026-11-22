import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authChallenges } from "@/db/schema";
import { randomToken } from "@/lib/security/hash";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * WebAuthn RP yapılandırması. Env tanımlı değilse istek host'undan türetilir
 * (preview ortamlarında çalışır). Ham biyometrik veri hiçbir zaman alınmaz;
 * yalnızca credential public key saklanır.
 */
export function getWebAuthnConfig(req: Request) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");

  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || hostname;
  const origin = process.env.WEBAUTHN_ORIGIN?.trim() || `${proto}://${host}`;
  return { rpID, origin, rpName: "KUponum" };
}

export async function createChallenge(input: {
  purpose: "registration" | "authentication";
  phone?: string;
  memberId?: string;
}) {
  const [row] = await db
    .insert(authChallenges)
    .values({
      challenge: randomToken(32),
      purpose: input.purpose,
      phone: input.phone ?? null,
      memberId: input.memberId ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .returning();
  return row;
}

/** Tek kullanımlık challenge — atomik tüketim. */
export async function consumeChallenge(id: string, purpose: "registration" | "authentication") {
  const [row] = await db
    .update(authChallenges)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(authChallenges.id, id),
        eq(authChallenges.purpose, purpose),
        isNull(authChallenges.consumedAt),
        gt(authChallenges.expiresAt, new Date().toISOString())
      )
    )
    .returning();
  return row ?? null;
}
