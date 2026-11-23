import { postJson } from "../http";
import { clamp01, mean, type OcrAdapter } from "../types";

/**
 * Google Cloud Vision — DOCUMENT_TEXT_DETECTION (yoğun/yapılandırılmış metin
 * için TEXT_DETECTION'dan daha iyi).
 * Env: GOOGLE_VISION_API_KEY (zorunlu), GOOGLE_VISION_ENDPOINT (opsiyonel).
 */

type VisionResponse = {
  responses?: {
    error?: { code?: number; message?: string };
    fullTextAnnotation?: {
      text?: string;
      pages?: { confidence?: number; blocks?: { confidence?: number }[] }[];
    };
  }[];
};

export const googleVisionAdapter: OcrAdapter = {
  name: "google-vision",
  isConfigured: () => Boolean(process.env.GOOGLE_VISION_API_KEY?.trim()),
  async recognize(image) {
    const base = process.env.GOOGLE_VISION_ENDPOINT?.trim() || "https://vision.googleapis.com/v1/images:annotate";
    const data = await postJson<VisionResponse>("google-vision", base, {
      headers: {
        "Content-Type": "application/json",
        // Anahtar URL yerine başlıkta: log/proxy'lerde sızmaz.
        "X-Goog-Api-Key": process.env.GOOGLE_VISION_API_KEY!.trim(),
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["tr", "en"] },
          },
        ],
      }),
    });
    const first = data.responses?.[0];
    if (!first) throw new Error("google-vision boş yanıt");
    if (first.error) throw new Error(`google-vision: ${first.error.message ?? first.error.code}`);

    const full = first.fullTextAnnotation;
    const text = (full?.text ?? "").replace(/\s+$/, "");
    const blockScores = (full?.pages ?? []).flatMap((p) =>
      (p.blocks ?? []).map((b) => b.confidence).filter((c): c is number => typeof c === "number"),
    );
    // Metin yoksa Vision fullTextAnnotation döndürmez → güven 0.
    return { text, confidence: text ? clamp01(mean(blockScores)) : 0 };
  },
};
