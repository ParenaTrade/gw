import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Camera, Lock, ScanSearch, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { Brand, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Camera, title: "Fotoğrafla", desc: "Fiziksel İddaa kuponunu telefon kameranla çek." },
  { icon: ScanSearch, title: "Doğrula", desc: "OCR + AI kuponu dijitalleştirir; her satır kontrol edilir." },
  { icon: ShieldCheck, title: "Onayla", desc: "Kuponunu gör, düzelt, KUPONU ONAYLA. Onay anın kayıt altına alınır." },
  { icon: Building2, title: "Takip et", desc: "Yetkili partner operasyonu işler; sonuç ve ödeme şeffaf kaydedilir." },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user?.member) redirect("/kuponum");
  if (user) redirect("/partner");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href="/login" className={buttonClass("ghost", "sm")}>
          Giriş
        </Link>
      </header>

      <section className="mt-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Kupon yönetim sistemi</p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          Fiziksel kuponunuz,
          <br />
          <span className="text-accent">dijital güvence</span> altında.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Kuponunuzu fotoğraflayın; OCR + AI doğrulasın, siz onaylayın, yetkili partner operasyonu işleme alsın. Her adım zaman damgalı ve denetlenebilir.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
            Telefon ile Giriş Yap
          </Link>
          <Link href="/login?next=%2Fpartner" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
            Partner Girişi
          </Link>
        </div>
      </section>

      {/* Termal fiş illüstrasyonu */}
      <section className="mx-auto mt-12 w-full max-w-sm">
        <div className="paper rotate-[-1.5deg] rounded-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between px-5 pt-4 font-mono text-xs">
            <span className="font-semibold">CPN-000123</span>
            <span className="tone-ok rounded-full border px-2 py-0.5 font-sans text-[11px] font-semibold">✓ Oynandı</span>
          </div>
          <div className="space-y-1.5 px-5 py-4 font-mono text-[13px]">
            <p className="flex justify-between"><span>Fenerbahçe — Galatasaray</span><span className="font-semibold">1.85</span></p>
            <p className="flex justify-between"><span>Barcelona — Real Madrid</span><span className="font-semibold">3.40</span></p>
            <p className="flex justify-between"><span>Liverpool — Arsenal</span><span className="font-semibold">1.72</span></p>
          </div>
          <div className="relative">
            <span className="notch -left-2.5" aria-hidden />
            <span className="notch -right-2.5" aria-hidden />
            <div className="perforation mx-5" />
          </div>
          <div className="flex justify-between px-5 py-3 font-mono text-xs text-paper-muted">
            <span>TOPLAM ORAN <span className="font-semibold text-paper-ink">10.82</span></span>
            <span>22.11.2026 18:32</span>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent">
                <s.icon className="size-5" aria-hidden />
              </span>
              <p className="font-semibold">
                <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}.</span>
                {s.title}
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-accent" aria-hidden />
          <p className="text-sm font-semibold">Güvenlik mimarisi</p>
        </div>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-3">
          <li>• RLS ile üye verisi izolasyonu</li>
          <li>• Değiştirilemez orijinal görsel + audit kaydı</li>
          <li>• Yalnızca yetkili platform entegrasyonu</li>
        </ul>
      </section>

      <footer className="mt-auto pt-12 text-center text-xs leading-relaxed text-muted">
        <p>
          KUponum bir kupon yönetim ve takip sistemidir. Bahis işlemleri yalnızca yetkili partner operasyonları ve platformların resmî izin verdiği entegrasyon yöntemleri kapsamında yürütülür.
        </p>
        <p className="mt-2">18+ · Sorumlu oyun oynayın. Hukuki metinler ilgili mevzuat ve partner sözleşmelerine göre hazırlanır.</p>
      </footer>
    </main>
  );
}
