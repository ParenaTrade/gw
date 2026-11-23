import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { resolveOcrAdapter, runOcr } from "@/lib/ocr";
import { resolveLangPath } from "@/lib/ocr/adapters/tesseract";

const ENV_KEYS = [
  "OCR_PROVIDER", "OCR_FALLBACK", "OCR_API_URL", "OCR_API_KEY",
  "GOOGLE_VISION_API_KEY", "AZURE_VISION_ENDPOINT", "AZURE_VISION_KEY",
];

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) delete process.env[k];
});

const IMG = Buffer.from("fake-image");

describe("OCR sağlayıcı seçimi", () => {
  it("hiçbiri tanımlı değilse tesseract", () => {
    expect(resolveOcrAdapter().name).toBe("tesseract.js");
  });
  it("auto sırası: paddle > google > azure", () => {
    process.env.AZURE_VISION_ENDPOINT = "https://x";
    process.env.AZURE_VISION_KEY = "k";
    expect(resolveOcrAdapter().name).toBe("azure-read");
    process.env.GOOGLE_VISION_API_KEY = "k";
    expect(resolveOcrAdapter().name).toBe("google-vision");
    process.env.OCR_API_URL = "https://bridge";
    expect(resolveOcrAdapter().name).toBe("paddleocr-bridge");
  });
  it("açık seçim eksik env'de net hata verir", () => {
    process.env.OCR_PROVIDER = "google";
    expect(() => resolveOcrAdapter()).toThrow(/eksik/);
    process.env.OCR_PROVIDER = "nope";
    expect(() => resolveOcrAdapter()).toThrow(/geçersiz/);
  });
});

describe("paddle köprüsü", () => {
  it("Bearer gönderir, güveni 0..1'e kırpar", async () => {
    process.env.OCR_API_URL = "https://bridge/ocr";
    process.env.OCR_API_KEY = "s3";
    const f = mockFetch({ text: "A - B\nMS 1 1.85", confidence: 7 });
    const out = await runOcr(IMG);
    expect(out).toMatchObject({ text: "A - B\nMS 1 1.85", confidence: 1, engine: "paddleocr-bridge" });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3");
  });
  it("geçersiz yanıtta hata", async () => {
    process.env.OCR_API_URL = "https://bridge/ocr";
    mockFetch({ nope: 1 });
    await expect(runOcr(IMG)).rejects.toThrow(/geçersiz/);
  });
});

describe("Google Vision", () => {
  it("metni ve blok güven ortalamasını okur; anahtar URL'de değil başlıkta", async () => {
    process.env.GOOGLE_VISION_API_KEY = "gk";
    const f = mockFetch({
      responses: [{ fullTextAnnotation: { text: "FB - GS\nMS 1 1.85\n", pages: [{ blocks: [{ confidence: 0.9 }, { confidence: 0.7 }] }] } }],
    });
    const out = await runOcr(IMG);
    expect(out.engine).toBe("google-vision");
    expect(out.text).toBe("FB - GS\nMS 1 1.85");
    expect(out.confidence).toBeCloseTo(0.8, 5);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("gk");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("gk");
  });
  it("metin yoksa boş + güven 0; API hatasını fırlatır", async () => {
    process.env.GOOGLE_VISION_API_KEY = "gk";
    mockFetch({ responses: [{}] });
    expect(await runOcr(IMG)).toMatchObject({ text: "", confidence: 0 });
    mockFetch({ responses: [{ error: { code: 3, message: "bad image" } }] });
    await expect(runOcr(IMG)).rejects.toThrow(/bad image/);
  });
});

describe("Azure read", () => {
  it("satırları birleştirir, kelime güvenini ortalar", async () => {
    process.env.AZURE_VISION_ENDPOINT = "https://r.cognitiveservices.azure.com/";
    process.env.AZURE_VISION_KEY = "ak";
    const f = mockFetch({
      readResult: { blocks: [{ lines: [
        { text: "FB - GS", words: [{ confidence: 0.98 }, { confidence: 0.96 }] },
        { text: "MS 1 1.85", words: [{ confidence: 0.9 }] },
      ] }] },
    });
    const out = await runOcr(IMG);
    expect(out).toMatchObject({ engine: "azure-read", text: "FB - GS\nMS 1 1.85" });
    expect(out.confidence).toBeCloseTo(0.9467, 3);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://r.cognitiveservices.azure.com/computervision/imageanalysis:analyze");
    expect((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("ak");
  });
});

describe("hata dayanıklılığı", () => {
  it("geçici 503'te bir kez tekrar dener", async () => {
    process.env.OCR_API_URL = "https://bridge/ocr";
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () =>
      ++n === 1 ? new Response("down", { status: 503 }) : new Response(JSON.stringify({ text: "ok", confidence: 0.5 })),
    ));
    expect((await runOcr(IMG)).text).toBe("ok");
    expect(n).toBe(2);
  });
  it("kalıcı hata (401) tekrar denenmez ve fırlatır", async () => {
    process.env.OCR_API_URL = "https://bridge/ocr";
    const f = mockFetch({ e: 1 }, 401);
    await expect(runOcr(IMG)).rejects.toThrow(/401/);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("tesseract yerel dil verisi + gerçek OCR", () => {
  it("ocr-data/ tur+eng bulunur", () => {
    expect(resolveLangPath()).toMatch(/ocr-data$/);
  });
  it("gerçek görselden Türkçe metin okur", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260">
      <rect width="100%" height="100%" fill="white"/>
      <text x="30" y="90" font-size="56" font-family="DejaVu Sans, Arial, sans-serif" fill="black">FENERBAHÇE - GALATASARAY</text>
      <text x="30" y="190" font-size="56" font-family="DejaVu Sans, Arial, sans-serif" fill="black">MS 1   1.85</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const out = await runOcr(png);
    expect(out.engine).toBe("tesseract.js");
    expect(out.text.toUpperCase()).toContain("GALATASARAY");
    expect(out.text).toContain("1.85");
  }, 120_000);
});

describe("OCR_FALLBACK=tesseract", () => {
  it("harici motor düşerse tesseract'a geçer ve engine'e yazar", async () => {
    process.env.OCR_API_URL = "https://bridge/ocr";
    process.env.OCR_FALLBACK = "tesseract";
    mockFetch({ e: 1 }, 401);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><rect width="100%" height="100%" fill="white"/><text x="20" y="100" font-size="60" font-family="DejaVu Sans, Arial, sans-serif">KUPON 123</text></svg>`;
    const out = await runOcr(await sharp(Buffer.from(svg)).png().toBuffer());
    expect(out.engine).toBe("tesseract.js (fallback:paddleocr-bridge)");
    expect(out.text.toUpperCase()).toContain("KUPON");
  }, 120_000);
});
