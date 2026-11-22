import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  aiCouponParses,
  couponBets,
  couponImages,
  coupons,
  ocrResults,
  oddsSnapshots,
  type CouponRow,
} from "@/db/schema";
import { transitionCouponTx } from "@/lib/coupons/service";
import { getCouponAny } from "@/lib/coupons/service";
import { processForOcr } from "@/lib/image/process";
import { runOcr } from "@/lib/ocr";
import { parseCouponText } from "@/lib/ai/parser";
import { matchEvent, selectionOdds } from "@/lib/matching/events";
import { loadCatalog } from "@/lib/matching/catalog";
import { multiplyStakeByOdds } from "@/lib/money";
import { couponImagePath, putCouponImage, readCouponImage } from "@/lib/storage";
import { notifyMember } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit/log";
import type { CouponStatus } from "@/types/database";

/**
 * OCR + AI işleme hattı. Route handler `after()` ile yanıt sonrası çalıştırır
 * (Vercel request timeout'una takılmaz; uzun işler için Faz 2 production'da
 * harici PaddleOCR worker + queue önerilir).
 * Her aşama durum makinesi + history + audit ile izlenir.
 */

async function transition(couponId: string, to: CouponStatus, reason: string, extra: Partial<typeof coupons.$inferInsert> = {}) {
  return db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(coupons).where(eq(coupons.id, couponId)).for("update").limit(1);
    if (!fresh) throw new Error("Kupon bulunamadı");
    return transitionCouponTx(tx, fresh, to, null, reason, extra);
  });
}

export async function runCouponPipeline(couponId: string, actorId: string | null): Promise<void> {
  let stage = "INIT";
  const started = Date.now();
  const log = (extra: Record<string, unknown>) =>
    console.info(JSON.stringify({ coupon_id: couponId, stage, duration_ms: Date.now() - started, ...extra }));

  try {
    let coupon = await getCouponAny(couponId);
    if (!coupon || coupon.status !== "OCR_PROCESSING") return;

    stage = "IMAGE";
    const [original] = await db
      .select()
      .from(couponImages)
      .where(eq(couponImages.couponId, couponId))
      .orderBy(couponImages.createdAt)
      .limit(1);
    if (!original) {
      await transition(couponId, "OCR_FAILED", "Orijinal görsel bulunamadı");
      return;
    }
    const originalBytes = await readCouponImage(original.storagePath);
    if (!originalBytes) {
      await transition(couponId, "OCR_FAILED", "Görsel deposundan okunamadı");
      return;
    }
    const processed = await processForOcr(originalBytes);
    const processedPath = couponImagePath(coupon.memberId, couponId, "ocr", "image/jpeg");
    await putCouponImage(processedPath, processed.bytes, "image/jpeg");
    await db.insert(couponImages).values({
      couponId,
      storagePath: processedPath,
      imageType: "ocr",
      mimeType: "image/jpeg",
      sizeBytes: processed.bytes.length,
      sha256: createHash("sha256").update(processed.bytes).digest("hex"),
      ocrProcessed: true,
    });

    stage = "OCR";
    const ocr = await runOcr(processed.bytes);
    await db.insert(ocrResults).values({
      couponId,
      engine: ocr.engine,
      rawText: ocr.text,
      confidence: ocr.confidence.toFixed(4),
      processingTimeMs: ocr.durationMs,
    });
    log({ status: "OCR_DONE", engine: ocr.engine, confidence: ocr.confidence, ocr_ms: ocr.durationMs });
    if (!ocr.text.trim()) {
      await transition(couponId, "OCR_FAILED", "OCR metin çıkaramadı");
      await notifyMember(coupon.memberId, couponId, "OCR_FAILED", "Kupon okunamadı.", "Daha net bir fotoğrafla tekrar deneyin.");
      return;
    }

    await transition(couponId, "AI_PROCESSING", "OCR tamamlandı, AI ayrıştırma başladı");

    stage = "AI";
    const parsed = await parseCouponText(ocr.text, ocr.confidence);
    await db.insert(aiCouponParses).values({
      couponId,
      model: parsed.model,
      promptVersion: parsed.promptVersion,
      resultJson: parsed.parse as unknown as Record<string, unknown>,
      confidence: parsed.parse.confidence.toFixed(4),
      needsReview: parsed.parse.needsReview,
    });
    log({ status: "AI_DONE", model: parsed.model, source: parsed.source, bets: parsed.parse.bets.length });

    stage = "MATCHING";
    const { catalog, extraTeams } = await loadCatalog();
    const prepared = parsed.parse.bets.map((bet) => {
      const match = matchEvent(
        { home: bet.homeTeam, away: bet.awayTeam, league: bet.league, date: parsed.parse.physicalDate ?? coupon!.physicalCouponDate },
        catalog,
        extraTeams
      );
      const matchedOdds = match.event ? selectionOdds(match.event, bet.market, bet.selection) : null;
      const oddsDrift = matchedOdds !== null && bet.printedOdds !== null && matchedOdds !== bet.printedOdds.toFixed(2);
      return {
        bet,
        match,
        matchedOdds,
        needsReview: bet.needsReview || match.needsReview || oddsDrift || matchedOdds === null,
      };
    });

    stage = "PERSIST";
    const allPrinted = prepared.length > 0 && prepared.every((p) => p.bet.printedOdds !== null);
    const printedProduct = allPrinted
      ? multiplyStakeByOdds("1.00", prepared.map((p) => p.bet.printedOdds!.toFixed(2)))
      : null;
    const printedTotal = parsed.parse.printedTotalOdds?.toFixed(2) ?? printedProduct;
    const stake = coupon.stakeAmount ?? parsed.parse.stakeAmount;
    const potentialReturn = stake && allPrinted
      ? multiplyStakeByOdds(stake, prepared.map((p) => p.bet.printedOdds!.toFixed(2)))
      : null;

    await db.transaction(async (tx) => {
      const oldBets = await tx.select({ id: couponBets.id }).from(couponBets).where(eq(couponBets.couponId, couponId));
      if (oldBets.length) {
        await tx.delete(oddsSnapshots).where(inArray(oddsSnapshots.couponBetId, oldBets.map((b) => b.id)));
        await tx.delete(couponBets).where(eq(couponBets.couponId, couponId));
      }
      for (const p of prepared) {
        const [row] = await tx
          .insert(couponBets)
          .values({
            couponId,
            rowNumber: p.bet.row,
            homeTeam: p.bet.homeTeam,
            awayTeam: p.bet.awayTeam,
            league: p.bet.league,
            market: p.bet.market,
            selection: p.bet.selection,
            printedOdds: p.bet.printedOdds !== null ? p.bet.printedOdds.toFixed(2) : null,
            matchedOdds: p.matchedOdds,
            eventId: p.match.event?.externalId ?? null,
            eventConfidence: p.match.confidence.toFixed(4),
            ocrConfidence: ocr.confidence.toFixed(4),
            aiConfidence: p.bet.confidence.toFixed(4),
            needsReview: p.needsReview,
          })
          .returning();
        if (p.matchedOdds && p.bet.printedOdds !== null && p.matchedOdds !== p.bet.printedOdds.toFixed(2)) {
          const diff = (Number(p.matchedOdds) - p.bet.printedOdds).toFixed(2);
          await tx.insert(oddsSnapshots).values({
            couponBetId: row.id,
            printedOdds: p.bet.printedOdds.toFixed(2),
            observedOdds: p.matchedOdds,
            difference: diff,
            observedAt: new Date().toISOString(),
            source: "event-catalog",
          });
        }
      }
      await tx
        .update(coupons)
        .set({
          physicalCouponDate: coupon!.physicalCouponDate ?? parsed.parse.physicalDate,
          physicalCouponTime: coupon!.physicalCouponTime ?? parsed.parse.physicalTime,
          stakeAmount: stake,
          printedTotalOdds: printedTotal,
          potentialReturn,
          aiProcessedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(coupons.id, couponId));
    });

    const anyReview = prepared.some((p) => p.needsReview) || prepared.length === 0;
    await transition(
      couponId,
      anyReview ? "NEEDS_REVIEW" : "READY_FOR_MEMBER_APPROVAL",
      anyReview ? "Bazı satırlar kontrol gerektiriyor" : "Tüm satırlar yüksek güvenle eşleşti"
    );

    await notifyMember(
      coupon.memberId,
      couponId,
      "COUPON_DIGITIZED",
      "Kuponunuz dijitalleştirildi.",
      anyReview ? "Bazı satırları kontrol edip düzeltmeniz gerekiyor." : "Kuponunuz onaya hazır."
    );
    await writeAudit({
      actorId,
      actorRole: "SYSTEM",
      action: "COUPON_PROCESSED",
      entityType: "coupon",
      entityId: couponId,
      after: { engine: ocr.engine, model: parsed.model, bets: prepared.length, needsReview: anyReview },
    });
    log({ status: "PIPELINE_DONE", needs_review: anyReview });
  } catch (e) {
    console.error(JSON.stringify({
      error_code: "COUPON_PROCESSING_FAILED",
      coupon_id: couponId,
      stage,
      message: e instanceof Error ? e.message : String(e),
    }));
    try {
      const fresh = await getCouponAny(couponId);
      if (fresh?.status === "OCR_PROCESSING") {
        await transition(couponId, "OCR_FAILED", `İşleme hatası (${stage})`);
      } else if (fresh?.status === "AI_PROCESSING") {
        await transition(couponId, "FAILED", `İşleme hatası (${stage})`);
      }
      if (fresh) {
        await notifyMember(fresh.memberId, couponId, "PROCESS_FAILED", "Kupon şu anda işlenemiyor.", "Lütfen tekrar deneyin veya kuponu manuel onaylayın.");
      }
    } catch {
      // durum yazılamadıysa log yeterli
    }
  }
}

export type PipelineCoupon = CouponRow;
