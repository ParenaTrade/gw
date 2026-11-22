import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Loader2, Trophy, Wallet, XCircle } from "lucide-react";
import { getPartnerStats, listPartnerCoupons } from "@/lib/coupons/service";
import { Stat, SectionTitle, EmptyState, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { fmtDateTime, fmtMoney, maskPhone } from "@/lib/format";
import type { CouponStatus } from "@/types/database";

export const metadata: Metadata = { title: "Partner Panel" };
export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const [stats, queue] = await Promise.all([getPartnerStats(), listPartnerCoupons("PARTNER_QUEUE", 5)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Operasyon Paneli</h1>
        <Link href="/partner/coupons?status=PARTNER_QUEUE" className={buttonClass("primary", "sm")}>
          Kuyruğu Aç ({stats.pending})
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugünkü Kuponlar" value={stats.today} icon={<CalendarDays className="size-4" aria-hidden />} />
        <Stat label="Bekleyen" value={stats.pending} tone="progress" icon={<Clock3 className="size-4" aria-hidden />} />
        <Stat label="İşlemde" value={stats.processing} tone="progress" icon={<Loader2 className="size-4" aria-hidden />} />
        <Stat label="Oynanan" value={stats.played} tone="ok" icon={<CheckCircle2 className="size-4" aria-hidden />} />
        <Stat label="Oran Değişen" value={stats.oddsChanged} tone="warn" icon={<AlertTriangle className="size-4" aria-hidden />} />
        <Stat label="Sonuç Bekleyen" value={stats.resultPending} tone="progress" icon={<Clock3 className="size-4" aria-hidden />} />
        <Stat label="Kazanan" value={stats.won} tone="ok" icon={<Trophy className="size-4" aria-hidden />} />
        <Stat label="Kaybeden" value={stats.lost} tone="danger" icon={<XCircle className="size-4" aria-hidden />} />
        <Stat label="Settlement Bekleyen" value={stats.settlementPending} tone="warn" icon={<Wallet className="size-4" aria-hidden />} />
        <Stat label="Hatalı / Red" value={stats.failed} tone="danger" icon={<AlertTriangle className="size-4" aria-hidden />} />
        <Stat label="Settled" value={stats.settled} tone="ok" icon={<Wallet className="size-4" aria-hidden />} />
        <Stat label="Toplam" value={stats.total} />
      </div>

      <section className="space-y-3">
        <SectionTitle>Partner Kuyruğu — Yeni Kuponlar</SectionTitle>
        {queue.length === 0 ? (
          <EmptyState title="Kuyruk boş" description="Onaylanmış yeni kupon bulunmuyor." />
        ) : (
          <div className="space-y-2">
            {queue.map((c) => (
              <Link
                key={c.id}
                href={`/partner/coupons/${c.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent/40"
              >
                <span className="font-mono text-sm font-semibold">{c.couponCode}</span>
                <span className="text-sm text-muted">{c.memberName}</span>
                <span className="font-mono text-xs text-muted">{maskPhone(c.memberPhone)}</span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">{fmtMoney(c.stakeAmount)}</span>
                  <StatusBadge status={c.status as CouponStatus} />
                </span>
                <span className="w-full font-mono text-[11px] text-muted sm:w-auto">{fmtDateTime(c.uploadedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
