import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { memberLedger, settlements } from "@/db/schema";
import { Alert, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { sumAmounts } from "@/lib/money";

export const metadata: Metadata = { title: "Settlement" };
export const dynamic = "force-dynamic";

export default async function PartnerSettlementsPage() {
  const [rows, ledger] = await Promise.all([
    db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(50),
    db.select().from(memberLedger).orderBy(desc(memberLedger.createdAt)).limit(50),
  ]);
  const totalMember = rows.length ? sumAmounts(rows.map((r) => r.memberAmount)) : "0.00";
  const pending = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settlement ve Ledger</h1>

      <Alert tone="info">
        Settlement engine Faz 6'da aktifleşir (RESULT_CONFIRMED → SETTLEMENT_PENDING → SETTLED). Finansal kayıtlar burada salt-okunur görüntülenir; her kupon için tekil referans ile çift ödeme engellenir. Tutarlar decimal-safe hesaplanır.
      </Alert>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Toplam Üye Tutarı" value={fmtMoney(totalMember)} tone="ok" />
        <Stat label="Settlement" value={rows.length} />
        <Stat label="Bekleyen" value={pending} tone="warn" />
      </div>

      <section className="space-y-3">
        <SectionTitle>Settlement Kayıtları</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState title="Settlement kaydı yok" />
        ) : (
          <div className="space-y-2">
            {rows.map((s) => (
              <Card key={s.id} className="grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted">Referans</p>
                  <p className="font-mono">{s.platformReference}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Üye tutarı</p>
                  <p className="font-mono font-semibold text-ok">{fmtMoney(s.memberAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Durum</p>
                  <p className="font-mono">{s.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Zaman</p>
                  <p className="font-mono text-xs">{fmtDateTime(s.settlementAt)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Üye Ledger Hareketleri</SectionTitle>
        {ledger.length === 0 ? (
          <EmptyState title="Ledger hareketi yok" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="divide-y divide-line">
              {ledger.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-muted">{l.transactionType}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{l.description}</span>
                  <span className={`font-mono font-semibold ${Number(l.amount) >= 0 ? "text-ok" : "text-danger"}`}>
                    {Number(l.amount) >= 0 ? "+" : ""}{fmtMoney(l.amount)}
                  </span>
                  <span className="font-mono text-xs text-muted">bakiye {fmtMoney(l.balanceAfter)}</span>
                  <span className="w-full font-mono text-[11px] text-muted sm:w-auto">{fmtDateTime(l.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
