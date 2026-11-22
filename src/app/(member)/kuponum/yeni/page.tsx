import type { Metadata } from "next";
import { NewCouponFlow } from "@/components/new-coupon-flow";

export const metadata: Metadata = { title: "Yeni Kupon" };
export const dynamic = "force-dynamic";

export default function YeniKuponPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yeni Kupon</h1>
        <p className="mt-1 text-sm text-muted">
          İddaa formunu kadraja alın. Orijinal görüntü değiştirilemez audit kaydı olarak saklanır.
        </p>
      </div>
      <NewCouponFlow />
    </div>
  );
}
