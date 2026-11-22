import { eq } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import type { Tx } from "@/lib/coupons/service";

/**
 * Kritik işlemler için idempotency kaydı.
 * Örnek anahtarlar:
 *   MEMBER_APPROVAL:     `${couponId}:approval:v${approvalVersion}`
 *   PLATFORM_SUBMISSION: `${couponId}:submission:v${submissionVersion}`
 */

export async function findIdempotent(key: string) {
  const [row] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).limit(1);
  return row ?? null;
}

export async function saveIdempotent(
  tx: Tx,
  key: string,
  scope: string,
  entityId: string,
  response: Record<string, unknown>
) {
  await tx.insert(idempotencyKeys).values({
    key,
    scope,
    entityType: "coupon",
    entityId,
    responseJson: response,
  });
}
