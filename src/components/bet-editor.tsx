"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCheck, PencilLine } from "lucide-react";
import type { CouponBetRow } from "@/db/schema";
import { Alert, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/api-client";
import { fmtOdds } from "@/lib/format";
import { marketDisplay, MARKET_OPTIONS } from "@/lib/normalization/markets";

const formSchema = z.object({
  homeTeam: z.string().trim().min(2, "En az 2 karakter.").max(60),
  awayTeam: z.string().trim().min(2, "En az 2 karakter.").max(60),
  league: z.string().trim().max(60).optional(),
  marketInput: z.string().trim().min(1, "Market girin (örn. MS 1).").max(40),
  printedOdds: z
    .string()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Oran biçimi geçersiz (örn. 1.85).")
    .or(z.literal(""))
    .optional(),
});
type BetForm = z.infer<typeof formSchema>;

/**
 * Üye kontrol ekranı satırı: eşleşme durumu + güven + düzenleme.
 * "Doğru, onayla" yalnızca eşleşme >= 0.80 iken inceleme bayrağını temizler.
 */
export function BetEditor({ couponId, bet, editable }: { couponId: string; bet: CouponBetRow; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketText = bet.selection === "UNKNOWN" ? bet.market : marketDisplay(bet.market, bet.selection);
  const form = useForm<BetForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeTeam: bet.homeTeam,
      awayTeam: bet.awayTeam,
      league: bet.league ?? "",
      marketInput: marketText,
      printedOdds: bet.printedOdds ?? "",
    },
  });

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/coupons/${couponId}/bets/${bet.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Satır güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  const save = form.handleSubmit((values) =>
    patch({
      homeTeam: values.homeTeam,
      awayTeam: values.awayTeam,
      league: values.league || undefined,
      marketInput: values.marketInput,
      printedOdds: values.printedOdds || undefined,
    })
  );

  const quickConfirm = () =>
    patch({
      homeTeam: bet.homeTeam,
      awayTeam: bet.awayTeam,
      league: bet.league ?? undefined,
      marketInput: marketText,
      printedOdds: bet.printedOdds ?? undefined,
      confirmMatch: true,
    });

  const drift = bet.matchedOdds !== null && bet.printedOdds !== null && bet.matchedOdds !== bet.printedOdds;
  const reviewHint = !bet.eventId
    ? "Eşleşme bulunamadı — takım adlarını kontrol edin."
    : drift
      ? `Oran değişti: basılı ${fmtOdds(bet.printedOdds)}, güncel ${fmtOdds(bet.matchedOdds)}. Doğrulayın veya düzeltin.`
      : bet.needsReview
        ? "Bu satır manuel kontrol gerektiriyor."
        : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="mr-2 font-mono text-xs text-muted">{bet.rowNumber}.</span>
            {bet.homeTeam} — {bet.awayTeam}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {bet.league ? `${bet.league} · ` : ""}
            <span className="font-mono">{marketText}</span>
            {bet.eventId ? <span className="ml-2 font-mono text-[11px] text-muted">#{bet.eventId}</span> : null}
          </p>
        </div>
        {bet.needsReview ? (
          <span className="tone-warn shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">⚠ Kontrol</span>
        ) : (
          <span className="tone-ok shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">✓ Eşleşti</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted">
        <span>Basılı <span className="text-ink">{fmtOdds(bet.printedOdds)}</span></span>
        <span>Güncel <span className={drift ? "text-warn" : "text-ink"}>{fmtOdds(bet.matchedOdds)}</span></span>
        {bet.eventConfidence ? <span>Eşleşme %{Math.round(Number(bet.eventConfidence) * 100)}</span> : null}
        {bet.aiConfidence ? <span>AI %{Math.round(Number(bet.aiConfidence) * 100)}</span> : null}
      </div>

      {bet.needsReview && reviewHint ? <p className="mt-2 text-xs text-warn">{reviewHint}</p> : null}
      {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}

      {editable && !editing ? (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <PencilLine className="size-3.5" aria-hidden /> Düzenle
          </Button>
          {bet.needsReview && bet.eventId ? (
            <Button size="sm" loading={busy} onClick={() => void quickConfirm()}>
              <CheckCheck className="size-3.5" aria-hidden /> Bilgiler Doğru, Onayla
            </Button>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ev sahibi" error={form.formState.errors.homeTeam?.message} {...form.register("homeTeam")} />
            <Input label="Rakip" error={form.formState.errors.awayTeam?.message} {...form.register("awayTeam")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Lig (isteğe bağlı)" {...form.register("league")} />
            <div>
              <Input
                label="Market / seçim"
                list={`markets-${bet.id}`}
                placeholder="MS 1"
                error={form.formState.errors.marketInput?.message}
                {...form.register("marketInput")}
              />
              <datalist id={`markets-${bet.id}`}>
                {MARKET_OPTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
          <Input
            label="Basılı oran"
            inputMode="decimal"
            placeholder="1.85"
            error={form.formState.errors.printedOdds?.message}
            {...form.register("printedOdds")}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy}>Kaydet ve Yeniden Eşleştir</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Vazgeç</Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
