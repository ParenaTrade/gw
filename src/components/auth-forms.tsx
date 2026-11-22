"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Fingerprint, KeyRound, MessageSquareLock, UserPlus } from "lucide-react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { apiPost } from "@/lib/api-client";
import { formatPhoneDisplay, maskPhone } from "@/lib/format";

const PENDING_KEY = "kuponum_pending_login";

const phoneFormSchema = z.object({
  phone: z.string().min(10, "Telefon numarası girin (örn. 555 111 22 33)."),
});
type PhoneForm = z.infer<typeof phoneFormSchema>;

const signupFormSchema = z.object({
  fullName: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı.").max(80, "Ad soyad en fazla 80 karakter olmalı."),
});
type SignupForm = z.infer<typeof signupFormSchema>;

type OtpResponse = { sent: boolean; demo: boolean; devCode?: string };
type IdentifyResponse = { phone: string; registered: boolean; hasPasskey: boolean; otpFallback: boolean };
type Step = "phone" | "login" | "signup" | "nopasskey";

function errorName(e: unknown): string {
  return e instanceof Error ? e.name : "";
}

/** WebAuthn tarayıcı hatalarını anlaşılır Türkçe mesaja çevirir; API hatalarını olduğu gibi gösterir. */
function passkeyErrorMessage(e: unknown, fallback: string): string {
  const name = errorName(e);
  if (name === "NotAllowedError" || name === "AbortError") {
    return "İşlem iptal edildi veya zaman aşımına uğradı. Tekrar deneyin.";
  }
  if (name === "InvalidStateError") return "Bu cihazda bu hesap için zaten bir passkey var.";
  if (name === "NotSupportedError" || name === "SecurityError") {
    return "Bu cihaz veya tarayıcı passkey desteklemiyor.";
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/**
 * Tek ekranlı giriş / kayıt:
 *  1. Telefon numarası girilir.
 *  2a. Kayıtlı + passkey  → parmak izi / Face ID ile giriş.
 *  2b. Kayıtsız           → ad soyad + parmak izi ile kayıt (üyelik + oturum).
 *  2c. Kayıtlı, passkey yok (eski/seed hesap) → yalnızca demo modunda OTP yedeği.
 * OTP ve PIN yöntemleri daha sonra tanımlanacak.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/kuponum";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpFallback, setOtpFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneFormSchema), defaultValues: { phone: "" } });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupFormSchema), defaultValues: { fullName: "" } });

  function reset() {
    setStep("phone");
    setError(null);
    setBusy(false);
  }

  async function passkeyLogin(targetPhone: string, auto = false) {
    setError(null);
    setBusy(true);
    try {
      const { browserSupportsWebAuthn, startAuthentication } = await import("@simplewebauthn/browser");
      if (!browserSupportsWebAuthn()) {
        setError("Bu cihaz veya tarayıcı passkey desteklemiyor.");
        return;
      }
      const { challengeId, options } = await apiPost<{
        challengeId: string;
        options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
      }>("/api/auth/passkey/login/options", { phone: targetPhone });
      const credential = await startAuthentication({ optionsJSON: options });
      await apiPost("/api/auth/passkey/login/verify", { challengeId, credential });
      router.push(next);
      router.refresh();
    } catch (e) {
      // Otomatik denemede tarayıcı kullanıcı hareketi istemediyse sessizce düğmeye düş.
      if (auto && errorName(e) === "NotAllowedError") return;
      setError(passkeyErrorMessage(e, "Giriş yapılamadı. Tekrar deneyin."));
    } finally {
      setBusy(false);
    }
  }

  async function identify(values: PhoneForm) {
    setError(null);
    try {
      const res = await apiPost<IdentifyResponse>("/api/auth/identify", { phone: values.phone });
      setPhone(res.phone);
      setOtpFallback(res.otpFallback);
      if (!res.registered) {
        setStep("signup");
      } else if (res.hasPasskey) {
        setStep("login");
        void passkeyLogin(res.phone, true);
      } else {
        setStep("nopasskey");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Numara kontrol edilemedi.");
    }
  }

  async function passkeySignup(values: SignupForm) {
    setError(null);
    setBusy(true);
    try {
      const { browserSupportsWebAuthn, startRegistration } = await import("@simplewebauthn/browser");
      if (!browserSupportsWebAuthn()) {
        setError("Bu cihaz veya tarayıcı passkey desteklemiyor.");
        return;
      }
      const { challengeId, options } = await apiPost<{
        challengeId: string;
        options: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/api/auth/passkey/signup/options", { phone, fullName: values.fullName });
      const credential = await startRegistration({ optionsJSON: options });
      await apiPost("/api/auth/passkey/signup/verify", { challengeId, credential });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(passkeyErrorMessage(e, "Kayıt tamamlanamadı. Tekrar deneyin."));
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiPost<OtpResponse>("/api/auth/otp", { phone });
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ phone, devCode: res.devCode ?? null, demo: res.demo }));
      router.push(`/verify?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <Card className="p-5">
        <form onSubmit={phoneForm.handleSubmit(identify)} className="space-y-4">
          <Input
            label="Telefon numarası"
            prefix="+90"
            inputMode="tel"
            autoComplete="tel"
            placeholder="555 111 22 33"
            autoFocus
            error={phoneForm.formState.errors.phone?.message}
            {...phoneForm.register("phone")}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={phoneForm.formState.isSubmitting}>
            Devam Et
          </Button>
          <p className="text-center text-xs text-muted">
            Kayıtlıysanız parmak izi / Face ID ile giriş yaparsınız. Değilseniz adınızı girip aynı yöntemle kayıt olursunuz.
          </p>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3.5 py-3">
        <span className="font-mono text-sm">{formatPhoneDisplay(phone)}</span>
        <button type="button" className="cursor-pointer text-sm text-accent underline underline-offset-2" onClick={reset}>
          Değiştir
        </button>
      </div>

      {step === "login" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Parmak izi, Face ID veya cihaz kilidinizle devam edin.</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="button" size="lg" className="w-full" loading={busy} onClick={() => void passkeyLogin(phone)}>
            <Fingerprint className="size-5" aria-hidden /> Parmak İzi ile Giriş Yap
          </Button>
        </div>
      ) : null}

      {step === "signup" ? (
        <form onSubmit={signupForm.handleSubmit(passkeySignup)} className="space-y-4">
          <Alert tone="info">Bu numara kayıtlı değil. Adınızı girin, ardından parmak izi / Face ID ile hesabınızı oluşturun.</Alert>
          <Input
            label="Ad Soyad"
            autoComplete="name"
            placeholder="Adınız Soyadınız"
            autoFocus
            error={signupForm.formState.errors.fullName?.message}
            {...signupForm.register("fullName")}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            <UserPlus className="size-5" aria-hidden /> Parmak İzi ile Kayıt Ol
          </Button>
        </form>
      ) : null}

      {step === "nopasskey" ? (
        <div className="space-y-4">
          <Alert tone="warn">Bu numara için henüz passkey tanımlı değil.</Alert>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {otpFallback ? (
            <Button type="button" variant="secondary" className="w-full" loading={busy} onClick={() => void sendOtp()}>
              <MessageSquareLock className="size-5" aria-hidden /> Demo: Kodla Giriş Yap
            </Button>
          ) : (
            <p className="text-sm text-muted">Doğrulama kodu / PIN ile giriş yöntemi yakında eklenecek.</p>
          )}
        </div>
      ) : null}
    </Card>
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
