"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import type { CouponStatus } from "@/types/database";
import { Alert, Button, Card } from "@/components/ui";
import { api, apiPost } from "@/lib/api-client";

/**
 * OCR + AI dijitalleştirme tetikleyicisi. 202 sonrası durum 2 sn'de bir
 * izlenir; sonuçlandığında sunucu bileşenleri yenilenir.
 */
export function ProcessButton({ couponId, status }: { couponId: string; status: CouponStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/coupons/${couponId}/process`);
      router.refresh();
      const startedAt = Date.now();
      timer.current = setInterval(async () => {
        try {
          const data = await api<{ status: CouponStatus }>(`/api/coupons/${couponId}/status`);
          if (data.status !== "OCR_PROCESSING" && data.status !== "AI_PROCESSING") {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            router.refresh();
          } else if (Date.now() - startedAt > 120_000) {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            router.refresh();
          }
        } catch {
          // bir sonraki tick tekrar dener
        }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kupon şu anda işlenemiyor. Lütfen tekrar deneyin.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-accent/30 p-4">
      <div className="flex items-start gap-3">
        <ScanSearch className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{status === "OCR_FAILED" ? "Tekrar dijitalleştir" : "Kuponu dijitalleştir"}</p>
          <p className="mt-1 text-muted">
            OCR kupon metnini çıkarır, AI satırları yapılandırır, takımlar ve oranlar eşleştirilir. Sonucu siz kontrol edersiniz — AI söyledi diye doğru kabul edilmez.
          </p>
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" className="w-full" loading={busy} onClick={() => void start()}>
        {busy ? "İşleniyor… (OCR + AI)" : status === "OCR_FAILED" ? "Tekrar Dijitalleştir" : "Kuponu Dijitalleştir (OCR + AI)"}
      </Button>
    </Card>
  );
}
