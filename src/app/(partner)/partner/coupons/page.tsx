import Link from "next/link";
import type { Metadata } from "next";
import { listPartnerCoupons } from "@/lib/coupons/service";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { COUPON_STATUSES, STATUS_META } from "@/lib/coupons/status";
import type { CouponStatus } from "@/types/database";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Partner Kuponları" };
export const dynamic = "force-dynamic";

const TABS: { key: CouponStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tümü" },
  { key: "PARTNER_QUEUE", label: "Yeni / Kuyruk" },
  { key: "PARTNER_PROCESSING", label: "İşleme Alınan" },
  { key: "ODDS_CHANGED", label: "Oran Değişen" },
  { key: "ACCEPTED", label: "Oynanan" },
  { key: "RESULT_PENDING", label: "Sonuç Bekleyen" },
  { key: "WON", label: "Kazanan" },
  { key: "LOST", label: "Kaybeden" },
  { key: "SETTLED", label: "Settled" },
  { key: "FAILED", label: "Hatalı" },
];

export default async function PartnerCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = COUPON_STATUSES.includes(raw as CouponStatus) ? (raw as CouponStatus) : undefined;
  const coupons = await listPartnerCoupons(status, 200);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Kuponlar</h1>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = t.key === "ALL" ? !status : status === t.key;
          const href = t.key === "ALL" ? "/partner/coupons" : `/partner/coupons?status=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface text-muted hover:text-ink"
              )}
              title={t.key !== "ALL" ? STATUS_META[t.key].description : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {coupons.length === 0 ? (
        <EmptyState title="Kupon yok" description="Bu filtrede kupon bulunamadı." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr_auto_auto] gap-3 border-b border-line bg-raised px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Kupon</span>
            <span>Üye</span>
            <span>Durum</span>
            <span className="text-right">Tutar</span>
            <span className="text-right">Yükleme</span>
          </div>
          <div className="divide-y divide-line bg-surface">
            {coupons.map((c) => (
              <Link
                key={c.id}
                href={`/partner/coupons/${c.id}`}
                className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-raised md:grid-cols-[1fr_1.2fr_1fr_auto_auto]"
              >
                <span className="font-mono text-sm font-semibold">{c.couponCode}</span>
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{c.memberName}</span>
                  <span className="block truncate font-mono text-xs text-muted">{c.memberPhone}</span>
                </span>
                <span><StatusBadge status={c.status as CouponStatus} /></span>
                <span className="font-mono text-sm md:text-right">{fmtMoney(c.stakeAmount)}</span>
                <span className="col-span-2 font-mono text-xs text-muted md:col-span-1 md:text-right">{fmtDateTime(c.uploadedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
