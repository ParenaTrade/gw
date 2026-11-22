import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getCouponDetail } from "@/lib/coupons/service";
import { writeAudit } from "@/lib/audit/log";
import { getClientIp } from "@/lib/security/api";
import { headers } from "next/headers";
import { StatusBadge, StatusBanner } from "@/components/status-badge";
import { ClaimButton } from "@/components/claim-button";
import { Alert, Card, EmptyState, SectionTitle } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtMoney, fmtOdds, fmtTime } from "@/lib/format";
import { marketLabel } from "@/lib/coupons/markets";
import { STATUS_META } from "@/lib/coupons/status";
import type { CouponStatus } from "@/types/database";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

export default async function PartnerCouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const detail = await getCouponDetail(id);
  if (!detail) notFound();
  const { coupon, images, bets, history, snapshots } = detail;
  const [member] = await db.select().from(members).where(eq(members.id, coupon.memberId)).limit(1);
  const status = coupon.status as CouponStatus;
  const original = images.find((i) => i.imageType === "original");

  // Operatör görüntülemesi audit log'a kaydedilir (gereksinim 36).
  const hdrs = await headers();
  await writeAudit({
    actorId: user.identity.id,
    actorRole: user.profile.role,
    action: "PARTNER_COUPON_VIEW",
    entityType: "coupon",
    entityId: coupon.id,
    after: { view: "partner_detail", couponCode: coupon.couponCode },
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent: hdrs.get("user-agent"),
  });

  return (
    <div className="space-y-6">
      <Link href="/partner/coupons" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Kupon listesi
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold tracking-tight">{coupon.couponCode}</h1>
        <StatusBadge status={status} />
      </header>
      <StatusBanner status={status} />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="p-4">
            <SectionTitle className="mb-2">Üye</SectionTitle>
            <div className="divide-y divide-line">
              <Row label="Ad Soyad" value={member?.fullName ?? "—"} />
              <Row label="Telefon" value={member?.phone ?? "—"} />
              <Row label="Üye kodu" value={member?.memberCode ?? "—"} />
            </div>
          </Card>

          <section className="space-y-2">
            <SectionTitle>Fiziksel Kupon (orijinal)</SectionTitle>
            {original ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/coupons/${coupon.id}/images/${original.id}`}
                alt="Fiziksel kupon orijinal görseli"
                className="max-h-[55vh] w-full rounded-2xl border border-line bg-black object-contain"
              />
            ) : (
              <EmptyState title="Görsel yok" />
            )}
            {original ? (
              <p className="font-mono text-[11px] break-all text-muted">SHA-256: {original.sha256}</p>
            ) : null}
          </section>

          {status === "PARTNER_QUEUE" ? <ClaimButton couponId={coupon.id} /> : null}
          {status === "PARTNER_PROCESSING" ? (
            <Alert tone="info">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-4" aria-hidden /> Platform hazırlığı — Faz 5
              </p>
              <p className="mt-1">
                Gerçek para ile işlem yalnızca platformun resmî izin verdiği entegrasyon (OneXBetAdapter) ve yetkili partner operasyonu kapsamında yapılır. Gizli bot, hesap paylaşımı veya güvenlik atlatma mekanizması geliştirilmez.
              </p>
            </Alert>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <SectionTitle className="mb-2">Zaman Zinciri</SectionTitle>
            <div className="divide-y divide-line">
              <Row label="Fiziksel kupon" value={`${fmtDate(coupon.physicalCouponDate)} ${fmtTime(coupon.physicalCouponTime)}`} />
              <Row label="Üye gönderdi" value={fmtDateTime(coupon.uploadedAt)} />
              <Row label="Üye onayı" value={fmtDateTime(coupon.memberApprovedAt)} />
              <Row label="Partner aldı" value={fmtDateTime(coupon.partnerReceivedAt)} />
              <Row label="Platform işlemi" value={fmtDateTime(coupon.platformProcessedAt)} />
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-2">Tutar / Oran</SectionTitle>
            <div className="divide-y divide-line">
              <Row label="Tutar" value={fmtMoney(coupon.stakeAmount)} />
              <Row label="Basılı toplam oran" value={fmtOdds(coupon.printedTotalOdds)} />
              <Row label="Kabul edilen oran" value={fmtOdds(coupon.acceptedTotalOdds)} />
              <Row label="Potansiyel getiri" value={fmtMoney(coupon.potentialReturn)} />
              <Row label="Platform referansı" value={coupon.platformTransactionId ?? "—"} />
            </div>
          </Card>

          <section className="space-y-2">
            <SectionTitle>Bahis Satırları</SectionTitle>
            {bets.length === 0 ? (
              <EmptyState title="Satır yok" description="OCR + AI hattı Faz 2'de devreye girer; görsel manuel işlenir." />
            ) : (
              bets.map((b) => (
                <Card key={b.id} className="p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted">{b.rowNumber}.</span>
                      {b.homeTeam} — {b.awayTeam}
                    </p>
                    <span className="font-mono text-xs">{marketLabel(b.market, b.selection)}</span>
                  </div>
                  <div className="mt-2 flex gap-5 font-mono text-xs text-muted">
                    <span>Basılı <span className="text-ink">{fmtOdds(b.printedOdds)}</span></span>
                    <span>Güncel <span className="text-ink">{fmtOdds(b.matchedOdds)}</span></span>
                    {b.needsReview ? <span className="tone-warn rounded border px-1.5 font-sans">⚠ kontrol</span> : null}
                  </div>
                </Card>
              ))
            )}
            {snapshots.map((s) => (
              <div key={s.id} className="tone-warn rounded-xl border px-3.5 py-2.5 text-xs">
                Oran değişimi: {fmtOdds(s.printedOdds)} → {fmtOdds(s.observedOdds)} · {fmtDateTime(s.observedAt)} · {s.source}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <SectionTitle>Durum Geçmişi</SectionTitle>
            <ol className="space-y-2">
              {[...history].reverse().map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{STATUS_META[h.newStatus as CouponStatus]?.label ?? h.newStatus}</span>
                  <span className="font-mono text-xs text-muted">{fmtDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <p className="text-xs text-muted">Bu görüntüleme audit log'a kaydedildi. Üye kişisel verileri yalnızca operasyonel amaçla gösterilir.</p>
    </div>
  );
}
