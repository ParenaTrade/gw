import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { clamp01, type OcrAdapter } from "../types";

/**
 * Yerel tesseract.js (tur+eng, LSTM). Dil verisi proje kökündeki ocr-data/
 * dizininden okunur (tur.traineddata.gz + eng.traineddata.gz, repoda mevcut);
 * dizin yoksa tesseract.js CDN'den indirir.
 * Cache dizini yazılabilir olmalı: serverless'ta (Vercel/Lambda) yalnızca
 * os.tmpdir() yazılabilir, bu yüzden .ocr-cache yerine orası kullanılır.
 */

const LANGS = "tur+eng";

const globalForOcr = globalThis as typeof globalThis & {
  __kuponumOcrWorker?: Promise<Worker> | null;
};

export function resolveLangPath(): string | null {
  const custom = process.env.OCR_LANG_PATH?.trim();
  const dir = custom ? path.resolve(custom) : path.join(process.cwd(), "ocr-data");
  const ok = ["tur", "eng"].every((l) => existsSync(path.join(dir, `${l}.traineddata.gz`)));
  return ok ? dir : null;
}

function getWorker(): Promise<Worker> {
  if (!globalForOcr.__kuponumOcrWorker) {
    const langPath = resolveLangPath();
    globalForOcr.__kuponumOcrWorker = createWorker(LANGS, 1, {
      ...(langPath ? { langPath, gzip: true } : {}),
      cachePath: path.join(os.tmpdir(), "kuponum-ocr-cache"),
    }).catch((e) => {
      globalForOcr.__kuponumOcrWorker = null;
      throw e;
    });
  }
  return globalForOcr.__kuponumOcrWorker;
}

export const tesseractAdapter: OcrAdapter = {
  name: "tesseract.js",
  isConfigured: () => true, // her ortamda yedek motor
  async recognize(image) {
    const worker = await getWorker();
    try {
      const { data } = await worker.recognize(image);
      return { text: data.text ?? "", confidence: clamp01((data.confidence ?? 0) / 100) };
    } catch (e) {
      // Bozulmuş worker'ı bir sonraki istekte yeniden kur.
      globalForOcr.__kuponumOcrWorker = null;
      throw e;
    }
  },
};
