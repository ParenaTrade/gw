"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, Plus, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Mobil-first üye kabuğu: üst marka + alt navigasyon (orta FAB: yeni kupon). */
export function MemberShell({ children, fullName }: { children: ReactNode; fullName: string }) {
  const pathname = usePathname();
  const item = (href: string, label: string, Icon: typeof Home) => {
    const active = pathname === href || (href !== "/kuponum" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-[11px] font-medium transition-colors",
          active ? "text-accent" : "text-muted hover:text-ink"
        )}
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-28 pt-4 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/kuponum" aria-label="KUponum ana ekran">
          <Brand size="sm" />
        </Link>
        <span className="max-w-[45%] truncate text-sm text-muted" title={fullName}>
          {fullName}
        </span>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-end justify-between px-6 py-1.5">
          {item("/kuponum", "Ana Ekran", Home)}
          {item("/kuponlarim", "Kuponlarım", History)}
          <Link
            href="/kuponum/yeni"
            aria-label="Yeni kupon oluştur"
            className="glow-accent -mt-6 grid size-14 place-items-center rounded-full bg-accent text-accent-ink transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </Link>
          {item("/profil", "Profil", UserRound)}
          <Link
            href="/partner"
            className="hidden flex-col items-center gap-1 rounded-xl px-4 py-2 text-[11px] font-medium text-muted hover:text-ink sm:flex"
          >
            <span className="grid size-5 place-items-center font-mono text-xs">⌘</span>
            Partner
          </Link>
        </div>
      </nav>
    </div>
  );
}
