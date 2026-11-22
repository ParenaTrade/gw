import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
  Send,
  Trophy,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import type { CouponStatus } from "@/types/database";
import { STATUS_META, type StatusIcon } from "@/lib/coupons/status";
import { cn } from "@/lib/utils";

const ICONS: Record<StatusIcon, typeof Clock3> = {
  file: FileText,
  upload: Upload,
  scan: ScanLine,
  loader: Loader2,
  eye: Eye,
  check: CheckCircle2,
  send: Send,
  clock: Clock3,
  alert: AlertTriangle,
  trophy: Trophy,
  x: XCircle,
  wallet: Wallet,
  refresh: RefreshCw,
};

/** Status asla yalnızca renkle ifade edilmez: icon + label + açıklama. */
export function StatusBadge({ status, className, title }: { status: CouponStatus; className?: string; title?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        `tone-${meta.tone}`,
        className
      )}
      title={title === false ? undefined : meta.description}
    >
      <Icon className={cn("size-3.5", meta.icon === "loader" && "animate-spin")} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StatusBanner({ status }: { status: CouponStatus }) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3.5", `tone-${meta.tone}`)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", meta.icon === "loader" && "animate-spin")} aria-hidden />
      <div>
        <p className="font-semibold leading-tight">{meta.label}</p>
        <p className="mt-0.5 text-sm opacity-85">{meta.description}</p>
      </div>
    </div>
  );
}
