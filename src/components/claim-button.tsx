"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { apiPost } from "@/lib/api-client";

/** Operatör atomic claim — eşzamanlı ikinci deneme 409 alır. */
export function ClaimButton({ couponId }: { couponId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/partner/coupons/${couponId}/process`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kupon işleme alınamadı.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" className="w-full" loading={busy} onClick={() => void claim()}>
        <PlayCircle className="size-5" aria-hidden /> Kuponu İşleme Al
      </Button>
      <p className="text-xs text-muted">
        İşleme alma atomiktir: başka bir operatör aynı anda kuponu alamaz. Bu işlem audit log'a kaydedilir.
      </p>
    </div>
  );
}
