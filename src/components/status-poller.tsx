"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import type { CouponStatus } from "@/types/database";
import { RESULT_STATUSES, TERMINAL_STATUSES } from "@/lib/coupons/status";
import { api } from "@/lib/api-client";

/** Aktif kuponlarda hafif durum takibi — değişimde sunucu bileşenleri yenilenir. */
export function StatusPoller({ couponId, initialStatus }: { couponId: string; initialStatus: CouponStatus }) {
  const router = useRouter();
  const last = useRef(initialStatus);
  const [live, setLive] = useState(false);
  const terminal = TERMINAL_STATUSES.includes(initialStatus) || RESULT_STATUSES.includes(initialStatus);

  useEffect(() => {
    if (terminal) return;
    let active = true;
    const tick = async () => {
      try {
        const data = await api<{ status: CouponStatus }>(`/api/coupons/${couponId}/status`);
        if (!active) return;
        setLive(true);
        if (data.status !== last.current) {
          last.current = data.status;
          router.refresh();
        }
      } catch {
        // sessiz: bir sonraki tick tekrar dener
      }
    };
    const interval = setInterval(() => void tick(), 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [couponId, router, terminal]);

  if (terminal) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="Durum 8 saniyede bir güncellenir">
      <Radio className={live ? "size-3.5 text-ok" : "size-3.5"} aria-hidden />
      Canlı takip
    </span>
  );
}
