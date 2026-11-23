/**
 * OCR sağlayıcı çağrıları için ortak HTTP yardımcısı: zaman aşımı + geçici
 * hatalarda (ağ, 429, 5xx) tek tekrar. Hata mesajlarına URL/anahtar sızdırılmaz.
 */

export class OcrHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    detail?: string,
  ) {
    super(`${provider} HTTP ${status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    this.name = "OcrHttpError";
  }
}

function transient(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function postJson<T>(
  provider: string,
  url: string,
  init: { headers?: Record<string, string>; body: BodyInit; timeoutMs?: number },
  retries = 1,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: init.headers,
        body: init.body,
        signal: AbortSignal.timeout(init.timeoutMs ?? 60_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const err = new OcrHttpError(provider, res.status, detail);
        if (transient(res.status) && attempt < retries) {
          lastError = err;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        throw err;
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof OcrHttpError) throw e;
      lastError = e; // ağ / timeout
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${provider} isteği başarısız`);
}
