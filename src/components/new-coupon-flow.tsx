"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CameraCapture, type CaptureResult } from "@/components/camera-capture";
import { Alert, Button, Card, Input, SectionTitle } from "@/components/ui";
import { apiPost, apiUpload } from "@/lib/api-client";
import type { CouponRow } from "@/db/schema";

const detailsSchema = z.object({
  physicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin."),
  physicalTime: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat girin."),
  stakeAmount: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Tutar biçimi geçersiz (örn. 50.00).")
    .or(z.literal(""))
    .optional(),
});
type DetailsForm = z.infer<typeof detailsSchema>;

function nowDefaults() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    physicalDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    physicalTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Yeni kupon: Kamera → kalite → kullan → fiziksel bilgi → oluştur + yükle. */
export function NewCouponFlow() {
  const router = useRouter();
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [stage, setStage] = useState<"capture" | "details" | "submitting">("capture");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { ...nowDefaults(), stakeAmount: "" },
  });

  async function submit(values: DetailsForm) {
    if (!capture) return;
    setStage("submitting");
    setError(null);
    try {
      setProgress("Kupon kaydı oluşturuluyor…");
      const { coupon } = await apiPost<{ coupon: CouponRow }>("/api/coupons", {
        physicalDate: values.physicalDate,
        physicalTime: values.physicalTime,
        ...(values.stakeAmount ? { stakeAmount: values.stakeAmount } : {}),
      });
      setProgress("Orijinal görsel güvenle yükleniyor…");
      const fd = new FormData();
      fd.append("file", capture.blob, "original.jpg");
      await apiUpload(`/api/coupons/${coupon.id}/image`, fd);
      setProgress("Yönlendiriliyor…");
      router.push(`/kuponum/${coupon.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kupon şu anda işlenemiyor. Lütfen tekrar deneyin.");
      setStage("details");
    }
  }

  if (stage === "capture" || !capture) {
    return (
      <div className="space-y-4">
        <Alert tone="info">
          Kuponu düz bir zemine koyun; dört köşesi kadraja girsin. Orijinal fotoğraf değiştirilmeden, değiştirilemez kayıt olarak saklanır.
        </Alert>
        <CameraCapture
          onCapture={(result) => {
            setCapture(result);
            setStage("details");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capture.previewUrl} alt="Kupon önizleme" className="size-20 rounded-lg border border-line object-cover" />
        <div className="text-sm">
          <p className="font-semibold">Fotoğraf hazır</p>
          <button
            type="button"
            className="mt-1 inline-flex cursor-pointer items-center gap-1 text-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              URL.revokeObjectURL(capture.previewUrl);
              setCapture(null);
              setStage("capture");
            }}
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Baştan çek
          </button>
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <SectionTitle>Fiziksel kupon bilgileri</SectionTitle>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kupon tarihi" type="date" error={form.formState.errors.physicalDate?.message} {...form.register("physicalDate")} />
            <Input label="Kupon saati" type="time" error={form.formState.errors.physicalTime?.message} {...form.register("physicalTime")} />
          </div>
          <Input
            label="Tutar (isteğe bağlı)"
            inputMode="decimal"
            placeholder="50.00"
            hint="Fiziksel kupon üzerindeki bahis tutarı"
            error={form.formState.errors.stakeAmount?.message}
            {...form.register("stakeAmount")}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={stage === "submitting"}>
            <ShieldCheck className="size-5" aria-hidden />
            {stage === "submitting" ? progress : "Kuponu Oluştur ve Yükle"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-muted">
        Yükleme sonrası kuponunuzu kontrol edip <span className="font-semibold text-ink">KUPONU ONAYLA</span> adımıyla partner operasyonuna iletebilirsiniz.
      </p>
    </div>
  );
}
