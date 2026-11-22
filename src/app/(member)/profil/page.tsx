import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberDevices } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { PasskeyPanel } from "@/components/passkey-panel";
import { LogoutButton } from "@/components/logout-button";
import { buttonClass, Card, SectionTitle } from "@/components/ui";
import { fmtDateTime, formatPhoneDisplay } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getSessionUser();
  if (!user?.member) redirect("/login");
  const member = user.member;
  const devices = await db.select().from(memberDevices).where(eq(memberDevices.memberId, member.id));
  const isStaff = user.profile.role !== "MEMBER";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Profil</h1>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-xl font-bold text-accent">
            {member.fullName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{member.fullName}</p>
            <p className="font-mono text-sm text-muted">{formatPhoneDisplay(member.phone)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <p className="text-xs text-muted">Üye kodu</p>
            <p className="font-mono font-semibold">{member.memberCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Kayıt tarihi</p>
            <p className="font-mono">{fmtDateTime(member.createdAt)}</p>
          </div>
        </div>
      </Card>

      <PasskeyPanel devices={devices} />

      <Card className="space-y-2 p-4">
        <SectionTitle>Gizlilik</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">
          Adınız ve telefonunuz kişisel veri olarak korunur; yalnızca operasyonel amaçlarla kullanılır. Audit kayıtlarında telefonunuz{" "}
          <span className="font-mono">+90******XXXX</span> biçiminde maskelenir. Kupon görselleriniz özel depoda saklanır; başka üyeler erişemez.
        </p>
        <p className="text-xs text-muted">
          Çalışma modu: <span className="font-mono">{isSupabaseConfigured() ? "Supabase (RLS aktif)" : "Yerel PostgreSQL (demo)"}</span>
        </p>
      </Card>

      {isStaff ? (
        <Link href="/partner" className={buttonClass("secondary", "md", "w-full")}>
          Partner Paneli ({user.profile.role})
        </Link>
      ) : null}

      <LogoutButton />
    </div>
  );
}
