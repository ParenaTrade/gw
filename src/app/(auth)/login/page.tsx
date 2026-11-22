import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Giriş" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user?.member) redirect("/kuponum");
  if (user) redirect("/partner");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Giriş / Kayıt</h1>
        <p className="mt-1 text-sm text-muted">
          Telefon numaranızı girin. Parmak izi veya Face ID ile giriş yapın; hesabınız yoksa saniyeler içinde oluşturun.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
