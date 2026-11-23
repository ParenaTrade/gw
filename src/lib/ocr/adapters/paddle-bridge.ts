import { postJson } from "../http";
import { clamp01, type OcrAdapter } from "../types";

/**
 * Harici PaddleOCR köprüsü (ocr-bridge/ klasöründeki servis veya aynı
 * sözleşmeyi uygulayan herhangi bir servis).
 * Sözleşme: POST {image: base64, mime} → {text: string, confidence: 0..1}
 * Env: OCR_API_URL (zorunlu), OCR_API_KEY (Bearer, opsiyonel).
 */
export const paddleBridgeAdapter: OcrAdapter = {
  name: "paddleocr-bridge",
  isConfigured: () => Boolean(process.env.OCR_API_URL?.trim()),
  async recognize(image) {
    const url = process.env.OCR_API_URL!.trim();
    const data = await postJson<{ text?: unknown; confidence?: unknown }>("OCR_API_URL", url, {
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OCR_API_KEY ? { Authorization: `Bearer ${process.env.OCR_API_KEY}` } : {}),
      },
      body: JSON.stringify({ image: image.toString("base64"), mime: "image/jpeg" }),
    });
    if (typeof data.text !== "string") throw new Error("OCR köprüsü geçersiz yanıt");
    return {
      text: data.text,
      confidence: typeof data.confidence === "number" ? clamp01(data.confidence) : 0.5,
    };
  },
};
