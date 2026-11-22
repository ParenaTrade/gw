import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  couponBets,
  couponImages,
  couponStatusHistory,
  coupons,
  memberLedger,
  members,
  oddsSnapshots,
  settlements,
  type CouponRow,
} from "@/db/schema";
import {
  assertTransition,
  isActiveStatus,
  MEMBER_APPROVABLE_STATUSES,
  RESULT_STATUSES,
  TERMINAL_STATUSES,
} from "@/lib/coupons/status";
import type { CouponStatus } from "@/types/database";
import { ApiError } from "@/lib/security/api";
import { randomDigits } from "@/lib/security/hash";
import { writeAudit } from "@/lib/audit/log";
import { notifyMember } from "@/lib/notifications/service";
import { findIdempotent, saveIdempotent } from "@/lib/idempotency";
import { putCouponImage, couponImagePath, MAX_IMAGE_BYTES, detectImageMime } from "@/lib/storage";
import { createHash } from "node:crypto";
import { aiCouponParses, ocrResults } from "@/db/schema";
import { normalizeMarket } from "@/lib/normalization/markets";
import { normalizeOddsString } from "@/lib/normalization/text";
import { matchEvent, selectionOdds } from "@/lib/matching/events";
import { loadCatalog } from "@/lib/matching/catalog";
import { multiplyStakeByOdds } from "@/lib/money";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActionContext = {
  actorId: string;
  actorRole: string;
  ip: string | null;
  userAgent: string | null;
};

async function insertHistory(
  tx: Tx,
  couponId: string,
  oldStatus: CouponStatus | null,
  newStatus: CouponStatus,
  changedBy: string | null,
  reason: string,
  metadata?: Record<string, unknown>
) {
  await tx.insert(couponStatusHistory).values({
    couponId,
    oldStatus,
    newStatus,
    changedBy,
    reason,
    metadata: metadata ?? null,
  });
}

/** Atomic durum geçişi — satır kilidi alınmış kupon üzerinde çağrılır. */
export async function transitionCouponTx(
  tx: Tx,
  coupon: CouponRow,
  to: CouponStatus,
  changedBy: string | null,
  reason: string,
  extra: Partial<typeof coupons.$inferInsert> = {}
) {
  assertTransition(coupon.status as CouponStatus, to);
  const [updated] = await tx
    .update(coupons)
    .set({ status: to, updatedAt: new Date().toISOString(), ...extra })
    .where(and(eq(coupons.id, coupon.id), eq(coupons.status, coupon.status)))
    .returning();
  if (!updated) {
    throw new ApiError(409, "CONCURRENT_MODIFICATION", "Kupon başka bir işlem tarafından güncellendi.");
  }
  await insertHistory(tx, coupon.id, coupon.status as CouponStatus, to, changedBy, reason);
  return updated;
}

export async function createCoupon(
  memberId: string,
  input: { physicalDate?: string; physicalTime?: string; stakeAmount?: string },
  ctx: ActionContext
): Promise<CouponRow> {
  let coupon: CouponRow | undefined;
  for (let attempt = 0; attempt < 5 && !coupon; attempt += 1) {
    try {
      [coupon] = await db
        .insert(coupons)
        .values({
          couponCode: `CPN-${randomDigits(6)}`,
          memberId,
          status: "DRAFT",
          physicalCouponDate: input.physicalDate ?? null,
          physicalCouponTime: input.physicalTime ?? null,
          stakeAmount: input.stakeAmount ?? null,
        })
        .returning();
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  if (!coupon) throw new Error("Kupon kodu üretilemedi.");

  await insertHistory(db as unknown as Tx, coupon.id, null, "DRAFT", ctx.actorId, "Kupon oluşturuldu");
  await writeAudit({
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: "COUPON_CREATED",
    entityType: "coupon",
    entityId: coupon.id,
    after: { couponCode: coupon.couponCode, status: "DRAFT" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return coupon;
}

export async function attachOriginalImage(
  couponId: string,
  memberId: string,
  bytes: Buffer,
  ctx: ActionContext
) {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "IMAGE_TOO_LARGE", "Görsel en fazla 8 MB olabilir.");
  }
  const mime = detectImageMime(bytes);
  if (!mime) {
    throw new ApiError(400, "IMAGE_FORMAT", "Yalnızca JPEG, PNG veya WebP görsel yükleyebilirsiniz.");
  }

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.memberId, memberId)))
    .limit(1);
  if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
  if (coupon.status !== "DRAFT") {
    throw new ApiError(409, "IMAGE_ALREADY_UPLOADED", "Bu kupon için orijinal görsel zaten yüklü.");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = couponImagePath(memberId, couponId, "original", mime);
  await putCouponImage(storagePath, bytes, mime);

  const result = await db.transaction(async (tx) => {
    const [image] = await tx
      .insert(couponImages)
      .values({
        couponId,
        storagePath,
        imageType: "original",
        mimeType: mime,
        sizeBytes: bytes.length,
        sha256,
      })
      .returning();
    const updated = await transitionCouponTx(tx, coupon, "UPLOADED", ctx.actorId, "Orijinal kupon görseli yüklendi", {
      uploadedAt: new Date().toISOString(),
    });
    return { image, coupon: updated };
  });

  await notifyMember(memberId, couponId, "COUPON_RECEIVED", "Kuponunuz alındı.", `${coupon.couponCode} sisteme yüklendi. Kontrol edip onaylayabilirsiniz.`);
  await writeAudit({
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: "COUPON_IMAGE_UPLOADED",
    entityType: "coupon",
    entityId: couponId,
    after: { sha256, storagePath, sizeBytes: bytes.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

/**
 * Üye onayı — idempotent. Aynı kupon ikinci kez onaylanamaz; aynı
 * idempotency key ile tekrar gelen istek ilk yanıtı döner.
 * Onaydan sonra kupon otomatik olarak partner kuyruğuna alınır.
 */
export async function approveCoupon(
  couponId: string,
  memberId: string,
  idempotencyKey: string,
  ctx: ActionContext
) {
  const existing = await findIdempotent(idempotencyKey);
  if (existing) return existing.responseJson as { coupon: CouponRow; alreadyApproved: boolean };

  try {
    const result = await db.transaction(async (tx) => {
      const [coupon] = await tx
        .select()
        .from(coupons)
        .where(and(eq(coupons.id, couponId), eq(coupons.memberId, memberId)))
        .for("update")
        .limit(1);
      if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
      if (!MEMBER_APPROVABLE_STATUSES.includes(coupon.status as CouponStatus)) {
        throw new ApiError(409, "INVALID_STATE", "Kupon bu adımda onaylanamaz.");
      }

      const approved = await transitionCouponTx(tx, coupon, "MEMBER_APPROVED", ctx.actorId, "Üye kuponu onayladı", {
        memberApprovedAt: new Date().toISOString(),
      });
      const queued = await transitionCouponTx(tx, approved, "PARTNER_QUEUE", null, "Sistem: partner kuyruğuna alındı");

      await saveIdempotent(tx, idempotencyKey, "MEMBER_APPROVAL", couponId, {
        coupon: queued,
        alreadyApproved: false,
      });
      return { coupon: queued, alreadyApproved: false };
    });

    await notifyMember(memberId, couponId, "COUPON_APPROVED", "Kuponunuz onaylandı.", "Onay zamanınız operasyonel kayıt olarak saklandı.");
    await notifyMember(memberId, couponId, "PARTNER_QUEUED", "Kuponunuz partner işlem sırasına alındı.", "Yetkili partner operasyonu kuponu inceleyecek.");
    await writeAudit({
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      action: "COUPON_MEMBER_APPROVED",
      entityType: "coupon",
      entityId: couponId,
      after: { status: "PARTNER_QUEUE", idempotencyKey },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return result;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      const retry = await findIdempotent(idempotencyKey);
      if (retry) return retry.responseJson as { coupon: CouponRow; alreadyApproved: boolean };
    }
    throw e;
  }
}

/**
 * Operatör kuponu işleme alır — atomic claim.
 * İki operatör aynı kuponu aynı anda işleyemez (FOR UPDATE + status guard).
 */
export async function claimCoupon(couponId: string, ctx: ActionContext) {
  const result = await db.transaction(async (tx) => {
    const [coupon] = await tx
      .select()
      .from(coupons)
      .where(eq(coupons.id, couponId))
      .for("update")
      .limit(1);
    if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
    if (coupon.status !== "PARTNER_QUEUE") {
      throw new ApiError(409, "ALREADY_CLAIMED", "Kupon zaten işleme alınmış veya bu adımda değil.");
    }
    return transitionCouponTx(tx, coupon, "PARTNER_PROCESSING", ctx.actorId, "Operatör kuponu işleme aldı", {
      partnerReceivedAt: new Date().toISOString(),
    });
  });

  await notifyMember(result.memberId, couponId, "PARTNER_REVIEW", "Kuponunuz inceleniyor.", "Partner operasyonu kuponunuzu işleme aldı.");
  await writeAudit({
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: "PARTNER_COUPON_CLAIMED",
    entityType: "coupon",
    entityId: couponId,
    before: { status: "PARTNER_QUEUE" },
    after: { status: "PARTNER_PROCESSING" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

export async function getCouponForMember(couponId: string, memberId: string) {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.memberId, memberId)))
    .limit(1);
  return coupon ?? null;
}

export async function getCouponAny(couponId: string) {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, couponId)).limit(1);
  return coupon ?? null;
}

export async function getCouponDetail(couponId: string) {
  const coupon = await getCouponAny(couponId);
  if (!coupon) return null;
  const [images, bets, history, settlementRows, ledgerRows, ocrRows, aiRows] = await Promise.all([
    db.select().from(couponImages).where(eq(couponImages.couponId, couponId)).orderBy(couponImages.createdAt),
    db.select().from(couponBets).where(eq(couponBets.couponId, couponId)).orderBy(couponBets.rowNumber),
    db.select().from(couponStatusHistory).where(eq(couponStatusHistory.couponId, couponId)).orderBy(couponStatusHistory.createdAt),
    db.select().from(settlements).where(eq(settlements.couponId, couponId)),
    db.select().from(memberLedger).where(eq(memberLedger.couponId, couponId)).orderBy(memberLedger.createdAt),
    db.select().from(ocrResults).where(eq(ocrResults.couponId, couponId)).orderBy(desc(ocrResults.createdAt)).limit(1),
    db.select().from(aiCouponParses).where(eq(aiCouponParses.couponId, couponId)).orderBy(desc(aiCouponParses.createdAt)).limit(1),
  ]);
  const snapshots = bets.length
    ? await db.select().from(oddsSnapshots).where(inArray(oddsSnapshots.couponBetId, bets.map((b) => b.id))).orderBy(oddsSnapshots.observedAt)
    : [];
  return {
    coupon,
    images,
    bets,
    history,
    settlements: settlementRows,
    ledger: ledgerRows,
    snapshots,
    ocr: ocrRows[0] ?? null,
    aiParse: aiRows[0] ?? null,
  };
}

export type CouponWithImage = CouponRow & { thumbnailImageId: string | null };

async function attachThumbnails(rows: CouponRow[]): Promise<CouponWithImage[]> {
  if (rows.length === 0) return [];
  const imgs = await db
    .select()
    .from(couponImages)
    .where(and(inArray(couponImages.couponId, rows.map((r) => r.id)), eq(couponImages.imageType, "original")));
  const map = new Map<string, string>();
  for (const img of imgs) if (!map.has(img.couponId)) map.set(img.couponId, img.id);
  return rows.map((r) => ({ ...r, thumbnailImageId: map.get(r.id) ?? null }));
}

export async function listMemberCoupons(memberId: string, filter: "active" | "history" | "all", limit: number) {
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.memberId, memberId))
    .orderBy(desc(coupons.createdAt))
    .limit(limit);
  const filtered = rows.filter((r) => {
    const status = r.status as CouponStatus;
    if (filter === "active") return isActiveStatus(status);
    if (filter === "history") return TERMINAL_STATUSES.includes(status) || RESULT_STATUSES.includes(status);
    return true;
  });
  return attachThumbnails(filtered);
}

export async function listPartnerCoupons(status: CouponStatus | undefined, limit: number) {
  const rows = await db
    .select({ coupon: coupons, member: members })
    .from(coupons)
    .innerJoin(members, eq(coupons.memberId, members.id))
    .where(status ? eq(coupons.status, status) : undefined)
    .orderBy(desc(coupons.createdAt))
    .limit(limit);
  const withThumbs = await attachThumbnails(rows.map((r) => r.coupon));
  const thumbMap = new Map(withThumbs.map((c) => [c.id, c.thumbnailImageId]));
  return rows.map((r) => ({
    ...r.coupon,
    thumbnailImageId: thumbMap.get(r.coupon.id) ?? null,
    memberName: r.member.fullName,
    memberPhone: r.member.phone,
    memberCode: r.member.memberCode,
  }));
}

export async function getPartnerStats() {
  const statusCounts = await db
    .select({ status: coupons.status, count: sql<number>`count(*)::int` })
    .from(coupons)
    .groupBy(coupons.status);
  const counts = Object.fromEntries(statusCounts.map((r) => [r.status, r.count])) as Partial<Record<CouponStatus, number>>;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ today }] = await db
    .select({ today: sql<number>`count(*)::int` })
    .from(coupons)
    .where(gte(coupons.createdAt, todayStart.toISOString()));

  const [{ settlementPending }] = await db
    .select({ settlementPending: sql<number>`count(*)::int` })
    .from(coupons)
    .where(
      and(
        inArray(coupons.status, ["WON", "LOST", "RESULT_UPDATED"]),
        sql`not exists (select 1 from settlements s where s.coupon_id = ${coupons.id})`
      )
    );

  const sum = (...statuses: CouponStatus[]) => statuses.reduce((acc, s) => acc + (counts[s] ?? 0), 0);
  return {
    today,
    pending: sum("MEMBER_APPROVED", "PARTNER_QUEUE"),
    processing: sum("PARTNER_PROCESSING", "PLATFORM_PREPARING", "PENDING_CONFIRMATION", "SUBMITTED"),
    played: sum("ACCEPTED", "RESULT_PENDING"),
    oddsChanged: sum("ODDS_CHANGED"),
    resultPending: sum("RESULT_PENDING"),
    won: sum("WON"),
    lost: sum("LOST"),
    settled: sum("SETTLED"),
    failed: sum("FAILED", "REJECTED", "OCR_FAILED"),
    settlementPending,
    total: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
  };
}

/** OCR + AI işleme başlatma — atomic durum guard'ı ile çift işleme engellenir. */
export async function startProcessing(couponId: string, memberId: string, ctx: ActionContext) {
  const result = await db.transaction(async (tx) => {
    const [coupon] = await tx
      .select()
      .from(coupons)
      .where(and(eq(coupons.id, couponId), eq(coupons.memberId, memberId)))
      .for("update")
      .limit(1);
    if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
    if (coupon.status !== "UPLOADED" && coupon.status !== "OCR_FAILED") {
      throw new ApiError(409, "INVALID_STATE", "Kupon bu adımda dijitalleştirilemez.");
    }
    return transitionCouponTx(tx, coupon, "OCR_PROCESSING", ctx.actorId, "OCR + AI işleme başladı");
  });
  await writeAudit({
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: "COUPON_PROCESS_STARTED",
    entityType: "coupon",
    entityId: couponId,
    after: { status: "OCR_PROCESSING" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

export type BetEditInput = {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  marketInput: string;
  printedOdds?: string;
  confirmMatch?: boolean;
};

/**
 * Üye satır düzenleme (Faz 3). Yalnızca NEEDS_REVIEW / READY_FOR_MEMBER_APPROVAL
 * durumlarında. Market normalize edilir, event yeniden eşleştirilir, toplam
 * oranlar decimal-safe yeniden hesaplanır ve inceleme durumu güncellenir.
 */
export async function updateBetForMember(
  couponId: string,
  betId: string,
  memberId: string,
  input: BetEditInput,
  ctx: ActionContext
) {
  const result = await db.transaction(async (tx) => {
    const [coupon] = await tx
      .select()
      .from(coupons)
      .where(and(eq(coupons.id, couponId), eq(coupons.memberId, memberId)))
      .for("update")
      .limit(1);
    if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
    if (coupon.status !== "NEEDS_REVIEW" && coupon.status !== "READY_FOR_MEMBER_APPROVAL") {
      throw new ApiError(409, "INVALID_STATE", "Kupon satırları bu adımda düzenlenemez.");
    }
    const [bet] = await tx
      .select()
      .from(couponBets)
      .where(and(eq(couponBets.id, betId), eq(couponBets.couponId, couponId)))
      .for("update")
      .limit(1);
    if (!bet) throw new ApiError(404, "BET_NOT_FOUND", "Satır bulunamadı.");

    const normalized = normalizeMarket(input.marketInput);
    const market = normalized?.market ?? input.marketInput.toUpperCase();
    const selection = normalized?.selection ?? "UNKNOWN";
    const printedOdds = input.printedOdds ? normalizeOddsString(input.printedOdds) : null;

    const { catalog, extraTeams } = await loadCatalog();
    const match = matchEvent(
      { home: input.homeTeam, away: input.awayTeam, league: input.league ?? null, date: coupon.physicalCouponDate },
      catalog,
      extraTeams
    );
    const matchedOdds = match.event ? selectionOdds(match.event, market, selection) : null;
    const oddsDrift = !!matchedOdds && !!printedOdds && matchedOdds !== printedOdds;

    let needsReview = !normalized || !printedOdds || match.needsReview || !matchedOdds || oddsDrift;
    // Üye açıkça doğruladıysa (eşleşme >= 0.80 + okunur oran + bilinen market)
    // oran farkı/fuzzy bandı manuel onayla temizlenebilir.
    if (input.confirmMatch && match.event && match.confidence >= 0.8 && printedOdds && normalized) {
      needsReview = false;
    }

    const [updated] = await tx
      .update(couponBets)
      .set({
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        league: input.league ?? null,
        market,
        selection,
        printedOdds,
        matchedOdds,
        eventId: match.event?.externalId ?? null,
        eventConfidence: match.confidence.toFixed(4),
        needsReview,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(couponBets.id, betId))
      .returning();

    if (oddsDrift && printedOdds && matchedOdds) {
      await tx.insert(oddsSnapshots).values({
        couponBetId: betId,
        printedOdds,
        observedOdds: matchedOdds,
        difference: (Number(matchedOdds) - Number(printedOdds)).toFixed(2),
        observedAt: new Date().toISOString(),
        source: "member-edit",
      });
    }

    const allBets = await tx.select().from(couponBets).where(eq(couponBets.couponId, couponId));
    const allPrinted = allBets.length > 0 && allBets.every((b) => b.printedOdds !== null);
    const printedTotal = allPrinted
      ? multiplyStakeByOdds("1.00", allBets.map((b) => b.printedOdds!))
      : coupon.printedTotalOdds;
    const potentialReturn =
      coupon.stakeAmount && allPrinted
        ? multiplyStakeByOdds(coupon.stakeAmount, allBets.map((b) => b.printedOdds!))
        : coupon.potentialReturn;
    await tx
      .update(coupons)
      .set({ printedTotalOdds: printedTotal, potentialReturn, updatedAt: new Date().toISOString() })
      .where(eq(coupons.id, couponId));

    const anyReview = allBets.some((b) => b.needsReview);
    const target: CouponStatus = anyReview ? "NEEDS_REVIEW" : "READY_FOR_MEMBER_APPROVAL";
    if (coupon.status !== target) {
      await transitionCouponTx(
        tx,
        coupon,
        target,
        ctx.actorId,
        anyReview ? "Satır düzenleme sonrası kontrol gerekiyor" : "Tüm satırlar üye tarafından doğrulandı"
      );
    }
    return { bet: updated, couponStatus: target, before: bet };
  });

  await writeAudit({
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    action: "BET_EDITED",
    entityType: "coupon_bet",
    entityId: betId,
    before: {
      homeTeam: result.before.homeTeam,
      awayTeam: result.before.awayTeam,
      market: result.before.market,
      selection: result.before.selection,
      printedOdds: result.before.printedOdds,
    },
    after: {
      homeTeam: result.bet.homeTeam,
      awayTeam: result.bet.awayTeam,
      market: result.bet.market,
      selection: result.bet.selection,
      printedOdds: result.bet.printedOdds,
      needsReview: result.bet.needsReview,
      couponStatus: result.couponStatus,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { bet: result.bet, couponStatus: result.couponStatus };
}
