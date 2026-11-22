import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Ana sayfa">
          <Brand />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Geri
        </Link>
      </header>
      <main className="mt-10 flex-1">{children}</main>
      <footer className="pt-10 text-center text-xs text-muted">
        Telefon numaranız yalnızca operasyonel amaçlarla kullanılır ve audit kayıtlarında maskelenir.
      </footer>
    </div>
  );
}
