import Link from "next/link";
import type { Metadata } from "next";
import { Bell, Plus, Ticket } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { listMemberCoupons } from "@/lib/coupons/service";
import { listNotifications } from "@/lib/notifications/service";
import { TicketCard } from "@/components/ticket-card";
import { buttonClass, EmptyState, SectionTitle } from "@/components/ui";
import { fmtDateTime, formatPhoneDisplay } from "@/lib/format";
import { isActiveStatus } from "@/lib/coupons/status";
import type { CouponStatus } from "@/types/database";

export const metadata: Metadata = { title: "Kuponum" };
export const dynamic = "force-dynamic";

export default async function KuponumPage() {
  const user = await getSessionUser();
  if (!user?.member) redirect("/login");
  const member = user.member;

  const [all, notifications] = await Promise.all([
    listMemberCoupons(member.id, "all", 100),
    listNotifications(member.id, 4),
  ]);
  const active = all.filter((c) => isActiveStatus(c.status as CouponStatus));
  const history = all.filter((c) => !isActiveStatus(c.status as CouponStatus));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Merhaba, {member.fullName.split(" ")[0]}</h1>
        <p className="mt-0.5 font-mono text-sm text-muted">{formatPhoneDisplay(member.phone)}</p>
        <Link href="/kuponum/yeni" className={buttonClass("primary", "lg", "mt-5 w-full")}>
          <Plus className="size-5" strokeWidth={2.5} aria-hidden /> YENİ KUPON
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Aktif Kuponlar</SectionTitle>
          <span className="font-mono text-xs text-muted">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <EmptyState
            icon={<Ticket className="size-8" aria-hidden />}
            title="Aktif kuponunuz yok"
            description="Fiziksel kuponunuzu fotoğraflayarak birkaç saniyede dijitalleştirin."
            action={
              <Link href="/kuponum/yeni" className={buttonClass("secondary", "sm")}>
                İlk kuponunu oluştur
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {active.slice(0, 5).map((c) => (
              <TicketCard key={c.id} coupon={c} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Kupon Geçmişi</SectionTitle>
          <Link href="/kuponlarim?filter=history" className="text-xs font-medium text-accent hover:underline">
            Tümü →
          </Link>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Henüz sonuçlanan kupon yok.</p>
        ) : (
          <div className="space-y-4">
            {history.slice(0, 3).map((c) => (
              <TicketCard key={c.id} coupon={c} />
            ))}
          </div>
        )}
      </section>

      {notifications.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Bildirimler</SectionTitle>
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <Bell className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-muted">{n.body}</p> : null}
                  <p className="mt-1 font-mono text-[11px] text-muted">{fmtDateTime(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
