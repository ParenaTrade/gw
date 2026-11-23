import { azureReadAdapter } from "./adapters/azure-read";
import { googleVisionAdapter } from "./adapters/google-vision";
import { paddleBridgeAdapter } from "./adapters/paddle-bridge";
import { tesseractAdapter } from "./adapters/tesseract";
import type { OcrAdapter, OcrOutput, OcrProviderName } from "./types";

export type { OcrOutput, OcrProviderName } from "./types";

/**
 * OCR hattı (adapter katmanı). Sağlayıcı seçimi:
 *   OCR_PROVIDER = auto (varsayılan) | paddle | google | azure | tesseract
 * `auto` sırası: OCR_API_URL → paddle, GOOGLE_VISION_API_KEY → google,
 * AZURE_VISION_ENDPOINT+AZURE_VISION_KEY → azure, hiçbiri yoksa tesseract.
 *
 * OCR_FALLBACK=tesseract: seçilen harici motor hata verirse yerel tesseract'a
 * düşer. Hangi motorun kullanıldığı `ocr_results.engine` alanına yazıldığı için
 * geri dönüş sessiz değildir. Her iki motor da başarısızsa hata fırlatılır ve
 * pipeline kuponu OCR_FAILED yapar.
 */

const ADAPTERS: Record<OcrProviderName, OcrAdapter> = {
  paddle: paddleBridgeAdapter,
  google: googleVisionAdapter,
  azure: azureReadAdapter,
  tesseract: tesseractAdapter,
};

const AUTO_ORDER: OcrProviderName[] = ["paddle", "google", "azure"];

export function resolveOcrAdapter(env: NodeJS.ProcessEnv = process.env): OcrAdapter {
  const requested = (env.OCR_PROVIDER ?? "auto").trim().toLowerCase();
  if (requested !== "auto") {
    const adapter = ADAPTERS[requested as OcrProviderName];
    if (!adapter) {
      throw new Error(`OCR_PROVIDER geçersiz: "${requested}" (auto|paddle|google|azure|tesseract)`);
    }
    if (!adapter.isConfigured()) {
      throw new Error(`OCR_PROVIDER=${requested} seçili ama gerekli env değişkenleri eksik`);
    }
    return adapter;
  }
  for (const key of AUTO_ORDER) {
    if (ADAPTERS[key].isConfigured()) return ADAPTERS[key];
  }
  return tesseractAdapter;
}

export async function runOcr(image: Buffer): Promise<OcrOutput> {
  const started = Date.now();
  const primary = resolveOcrAdapter();
  try {
    const result = await primary.recognize(image);
    return { ...result, engine: primary.name, durationMs: Date.now() - started };
  } catch (e) {
    const fallback = process.env.OCR_FALLBACK?.trim().toLowerCase() === "tesseract";
    if (!fallback || primary === tesseractAdapter) throw e;
    console.error(
      JSON.stringify({
        error_code: "OCR_PRIMARY_FALLBACK",
        engine: primary.name,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    const result = await tesseractAdapter.recognize(image);
    return { ...result, engine: `${tesseractAdapter.name} (fallback:${primary.name})`, durationMs: Date.now() - started };
  }
}
