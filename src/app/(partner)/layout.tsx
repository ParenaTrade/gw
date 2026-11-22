import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { PartnerShell } from "@/components/partner-shell";
import { Brand, buttonClass, Card } from "@/components/ui";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

const STAFF: UserRole[] = ["PARTNER_ADMIN", "OPERATOR", "AUDITOR", "ADMIN"];

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fpartner");

  const role = user.profile.role as UserRole;
  if (!STAFF.includes(role)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5">
        <Brand />
        <Card className="w-full space-y-4 p-6 text-center">
          <p className="font-semibold">Yetkisiz erişim</p>
          <p className="text-sm text-muted">
            Partner paneli yalnızca PARTNER_ADMIN, OPERATOR, AUDITOR ve ADMIN rollerine açıktır. Bu denetim kayıtlarına işlenir.
          </p>
          <Link href="/kuponum" className={buttonClass("primary", "md", "w-full")}>
            Üye Ekranına Dön
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <PartnerShell role={role} canAudit={role === "PARTNER_ADMIN" || role === "AUDITOR" || role === "ADMIN"}>
      {children}
    </PartnerShell>
  );
}
