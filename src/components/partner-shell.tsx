"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/partner", label: "Panel" },
  { href: "/partner/coupons", label: "Kuponlar" },
  { href: "/partner/members", label: "Üyeler" },
  { href: "/partner/settlements", label: "Settlement" },
];

export function PartnerShell({ children, role, canAudit }: { children: ReactNode; role: string; canAudit: boolean }) {
  const pathname = usePathname();
  const items = canAudit ? [...NAV, { href: "/audit", label: "Audit" }] : NAV;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16 pt-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/partner" aria-label="Partner paneli">
            <Brand size="sm" />
          </Link>
          <span className="tone-progress rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold">{role}</span>
        </div>
        <div className="w-32">
          <LogoutButton />
        </div>
      </header>

      <nav className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {items.map((item) => {
          const active = item.href === "/partner" ? pathname === "/partner" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="mt-6">{children}</main>
    </div>
  );
}
