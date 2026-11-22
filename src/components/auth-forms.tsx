"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Fingerprint, KeyRound, MessageSquareLock } from "lucide-react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { apiPost } from "@/lib/api-client";
import { maskPhone } from "@/lib/format";

const PENDING_KEY = "kuponum_pending_login";

const loginSchema = z.object({
  phone: z.string().min(10, "Telefon numarası girin (örn. 555 111 22 33)."),
  fullName: z.string().trim().max(80).optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

type OtpResponse = { sent: boolean; demo: boolean; devCode?: string };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/kuponum";
  const [error, setError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { phone: "", fullName: "" } });

  async function sendOtp(values: LoginForm) {
    setError(null);
    try {
      const res = await apiPost<OtpResponse>("/api/auth/otp", {
        phone: values.phone,
        ...(values.fullName ? { fullName: values.fullName } : {}),
      });
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ phone: values.phone, devCode: res.devCode ?? null, demo: res.demo })
      );
      router.push(`/verify?phone=${encodeURIComponent(values.phone)}&next=${encodeURIComponent(next)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod gönderilemedi.");
    }
  }

  async function passkeyLogin() {
    setError(null);
    setPasskeyBusy(true);
    try {
      const phone = form.getValues("phone");
      if (!phone || phone.length < 10) {
        setError("Passkey ile giriş için önce telefon numaranızı girin.");
        return;
      }
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { challengeId, options } = await apiPost<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
        "/api/auth/passkey/login/options",
        { phone }
      );
      const credential = await startAuthentication({ optionsJSON: options });
      await apiPost("/api/auth/passkey/login/verify", { challengeId, credential });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Passkey girişi başarısız. OTP ile devam edin."
      );
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={form.handleSubmit(sendOtp)} className="space-y-4">
          <Input
            label="Telefon numarası"
            prefix="+90"
            inputMode="tel"
            autoComplete="tel"
            placeholder="555 111 22 33"
            error={form.formState.errors.phone?.message}
            {...form.register("phone")}
          />
          <Input
            label="Ad Soyad (ilk kayıt için)"
            autoComplete="name"
            placeholder="Adınız Soyadınız"
            hint="Üye değilseniz kaydınız OTP doğrulamasıyla oluşturulur."
            {...form.register("fullName")}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            <MessageSquareLock className="size-5" aria-hidden /> Doğrulama Kodu Gönder
          </Button>
          <Button type="button" variant="secondary" className="w-full" loading={passkeyBusy} onClick={() => void passkeyLogin()}>
            <Fingerprint className="size-5" aria-hidden /> Passkey ile Giriş
          </Button>
        </form>
      </Card>

      <Alert tone="info">
        <p className="font-semibold">Demo ortamı</p>
        <p className="mt-1">
          SMS sağlayıcısı bağlı olmadığı için kod ekranda gösterilir. Hazır hesaplar: üye{" "}
          <button type="button" className="cursor-pointer font-mono underline underline-offset-2" onClick={() => form.setValue("phone", "5551112233")}>
            555 111 22 33
          </button>{" "}
          · partner{" "}
          <button type="button" className="cursor-pointer font-mono underline underline-offset-2" onClick={() => form.setValue("phone", "5559990000")}>
            555 999 00 00
          </button>
        </p>
      </Alert>
    </div>
  );
}

const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/, "6 haneli kodu girin.") });
type VerifyForm = z.infer<typeof verifySchema>;

export function VerifyForm({ phone }: { phone: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/kuponum";
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const form = useForm<VerifyForm>({ resolver: zodResolver(verifySchema), defaultValues: { code: "" } });

  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as { devCode?: string } | null;
      if (pending?.devCode) setDevCode(pending.devCode);
    } catch {
      // yok say
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(values: VerifyForm) {
    setError(null);
    try {
      await apiPost("/api/auth/verify", { phone, code: values.code });
      sessionStorage.removeItem(PENDING_KEY);
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Doğrulama başarısız.");
    }
  }

  async function resend() {
    setError(null);
    try {
      const res = await apiPost<OtpResponse>("/api/auth/otp", { phone });
      setDevCode(res.devCode ?? null);
      setCooldown(45);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod gönderilemedi.");
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={form.handleSubmit(verify)} className="space-y-4">
        <p className="text-sm text-muted">
          <span className="font-mono text-ink">{maskPhone(phone)}</span> numarasına gönderilen 6 haneli kodu girin.
        </p>
        {devCode ? (
          <Alert tone="info">
            <span className="font-semibold">Demo modu:</span> kodunuz{" "}
            <button type="button" className="cursor-pointer font-mono text-base font-bold underline underline-offset-2" onClick={() => form.setValue("code", devCode)}>
              {devCode}
            </button>{" "}
            <span className="text-xs opacity-80">(dokunun, otomatik dolsun)</span>
          </Alert>
        ) : null}
        <Input
          label="Doğrulama kodu"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          className="text-center font-mono text-2xl tracking-[0.5em]"
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          <KeyRound className="size-5" aria-hidden /> Doğrula ve Giriş Yap
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={cooldown > 0} onClick={() => void resend()}>
          {cooldown > 0 ? `Yeni kod (${cooldown}s)` : "Kodu tekrar gönder"}
        </Button>
      </form>
    </Card>
  );
}
