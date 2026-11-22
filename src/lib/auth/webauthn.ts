import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authChallenges } from "@/db/schema";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** signup: henüz üyesi olmayan kişinin telefon + ad soyad ile passkey kaydı. */
export type ChallengePurpose = "registration" | "authentication" | "signup";

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

/**
 * `challenge`, generateRegistrationOptions/generateAuthenticationOptions'ın
 * döndürdüğü `options.challenge` olmalıdır (base64url). Tarayıcı bu değeri
 * imzalar; doğrulamada `expectedChallenge` olarak aynısı beklenir.
 */
export async function createChallenge(input: {
  challenge: string;
  purpose: ChallengePurpose;
  phone?: string;
  fullName?: string;
  memberId?: string;
}) {
  const [row] = await db
    .insert(authChallenges)
    .values({
      challenge: input.challenge,
      purpose: input.purpose,
      phone: input.phone ?? null,
      fullName: input.fullName ?? null,
      memberId: input.memberId ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .returning();
  return row;
}

/** Tek kullanımlık challenge — atomik tüketim. */
export async function consumeChallenge(id: string, purpose: ChallengePurpose) {
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
