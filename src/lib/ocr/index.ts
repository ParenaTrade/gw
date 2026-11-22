import { existsSync } from "node:fs";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";

/**
 * OCR hattı:
 * 1. OCR_API_URL tanımlıysa PaddleOCR worker köprüsü (OpenCV perspektif
 *    düzeltmesi worker tarafında yapılır). Sözleşme: POST {image: base64}
 *    → {text: string, confidence: 0..1}.
 * 2. Değilse yerel tesseract.js (tur+eng, LSTM). Dil verisi ocr-data/
 *    dizininden yüklenir; yoksa CDN'e düşer.
 * Başarısızlıkta OCR_FAILED durumu üretilir (pipeline).
 */

export type OcrOutput = {
  text: string;
  confidence: number;
  engine: string;
  durationMs: number;
};

const globalForOcr = globalThis as typeof globalThis & {
  __kuponumOcrWorker?: Promise<Worker> | null;
};

function getWorker(): Promise<Worker> {
  if (!globalForOcr.__kuponumOcrWorker) {
    const localLang = path.join(process.cwd(), "ocr-data");
    const hasLocal = existsSync(path.join(localLang, "tur.traineddata.gz"));
    globalForOcr.__kuponumOcrWorker = createWorker("tur+eng", 1, {
      ...(hasLocal ? { langPath: localLang, gzip: true } : {}),
      cachePath: path.join(process.cwd(), ".ocr-cache"),
    }).catch((e) => {
      globalForOcr.__kuponumOcrWorker = null;
      throw e;
    });
  }
  return globalForOcr.__kuponumOcrWorker;
}

async function runPaddleBridge(image: Buffer): Promise<{ text: string; confidence: number }> {
  const url = process.env.OCR_API_URL!.trim();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OCR_API_KEY ? { Authorization: `Bearer ${process.env.OCR_API_KEY}` } : {}),
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ image: image.toString("base64"), mime: "image/jpeg" }),
  });
  if (!res.ok) throw new Error(`OCR_API_URL ${res.status}`);
  const data = (await res.json()) as { text?: unknown; confidence?: unknown };
  if (typeof data.text !== "string") throw new Error("OCR köprüsü geçersiz yanıt");
  const confidence = typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.5;
  return { text: data.text, confidence };
}

export async function runOcr(image: Buffer): Promise<OcrOutput> {
  const started = Date.now();
  if (process.env.OCR_API_URL?.trim()) {
    const { text, confidence } = await runPaddleBridge(image);
    return { text, confidence, engine: "paddleocr-bridge", durationMs: Date.now() - started };
  }
  const worker = await getWorker();
  try {
    const { data } = await worker.recognize(image);
    return {
      text: data.text ?? "",
      confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
      engine: "tesseract.js",
      durationMs: Date.now() - started,
    };
  } catch (e) {
    globalForOcr.__kuponumOcrWorker = null;
    throw e;
  }
}
