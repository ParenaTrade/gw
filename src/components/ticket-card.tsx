import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";
import type { CouponStatus } from "@/types/database";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate, fmtMoney, fmtOdds, fmtTime } from "@/lib/format";

export type TicketCardData = {
  id: string;
  couponCode: string;
  status: string;
  physicalCouponDate: string | null;
  physicalCouponTime: string | null;
  stakeAmount: string | null;
  printedTotalOdds: string | null;
  acceptedTotalOdds: string | null;
  thumbnailImageId: string | null;
};

/** Termal fiş estetiğinde kupon kartı — delik/çentik + perforasyon. */
export function TicketCard({ coupon }: { coupon: TicketCardData }) {
  return (
    <Link
      href={`/kuponum/${coupon.id}`}
      className="paper group relative block rounded-xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <span className="font-mono text-sm font-semibold tracking-wide">{coupon.couponCode}</span>
        <StatusBadge status={coupon.status as CouponStatus} />
      </div>

      <div className="flex items-center gap-3 px-4 pb-3">
        {coupon.thumbnailImageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/coupons/${coupon.id}/images/${coupon.thumbnailImageId}`}
            alt="Fiziksel kupon görseli"
            className="size-14 shrink-0 rounded-md border border-paper-ink/15 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-md border border-dashed border-paper-ink/25 text-paper-muted">
            <ImageOff className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 text-sm">
          <p className="font-medium">Fiziksel kupon</p>
          <p className="font-mono text-xs text-paper-muted">
            {fmtDate(coupon.physicalCouponDate)} · {fmtTime(coupon.physicalCouponTime)}
          </p>
        </div>
        <ChevronRight className="ml-auto size-5 shrink-0 text-paper-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>

      <div className="relative">
        <span className="notch -left-2.5" aria-hidden />
        <span className="notch -right-2.5" aria-hidden />
        <div className="perforation mx-4" />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 font-mono text-xs">
        <span className="text-paper-muted">
          TUTAR <span className="ml-1 font-semibold text-paper-ink">{fmtMoney(coupon.stakeAmount)}</span>
        </span>
        <span className="text-paper-muted">
          ORAN{" "}
          <span className="ml-1 font-semibold text-paper-ink">
            {fmtOdds(coupon.acceptedTotalOdds ?? coupon.printedTotalOdds)}
          </span>
        </span>
      </div>
    </Link>
  );
}
