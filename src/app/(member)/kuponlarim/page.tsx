import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { listMemberCoupons } from "@/lib/coupons/service";
import { TicketCard } from "@/components/ticket-card";
import { buttonClass, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kuponlarım" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "active", label: "Aktif" },
  { key: "history", label: "Geçmiş" },
] as const;

export default async function KuponlarimPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getSessionUser();
  if (!user?.member) redirect("/login");
  const { filter: raw } = await searchParams;
  const filter = FILTERS.some((f) => f.key === raw) ? (raw as (typeof FILTERS)[number]["key"]) : "all";
  const coupons = await listMemberCoupons(user.member.id, filter, 100);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Kuponlarım</h1>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/kuponlarim?filter=${f.key}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-accent bg-accent/15 text-accent"
                : "border-line bg-surface text-muted hover:text-ink"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {coupons.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-8" aria-hidden />}
          title="Kupon bulunamadı"
          description="Bu filtrede kupon yok. Yeni bir kupon oluşturabilirsiniz."
          action={
            <Link href="/kuponum/yeni" className={buttonClass("secondary", "sm")}>
              Yeni kupon
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {coupons.map((c) => (
            <TicketCard key={c.id} coupon={c} />
          ))}
        </div>
      )}
    </div>
  );
}
