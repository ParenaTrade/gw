"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Smartphone } from "lucide-react";
import { Alert, Button, Card, SectionTitle } from "@/components/ui";
import { apiPost } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/format";
import type { DeviceRow } from "@/db/schema";

/**
 * Passkey kaydı — WebAuthn cihaz üzerinde doğrulanır.
 * Backend yalnızca credential public key saklar; biyometrik veri asla iletilmez.
 */
export function PasskeyPanel({ devices }: { devices: DeviceRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "danger" | "warn"; text: string } | null>(null);
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  async function registerPasskey() {
    setBusy(true);
    setMessage(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { challengeId, options } = await apiPost<{ challengeId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
        "/api/auth/passkey/register/options"
      );
      const credential = await startRegistration({ optionsJSON: options });
      const deviceName = /iPhone|iPad/i.test(navigator.userAgent)
        ? "iPhone / iPad"
        : /Android/i.test(navigator.userAgent)
          ? "Android cihaz"
          : "Bu bilgisayar";
      await apiPost("/api/auth/passkey/register/verify", { challengeId, credential, deviceName });
      setMessage({ tone: "ok", text: "Passkey bu cihaza kaydedildi. Artık telefon + biyometrik ile giriş yapabilirsiniz." });
      router.refresh();
    } catch (e) {
      setMessage({
        tone: "danger",
        text: e instanceof Error && e.message ? e.message : "Passkey kaydı tamamlanamadı. Cihazınız desteklemiyor olabilir.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <SectionTitle>Cihazlar ve Passkey</SectionTitle>
      {devices.length === 0 ? (
        <p className="text-sm text-muted">Henüz kayıtlı cihaz yok.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-3">
              <Smartphone className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{d.deviceName ?? "Cihaz"}</p>
                <p className="text-xs text-muted">Son giriş: {fmtDateTime(d.lastLoginAt)}</p>
              </div>
              {d.passkeyEnabled ? (
                <span className="tone-ok inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                  <Fingerprint className="size-3.5" aria-hidden /> Passkey
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {supported ? (
        <Button variant="secondary" className="w-full" loading={busy} onClick={() => void registerPasskey()}>
          <Fingerprint className="size-5" aria-hidden /> Bu Cihazda Passkey Oluştur
        </Button>
      ) : (
        <Alert tone="warn">Bu tarayıcı passkey desteklemiyor. OTP ile giriş her zaman kullanılabilir.</Alert>
      )}
      <p className="text-xs leading-relaxed text-muted">
        Biyometrik doğrulama cihazınızda gerçekleşir. Ham parmak izi veya yüz verisi hiçbir zaman KUponum sunucularına gönderilmez; yalnızca WebAuthn public anahtarı saklanır.
      </p>
    </Card>
  );
}
