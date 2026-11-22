import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Kod Doğrulama" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  if (!phone) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kodu doğrulayın</h1>
        <p className="mt-1 text-sm text-muted">Kod 5 dakika geçerlidir. Ham biyometrik veri hiçbir zaman istenmez.</p>
      </div>
      <Suspense>
        <VerifyForm phone={phone} />
      </Suspense>
    </div>
  );
}
