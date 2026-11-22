import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ImageOff, ScanSearch } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getCouponDetail } from "@/lib/coupons/service";
import { STATUS_META } from "@/lib/coupons/status";
import type { CouponStatus } from "@/types/database";
import { StatusBadge, StatusBanner } from "@/components/status-badge";
import { StatusPoller } from "@/components/status-poller";
import { ApprovePanel } from "@/components/approve-panel";
import { ProcessButton } from "@/components/process-button";
import { BetEditor } from "@/components/bet-editor";
import { Alert, Card, EmptyState, SectionTitle } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtMoney, fmtOdds, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

export default async function CouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user?.member) redirect("/login");

  const detail = await getCouponDetail(id);
  if (!detail || detail.coupon.memberId !== user.member.id) notFound();
  const { coupon, images, bets, history, settlements, ledger, snapshots, ocr, aiParse } = detail;
  const status = coupon.status as CouponStatus;
  const original = images.find((i) => i.imageType === "original");
  const processing = status === "OCR_PROCESSING" || status === "AI_PROCESSING";
  const editable = status === "NEEDS_REVIEW" || status === "READY_FOR_MEMBER_APPROVAL";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/kuponum" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Ana Ekran
        </Link>
        <StatusPoller couponId={coupon.id} initialStatus={status} />
      </div>

      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{coupon.couponCode}</h1>
          <StatusBadge status={status} />
        </div>
        <StatusBanner status={status} />
      </header>

      {processing ? (
        <Alert tone="info">
          <span className="inline-flex items-center gap-2 font-semibold">
            <ScanSearch className="size-4 animate-pulse" aria-hidden /> Kuponunuz işleniyor…
          </span>
          <p className="mt-1">OCR metni çıkarıyor, AI satırları yapılandırıyor. Bu sayfa otomatik güncellenir.</p>
        </Alert>
      ) : null}

      {status === "UPLOADED" || status === "OCR_FAILED" ? (
        <ProcessButton couponId={coupon.id} status={status} />
      ) : null}

      {/* Fiziksel kupon — orijinal görsel */}
      <section className="space-y-3">
        <SectionTitle>Fiziksel Kupon</SectionTitle>
        {original ? (
          <a
            href={`/api/coupons/${coupon.id}/images/${original.id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-2xl border border-line bg-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/coupons/${coupon.id}/images/${original.id}`}
              alt="Fiziksel kuponun orijinal fotoğrafı"
              className="max-h-[60vh] w-full object-contain"
            />
          </a>
        ) : (
          <EmptyState icon={<ImageOff className="size-8" aria-hidden />} title="Görsel yok" description="Bu kupon için orijinal fotoğraf yüklenmemiş." />
        )}
      </section>

      {status === "READY_FOR_MEMBER_APPROVAL" ? (
        <ApprovePanel couponId={coupon.id} approvalVersion={coupon.approvalVersion} />
      ) : null}
      {status === "UPLOADED" ? (
        <details className="rounded-2xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            Dijitalleştirmeden manuel onayla (fotoğrafı kendim kontrol ettim)
          </summary>
          <div className="mt-3">
            <ApprovePanel couponId={coupon.id} approvalVersion={coupon.approvalVersion} />
          </div>
        </details>
      ) : null}

      {/* OCR + AI şeffaflık kartı */}
      {ocr ? (
        <Card className="p-4">
          <SectionTitle className="mb-2">Dijitalleştirme Kaydı</SectionTitle>
          <div className="divide-y divide-line">
            <TimeRow label="OCR motoru" value={ocr.engine} />
            <TimeRow label="OCR güveni" value={`%${Math.round(Number(ocr.confidence ?? 0) * 100)}`} />
            <TimeRow label="OCR süresi" value={`${ocr.processingTimeMs ?? 0} ms`} />
            {aiParse ? <TimeRow label="Ayrıştırıcı" value={`${aiParse.model} · ${aiParse.promptVersion}`} /> : null}
          </div>
          {ocr.rawText ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted hover:text-ink">OCR ham metni (denetlenebilir)</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-bg p-3 font-mono text-xs leading-relaxed text-muted">{ocr.rawText}</pre>
            </details>
          ) : null}
        </Card>
      ) : null}

      {/* Zaman zinciri */}
      <Card className="p-4">
        <SectionTitle className="mb-2">Zaman Kayıtları</SectionTitle>
        <div className="divide-y divide-line">
          <TimeRow label="Fiziksel kupon" value={`${fmtDate(coupon.physicalCouponDate)} ${fmtTime(coupon.physicalCouponTime)}`} />
          <TimeRow label="KUponum'a gönderildi" value={fmtDateTime(coupon.uploadedAt)} />
          <TimeRow label="AI işleme" value={fmtDateTime(coupon.aiProcessedAt)} />
          <TimeRow label="Üye onayı" value={fmtDateTime(coupon.memberApprovedAt)} />
          <TimeRow label="Partner işlemi" value={fmtDateTime(coupon.partnerReceivedAt)} />
          <TimeRow label="Platform işlemi" value={fmtDateTime(coupon.platformProcessedAt)} />
          {coupon.resultUpdatedAt ? <TimeRow label="Sonuç güncellemesi" value={fmtDateTime(coupon.resultUpdatedAt)} /> : null}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle className="mb-2">Tutar ve Oranlar</SectionTitle>
        <div className="divide-y divide-line">
          <TimeRow label="Tutar" value={fmtMoney(coupon.stakeAmount)} />
          <TimeRow label="Basılı toplam oran" value={fmtOdds(coupon.printedTotalOdds)} />
          <TimeRow label="İşlem sırasındaki oran" value={fmtOdds(coupon.acceptedTotalOdds)} />
          <TimeRow label="Potansiyel getiri" value={fmtMoney(coupon.potentialReturn)} />
        </div>
      </Card>

      {snapshots.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Oran Değişikliği Kayıtları</SectionTitle>
          {snapshots.map((s) => (
            <div key={s.id} className="tone-warn rounded-xl border px-4 py-3 text-sm">
              <p className="font-semibold">Basılı oran {fmtOdds(s.printedOdds)} → görülen oran {fmtOdds(s.observedOdds)}</p>
              <p className="mt-0.5 font-mono text-xs opacity-80">
                {fmtDateTime(s.observedAt)} · kaynak: {s.source} · eski oran korunur
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {/* Bahis satırları — üye kontrolü */}
      <section className="space-y-3">
        <SectionTitle>Kupon Satırları</SectionTitle>
        {status === "NEEDS_REVIEW" ? (
          <Alert tone="warn">
            İşaretli satırları düzeltin veya doğrulayın. Tüm satırlar temizlendiğinde <span className="font-semibold">KUPONU ONAYLA</span> adımı açılır.
          </Alert>
        ) : null}
        {bets.length === 0 ? (
          <EmptyState
            title={processing ? "Satırlar çıkarılıyor…" : "Henüz dijital satır yok"}
            description={
              processing
                ? "OCR + AI hattı kupon satırlarını yapılandırıyor."
                : "Dijitalleştirme çalıştırın veya kuponu fotoğrafla birlikte manuel onaylayın."
            }
          />
        ) : (
          <div className="space-y-2">
            {bets.map((b) => (
              <BetEditor key={`${b.id}-${b.updatedAt}`} couponId={coupon.id} bet={b} editable={editable} />
            ))}
          </div>
        )}
      </section>

      {settlements.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Ödeme Kaydı</SectionTitle>
          {settlements.map((s) => (
            <Card key={s.id} className="p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Üye tutarı</span>
                <span className="font-mono font-semibold text-ok">{fmtMoney(s.memberAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Settlement zamanı</span>
                <span className="font-mono">{fmtDateTime(s.settlementAt)}</span>
              </div>
            </Card>
          ))}
          {ledger.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              <div>
                <p className="font-mono text-xs text-muted">{l.transactionType}</p>
                <p className="text-muted">{l.description}</p>
              </div>
              <span className={`font-mono font-semibold ${Number(l.amount) >= 0 ? "text-ok" : "text-danger"}`}>
                {Number(l.amount) >= 0 ? "+" : ""}{fmtMoney(l.amount)}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Durum Geçmişi</SectionTitle>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[26px] top-1 size-2.5 rounded-full bg-accent/70" aria-hidden />
              <p className="text-sm font-medium">
                {STATUS_META[h.newStatus as CouponStatus]?.label ?? h.newStatus}
              </p>
              {h.reason ? <p className="text-xs text-muted">{h.reason}</p> : null}
              <p className="mt-0.5 font-mono text-[11px] text-muted">{fmtDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
