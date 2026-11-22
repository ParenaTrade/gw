import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coupons, members } from "@/db/schema";
import { EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Üyeler" };
export const dynamic = "force-dynamic";

export default async function PartnerMembersPage() {
  const rows = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      fullName: members.fullName,
      phone: members.phone,
      status: members.status,
      createdAt: members.createdAt,
      couponCount: sql<number>`count(${coupons.id})::int`,
    })
    .from(members)
    .leftJoin(coupons, eq(coupons.memberId, members.id))
    .groupBy(members.id)
    .orderBy(desc(members.createdAt))
    .limit(200);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Üyeler</h1>
      {rows.length === 0 ? (
        <EmptyState title="Üye yok" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[auto_1.2fr_1fr_auto_auto] gap-3 border-b border-line bg-raised px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Kod</span>
            <span>Ad Soyad</span>
            <span>Telefon</span>
            <span className="text-right">Kupon</span>
            <span className="text-right">Kayıt</span>
          </div>
          <div className="divide-y divide-line">
            {rows.map((m) => (
              <div key={m.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[auto_1.2fr_1fr_auto_auto]">
                <span className="font-mono text-xs font-semibold">{m.memberCode}</span>
                <span className="truncate">{m.fullName}</span>
                <span className="font-mono text-xs text-muted">{m.phone}</span>
                <span className="font-mono md:text-right">{m.couponCount}</span>
                <span className="col-span-2 font-mono text-xs text-muted md:col-span-1 md:text-right">{fmtDateTime(m.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Üye kişisel verileri yalnızca yetkili operasyon kapsamında görüntülenir; erişimler denetlenebilir.</p>
    </div>
  );
}
