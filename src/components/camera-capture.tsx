"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, RefreshCw, ScanLine } from "lucide-react";
import { Alert, Button } from "@/components/ui";

export type CaptureResult = { blob: Blob; previewUrl: string; warnings: string[] };

/**
 * Native-like kamera akışı:
 * getUserMedia(environment) → kadraj → capture → kalite kontrolü → Kullan/Tekrar Çek.
 * Kamera açılamazsa dosya/galeri fallback (capture="environment").
 * Kalite analizi istemcide yapılır; orijinal dosya değiştirilmeden yüklenir.
 */
export function CameraCapture({ onCapture }: { onCapture: (result: CaptureResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"starting" | "live" | "fallback">("starting");
  const [pending, setPending] = useState<CaptureResult | null>(null);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setPending(null);
    setMode("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMode("live");
    } catch {
      setMode("fallback");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return stopStream;
  }, [startCamera, stopStream]);

  async function analyze(source: CanvasImageSource, width: number, height: number): Promise<string[]> {
    const canvas = document.createElement("canvas");
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || width < 400 || height < 400) {
      return width < 400 || height < 400 ? ["Çözünürlük düşük — kuponu daha yakından çekin."] : [];
    }
    ctx.drawImage(source, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const gray: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(g);
      sum += g;
    }
    const mean = sum / gray.length;
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < size - 1; y += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        const i = y * size + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size];
        lapSum += lap;
        lapSq += lap * lap;
        n += 1;
      }
    }
    const variance = lapSq / n - (lapSum / n) ** 2;
    const warnings: string[] = [];
    if (mean < 45) warnings.push("Görüntü çok karanlık — daha iyi ışıkta çekin.");
    if (mean > 225) warnings.push("Görüntü aşırı parlak — parlamayı azaltın.");
    if (variance < 40) warnings.push("Görüntü bulanık olabilir — telefonu sabit tutun.");
    return warnings;
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const warnings = await analyze(video, video.videoWidth, video.videoHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) return;
      stopStream();
      setPending({ blob, previewUrl: URL.createObjectURL(blob), warnings });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("img"));
        img.src = url;
      }).catch(() => undefined);
      const warnings = img.naturalWidth
        ? await analyze(img, img.naturalWidth, img.naturalHeight)
        : ["Görsel okunamadı."];
      stopStream();
      setPending({ blob: file, previewUrl: url, warnings });
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.previewUrl} alt="Çekilen kupon önizlemesi" className="max-h-[55vh] w-full object-contain" />
        </div>
        {pending.warnings.length > 0 ? (
          <Alert tone="warn">
            <p className="font-semibold">Kalite uyarısı</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {pending.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs opacity-80">Yine de kullanabilirsiniz; partner operasyonu görseli ayrıca doğrular.</p>
          </Alert>
        ) : (
          <Alert tone="ok">Fotoğraf kalitesi iyi görünüyor.</Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => void startCamera()}>
            <RefreshCw className="size-4" aria-hidden /> Tekrar Çek
          </Button>
          <Button onClick={() => onCapture(pending)}>Kullan</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={mode === "live" ? "max-h-[55vh] w-full object-cover" : "hidden"}
        />
        {mode === "live" ? (
          <>
            <div className="pointer-events-none absolute inset-4">
              <span className="absolute left-0 top-0 size-8 border-l-2 border-t-2 border-accent rounded-tl-lg" />
              <span className="absolute right-0 top-0 size-8 border-r-2 border-t-2 border-accent rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 size-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 size-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
            </div>
            <p className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-center text-xs text-ink">
              Kuponun dört köşesinin görünür olduğundan emin olun.
            </p>
          </>
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center p-6 text-center">
            <div className="space-y-3">
              <ScanLine className="mx-auto size-10 text-muted" aria-hidden />
              {mode === "starting" ? (
                <p className="text-sm text-muted">Kamera başlatılıyor…</p>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    Kamera açılamadı veya izin verilmedi. Galeriden / dosyadan fotoğraf seçebilirsiniz.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => void startCamera()}>
                    <Camera className="size-4" aria-hidden /> Kamerayı tekrar dene
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {mode === "live" ? (
        <Button size="lg" className="w-full" loading={busy} onClick={() => void captureFrame()}>
          <Camera className="size-5" aria-hidden /> Fotoğraf Çek
        </Button>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" className="w-full" loading={busy} onClick={() => fileRef.current?.click()}>
        <ImageUp className="size-4" aria-hidden /> Galeriden / dosyadan seç
      </Button>
    </div>
  );
}
