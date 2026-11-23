import { postJson } from "../http";
import { clamp01, mean, type OcrAdapter } from "../types";

/**
 * Azure AI Vision — Image Analysis 4.0 `read` özelliği (senkron, tek istek).
 * Env: AZURE_VISION_ENDPOINT (örn. https://<kaynak>.cognitiveservices.azure.com),
 *      AZURE_VISION_KEY.
 */

type AzureReadResponse = {
  readResult?: {
    blocks?: {
      lines?: { text?: string; words?: { confidence?: number }[] }[];
    }[];
  };
};

export const azureReadAdapter: OcrAdapter = {
  name: "azure-read",
  isConfigured: () =>
    Boolean(process.env.AZURE_VISION_ENDPOINT?.trim() && process.env.AZURE_VISION_KEY?.trim()),
  async recognize(image) {
    const endpoint = process.env.AZURE_VISION_ENDPOINT!.trim().replace(/\/+$/, "");
    const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read&language=tr`;
    const data = await postJson<AzureReadResponse>("azure-read", url, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Ocp-Apim-Subscription-Key": process.env.AZURE_VISION_KEY!.trim(),
      },
      body: new Uint8Array(image),
    });
    const lines = (data.readResult?.blocks ?? []).flatMap((b) => b.lines ?? []);
    const text = lines
      .map((l) => l.text ?? "")
      .filter(Boolean)
      .join("\n");
    const scores = lines
      .flatMap((l) => l.words ?? [])
      .map((w) => w.confidence)
      .filter((c): c is number => typeof c === "number");
    return { text, confidence: text ? clamp01(mean(scores)) : 0 };
  },
};
