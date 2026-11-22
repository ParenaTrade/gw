import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  authIdentities,
  memberCredentials,
  memberDevices,
  members,
  profiles,
} from "@/db/schema";
import { randomDigits } from "@/lib/security/hash";
import { ApiError } from "@/lib/security/api";

/** drizzle 0.45 pg hatalarını sarar (`cause`); kodu/constraint'i ikisinden de okur. */
export function pgErrorInfo(e: unknown): { code?: string; constraint?: string } {
  const read = (x: unknown) =>
    x && typeof x === "object" ? (x as { code?: string; constraint?: string }) : {};
  const direct = read(e);
  if (direct.code) return direct;
  return read((e as { cause?: unknown } | null)?.cause);
}

export type PhoneLookup = { registered: boolean; hasPasskey: boolean };

/**
 * Numaranın durumu. `registered`: kimlik, profil veya üye kaydından herhangi
 * biri varsa true — passkey'i olmayan eski/seed hesapların passkey ile
 * "yeniden kayıt" edilerek devralınmasını engeller.
 */
export async function lookupPhone(phone: string): Promise<PhoneLookup> {
  const [identity] = await db
    .select()
    .from(authIdentities)
    .where(eq(authIdentities.phone, phone))
    .limit(1);
  const [memberByPhone] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.phone, phone))
    .limit(1);
  const [profileByPhone] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.phone, phone))
    .limit(1);

  const registered = Boolean(identity || memberByPhone || profileByPhone);

  let hasPasskey = false;
  if (identity) {
    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.authUserId, identity.id))
      .limit(1);
    if (member) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberCredentials)
        .where(eq(memberCredentials.memberId, member.id));
      hasPasskey = count > 0;
    }
  }
  return { registered, hasPasskey };
}

export type NewPasskeyCredential = {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
};

/**
 * Yeni üye: kimlik + profil + üye + passkey + cihaz tek transaction'da.
 * Yarım kalan (passkey'siz) üyelik oluşmaz.
 */
export async function createMemberWithPasskey(input: {
  phone: string;
  fullName: string;
  credential: NewPasskeyCredential;
  deviceName: string;
  platform: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const [identity] = await tx.insert(authIdentities).values({ phone: input.phone }).returning();
        await tx
          .insert(profiles)
          .values({ id: identity.id, phone: input.phone, fullName: input.fullName, role: "MEMBER" });
        const [member] = await tx
          .insert(members)
          .values({
            authUserId: identity.id,
            memberCode: `MBR-${randomDigits(6)}`,
            fullName: input.fullName,
            phone: input.phone,
          })
          .returning();
        await tx.insert(memberCredentials).values({
          memberId: member.id,
          credentialId: input.credential.id,
          publicKey: Buffer.from(input.credential.publicKey).toString("base64url"),
          counter: input.credential.counter,
          transports: input.credential.transports ?? [],
          deviceName: input.deviceName,
        });
        await tx.insert(memberDevices).values({
          memberId: member.id,
          deviceName: input.deviceName,
          platform: input.platform,
          passkeyEnabled: true,
          lastLoginAt: new Date().toISOString(),
        });
        return { identity, member };
      });
    } catch (e) {
      const { code, constraint } = pgErrorInfo(e);
      if (code === "23505") {
        // Üye kodu çakışması → yeni kodla tekrar dene; diğer çakışmalar (telefon, credential) kayıt var demektir.
        if (constraint?.includes("member_code")) continue;
        throw new ApiError(409, "ALREADY_REGISTERED", "Bu numara zaten kayıtlı. Giriş yapın.");
      }
      throw e;
    }
  }
  throw new Error("Üyelik kodu üretilemedi.");
}

export function detectPlatform(userAgent: string | null): { deviceName: string; platform: string } {
  const ua = userAgent ?? "";
  if (/iPhone|iPad/i.test(ua)) return { deviceName: "iPhone / iPad", platform: "ios" };
  if (/Android/i.test(ua)) return { deviceName: "Android cihaz", platform: "android" };
  if (/Mobile/i.test(ua)) return { deviceName: "Mobil tarayıcı", platform: "web" };
  return { deviceName: "Masaüstü tarayıcı", platform: "web" };
}
