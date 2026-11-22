import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { MemberShell } from "@/components/member-shell";
import { Brand, buttonClass, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!user.member) {
    // Partner/staff hesabı üye alanına girdi — yetki ayrımı net gösterilir.
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5">
        <Brand />
        <Card className="w-full space-y-4 p-6 text-center">
          <p className="font-semibold">Bu alan üye hesabı gerektirir</p>
          <p className="text-sm text-muted">
            Hesabınız <span className="font-mono">{user.profile.role}</span> rolünde. Üye kupon alanı yerine partner panelini kullanın.
          </p>
          <Link href="/partner" className={buttonClass("primary", "md", "w-full")}>
            Partner Paneline Git
          </Link>
        </Card>
      </div>
    );
  }

  return <MemberShell fullName={user.member.fullName}>{children}</MemberShell>;
}
