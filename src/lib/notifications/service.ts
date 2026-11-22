import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/** Bildirim servisi — Faz 1'de uygulama içi kayıt; push/SMS Faz 7. */

export async function notifyMember(
  memberId: string,
  couponId: string | null,
  type: string,
  title: string,
  body?: string
) {
  try {
    await db.insert(notifications).values({ memberId, couponId, type, title, body: body ?? null });
  } catch (e) {
    console.error(
      JSON.stringify({
        error_code: "NOTIFICATION_WRITE_FAILED",
        member_id: memberId,
        message: e instanceof Error ? e.message : String(e),
      })
    );
  }
}

export async function listNotifications(memberId: string, limit = 10) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.memberId, memberId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
