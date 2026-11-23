/**
 * OCR adapter sözleşmesi. Her motor aynı arayüzü uygular; pipeline yalnızca
 * `runOcr()` (index.ts) ile konuşur ve motor adı `ocr_results.engine`
 * kolonuna yazılır (denetlenebilirlik).
 */

export type OcrRecognition = {
  /** Satır sırası korunmuş düz metin. */
  text: string;
  /** 0..1 arası ortalama güven. Motor vermiyorsa 0.5. */
  confidence: number;
};

export type OcrAdapter = {
  /** ocr_results.engine değeri. */
  readonly name: string;
  /** Gerekli env değişkenleri tanımlı mı (ağ çağrısı yapmaz). */
  isConfigured(): boolean;
  recognize(image: Buffer): Promise<OcrRecognition>;
};

export type OcrOutput = OcrRecognition & {
  engine: string;
  durationMs: number;
};

export type OcrProviderName = "paddle" | "google" | "azure" | "tesseract";

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0.5;
}
