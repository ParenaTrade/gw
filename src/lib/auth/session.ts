import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import {
  authIdentities,
  authSessions,
  memberDevices,
  members,
  profiles,
  type MemberRow,
  type ProfileRow,
} from "@/db/schema";
import { hashWithPepper, randomDigits, randomToken, sha256Hex } from "@/lib/security/hash";
import { normalizePhone } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE = "kuponum_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  identity: { id: string; phone: string };
  profile: ProfileRow;
  member: MemberRow | null;
  sessionId: string | null;
  provider: "local" | "supabase";
};

function detectDevice(userAgent: string | null): { name: string; platform: string } {
  const ua = userAgent ?? "";
  if (/iPhone|iPad/i.test(ua)) return { name: "iPhone / iPad", platform: "ios" };
  if (/Android/i.test(ua)) return { name: "Android cihaz", platform: "android" };
  if (/Mobile/i.test(ua)) return { name: "Mobil tarayıcı", platform: "web" };
  return { name: "Masaüstü tarayıcı", platform: "web" };
}

export async function ensureIdentity(id: string | null, phone: string) {
  if (id) {
    await db.insert(authIdentities).values({ id, phone }).onConflictDoNothing();
    const [byId] = await db.select().from(authIdentities).where(eq(authIdentities.id, id)).limit(1);
    if (byId) return byId;
  }
  const [existing] = await db
    .select()
    .from(authIdentities)
    .where(eq(authIdentities.phone, phone))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(authIdentities).values({ phone }).returning();
  return created;
}

/** Profil + üyelik kaydını idempotent şekilde sağlar (ilk OTP doğrulamasında). */
export async function provisionMemberProfile(identityId: string, phone: string, fullName?: string) {
  await db
    .insert(profiles)
    .values({ id: identityId, phone, fullName: fullName ?? null, role: "MEMBER" })
    .onConflictDoNothing();

  let [profile] = await db.select().from(profiles).where(eq(profiles.id, identityId)).limit(1);
  if (fullName && !profile.fullName) {
    [profile] = await db
      .update(profiles)
      .set({ fullName, updatedAt: new Date().toISOString() })
      .where(eq(profiles.id, identityId))
      .returning();
  }

  let [member] = await db
    .select()
    .from(members)
    .where(eq(members.authUserId, identityId))
    .limit(1);

  if (!member) {
    for (let attempt = 0; attempt < 5 && !member; attempt += 1) {
      try {
        [member] = await db
          .insert(members)
          .values({
            authUserId: identityId,
            memberCode: `MBR-${randomDigits(6)}`,
            fullName: fullName ?? profile.fullName ?? "KUponum Üyesi",
            phone,
          })
          .returning();
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "23505") throw e;
      }
    }
    if (!member) throw new Error("Üyelik kodu üretilemedi.");
  }

  return { profile, member };
}

export async function createSession(identityId: string, userAgent: string | null) {
  const token = randomToken(32);
  const [session] = await db
    .insert(authSessions)
    .values({
      tokenHash: sha256Hex(token),
      identityId,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .returning();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256Hex(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
  }
}

async function loadSessionUser(
  identity: { id: string; phone: string },
  sessionId: string | null,
  provider: "local" | "supabase"
): Promise<SessionUser> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, identity.id)).limit(1);
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.authUserId, identity.id))
    .limit(1);
  return {
    identity,
    profile:
      profile ?? {
        id: identity.id,
        fullName: member?.fullName ?? null,
        phone: identity.phone,
        role: "MEMBER",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    member: member ?? null,
    sessionId,
    provider,
  };
}

/** Sunucu tarafı oturum çözümleme: Supabase yapılandırılmışsa önce o, değilse yerel cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.phone) {
        const phone = normalizePhone(user.phone) ?? `+${user.phone}`;
        const identity = await ensureIdentity(user.id, phone);
        await provisionMemberProfile(identity.id, phone);
        return loadSessionUser({ id: identity.id, phone: identity.phone }, null, "supabase");
      }
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: authSessions.id,
      identityId: authIdentities.id,
      phone: authIdentities.phone,
    })
    .from(authSessions)
    .innerJoin(authIdentities, eq(authSessions.identityId, authIdentities.id))
    .where(
      and(
        eq(authSessions.tokenHash, sha256Hex(token)),
        gt(authSessions.expiresAt, new Date().toISOString())
      )
    )
    .limit(1);

  if (!row) return null;
  return loadSessionUser({ id: row.identityId, phone: row.phone }, row.sessionId, "local");
}

export async function recordDeviceLogin(memberId: string, userAgent: string | null) {
  const device = detectDevice(userAgent);
  const [existing] = await db
    .select()
    .from(memberDevices)
    .where(and(eq(memberDevices.memberId, memberId), eq(memberDevices.deviceName, device.name)))
    .limit(1);
  if (existing) {
    await db
      .update(memberDevices)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(memberDevices.id, existing.id));
    return existing;
  }
  const [created] = await db
    .insert(memberDevices)
    .values({
      memberId,
      deviceName: device.name,
      platform: device.platform,
      lastLoginAt: new Date().toISOString(),
    })
    .returning();
  return created;
}

export { hashWithPepper };
