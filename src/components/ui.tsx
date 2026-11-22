import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function buttonClass(
  variant: "primary" | "secondary" | "ghost" | "danger" | "paper" = "primary",
  size: "sm" | "md" | "lg" = "md",
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 select-none",
    "disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985] cursor-pointer",
    size === "sm" && "h-9 px-3.5 text-sm",
    size === "md" && "h-12 px-5 text-[15px]",
    size === "lg" && "h-14 px-6 text-base",
    variant === "primary" && "bg-accent text-accent-ink hover:brightness-105 glow-accent",
    variant === "secondary" && "bg-raised text-ink border border-line hover:border-accent/50",
    variant === "ghost" && "bg-transparent text-muted hover:text-ink hover:bg-raised",
    variant === "danger" && "bg-danger/15 text-danger border border-danger/35 hover:bg-danger/25",
    variant === "paper" && "bg-paper-ink text-paper hover:opacity-90",
    className
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "paper";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
  ref?: Ref<HTMLInputElement>;
};

export function Input({ label, error, hint, prefix, className, id, ref, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-muted">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
            {prefix}
          </span>
        ) : null}
        <input ref={ref} id={inputId} className={cn("field", prefix && "pl-14", error && "border-danger/60", className)} {...rest} />
      </div>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)}>{children}</div>;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-xs font-semibold uppercase tracking-[0.14em] text-muted", className)}>
      {children}
    </h2>
  );
}

export function Alert({
  tone = "warn",
  children,
  className,
}: {
  tone?: "warn" | "danger" | "ok" | "info";
  children: ReactNode;
  className?: string;
}) {
  const toneClass = tone === "info" ? "tone-progress" : tone === "ok" ? "tone-ok" : tone === "danger" ? "tone-danger" : "tone-warn";
  return <div className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", toneClass, className)}>{children}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-10 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "neutral", icon }: { label: string; value: ReactNode; tone?: "neutral" | "warn" | "ok" | "danger" | "progress"; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon ? <span className={cn("shrink-0", `tone-${tone}`, "rounded-md border p-1")}>{icon}</span> : null}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </Card>
  );
}

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("grid place-items-center rounded-lg bg-accent text-accent-ink font-mono font-bold", size === "sm" ? "size-7 text-sm" : size === "lg" ? "size-12 text-2xl" : "size-9 text-lg")}>
        K
      </span>
      <span className={cn("font-semibold tracking-tight", size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-xl")}>
        KUponum
      </span>
    </span>
  );
}
