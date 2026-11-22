"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { apiPost } from "@/lib/api-client";

/**
 * KUPONU ONAYLA — üye açık kontrol + idempotency key.
 * Onay anı member_approved_at olarak kalıcı kayda geçer.
 */
export function ApprovePanel({ couponId, approvalVersion }: { couponId: string; approvalVersion: number }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        `/api/coupons/${couponId}/approve`,
        { confirmed: true },
        { "Idempotency-Key": `${couponId}:approval:v${approvalVersion}` }
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kupon şu anda işlenemiyor. Lütfen tekrar deneyin.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 border-accent/30 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">Kuponunuzu kontrol edin ve onaylayın</p>
          <p className="mt-1 text-muted">
            Onayladığınız anda kupon yetkili partner operasyonuna iletilir. Onay zamanınız operasyonel kayıt olarak saklanır ve sonradan değiştirilemez.
          </p>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 size-4 accent-[#b9f14e]"
        />
        Fiziksel kuponumu ve fotoğrafı kontrol ettim; bilgiler doğru.
      </label>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" className="w-full" disabled={!checked} loading={busy} onClick={() => void approve()}>
        KUPONU ONAYLA
      </Button>
    </Card>
  );
}
