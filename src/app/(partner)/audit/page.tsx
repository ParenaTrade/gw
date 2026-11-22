import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { Alert, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const AUDIT_ROLES: UserRole[] = ["PARTNER_ADMIN", "AUDITOR", "ADMIN"];

export default async function AuditPage() {
  const user = await getSessionUser();
  if (!user || !AUDIT_ROLES.includes(user.profile.role as UserRole)) {
    return <Alert tone="danger">Audit log yalnızca PARTNER_ADMIN, AUDITOR ve ADMIN rollerine açıktır.</Alert>;
  }

  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
      <Alert tone="info">
        Hassas alanlar maskelenir (telefon +90******XXXX, ad A*** S***); token/secret/kod asla loglanmaz. IP adresleri hash'lenir.
      </Alert>
      {logs.length === 0 ? (
        <EmptyState title="Kayıt yok" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="divide-y divide-line">
            {logs.map((l) => (
              <div key={l.id} className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[auto_1fr_auto_auto]">
                <span className="font-mono text-xs font-semibold text-accent">{l.action}</span>
                <span className="truncate text-muted">
                  {l.entityType}
                  {l.entityId ? <span className="font-mono text-xs"> · {l.entityId.slice(0, 8)}…</span> : null}
                </span>
                <span className="font-mono text-xs text-muted">{l.actorRole}</span>
                <span className="font-mono text-xs text-muted">{fmtDateTime(l.createdAt)}</span>
                {l.ipHash ? (
                  <span className="col-span-2 font-mono text-[10px] text-muted md:col-span-4">ip#{l.ipHash.slice(0, 12)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
