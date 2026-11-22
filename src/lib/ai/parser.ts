import { CouponParseSchema, type CouponParse, type CouponBetParse } from "@/lib/ai/schema";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/ai/prompts/coupon-parser-v1";
import { normalizeMarket } from "@/lib/normalization/markets";
import { normalizeOddsString } from "@/lib/normalization/text";

/**
 * AI yalnızca OCR metnini yapılandırır. AI_API_KEY yoksa deterministik
 * kural tabanlı ayrıştırıcı çalışır (model: "rule-based-v1") — bu bir mock
 * değildir; yalnızca metinde gerçekten olan veriyi çıkarır, uydurmaz.
 */

const TEAM_CHARS = "A-Za-zÇĞİÖŞÜçğıöşü0-9 .'&";
const TEAM_LINE = new RegExp(`^([${TEAM_CHARS}]{2,45})\\s*[-–—]\\s*([${TEAM_CHARS}]{2,45})$`);
const HAS_LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
const ODDS_TAIL = /^(.*?)\s*(\d{1,2}[.,]\d{2})\s*$/;
const MARKET_ONLY = /^(MS\s*[12Xx]|KG\s*(VAR|YOK)|[12X]|[ÇC]Ş\s*[1X2]-[1X2]|[2][.,]5\s*(ÜST|ALT|UST|ALT))\s*$/i;
const SKIP_LINE = /^(spor kuponu|cpn[-\s]|toplam|bahis tutari|bahis tutarı|sansiniz|şansınız|tarih|kupON|kupon no|barcode)/i;

function toIsoDate(d: string, m: string, y: string): string | null {
  const dd = Number(d), mm = Number(m), yy = Number(y);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yy < 2000 || yy > 2100) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseWithRules(text: string, ocrConfidence: number): CouponParse {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bets: CouponBetParse[] = [];

  let physicalDate: string | null = null;
  let physicalTime: string | null = null;
  let printedTotalOdds: number | null = null;
  let stakeAmount: string | null = null;

  const dateMatch = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dateMatch) physicalDate = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) physicalTime = `${String(Number(timeMatch[1])).padStart(2, "0")}:${timeMatch[2]}`;
  const totalMatch = text.match(/toplam\s*oran\D*(\d{1,4}[.,]\d{1,2})/i);
  if (totalMatch) {
    const norm = normalizeOddsString(totalMatch[1]);
    if (norm) printedTotalOdds = Number(norm);
  }
  const stakeMatch = text.match(/(\d{1,8}[.,]\d{2})\s*(TL|₺)/i);
  if (stakeMatch) stakeAmount = stakeMatch[1].replace(",", ".");

  const pushBet = (home: string, away: string, marketRaw: string | null, oddsRaw: string | null) => {
    const normalized = marketRaw ? normalizeMarket(marketRaw) : null;
    const odds = oddsRaw ? normalizeOddsString(oddsRaw) : null;
    let confidence = Math.max(0.05, Math.min(1, ocrConfidence));
    let needsReview = false;
    if (!normalized) { confidence *= 0.6; needsReview = true; }
    if (!odds) { confidence *= 0.5; needsReview = true; }
    bets.push({
      row: bets.length + 1,
      homeTeam: home.trim(),
      awayTeam: away.trim(),
      league: null,
      market: normalized?.market ?? (marketRaw?.toUpperCase() ?? "UNKNOWN"),
      selection: normalized?.selection ?? "UNKNOWN",
      printedOdds: odds ? Number(odds) : null,
      confidence: Math.round(confidence * 100) / 100,
      needsReview,
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (SKIP_LINE.test(line)) continue;

    // Tek satır: "Takım A - Takım B MS 1 1.85"
    const inline = line.match(new RegExp(`^([${TEAM_CHARS}]{2,45}?\\s*[-–—]\\s*[${TEAM_CHARS}]{2,45}?)\\s+(MS\\s*[12Xx]|KG\\s*(?:VAR|YOK)|[ÇC]Ş\\s*[1X2]-[1X2]|[2][.,]5\\s*(?:ÜST|ALT|UST))\\s+(\\d{1,2}[.,]\\d{2})\\s*$`, "i"));
    if (inline) {
      const parts = inline[1].split(/[-–—]/);
      if (parts.length === 2 && HAS_LETTER.test(parts[0]) && HAS_LETTER.test(parts[1])) {
        pushBet(parts[0], parts[1], inline[2], inline[3]);
        continue;
      }
    }

    // İki satır: takım satırı + market/oran satırı
    const team = line.match(TEAM_LINE);
    if (team && HAS_LETTER.test(team[1]) && HAS_LETTER.test(team[2]) && !/\d{2}[./-]\d{2}/.test(line)) {
      let marketRaw: string | null = null;
      let oddsRaw: string | null = null;
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
        const next = lines[j];
        if (TEAM_LINE.test(next)) break;
        const tail = next.match(ODDS_TAIL);
        if (tail && tail[1] && MARKET_ONLY.test(tail[1].trim())) {
          marketRaw = tail[1].trim();
          oddsRaw = tail[2];
          i = j;
          break;
        }
        if (MARKET_ONLY.test(next)) {
          marketRaw = next;
          i = j;
          break;
        }
        if (tail && !tail[1]) {
          oddsRaw = tail[2];
          i = j;
          break;
        }
      }
      pushBet(team[1], team[2], marketRaw, oddsRaw);
    }
  }

  const confidence = bets.length
    ? Math.round((bets.reduce((a, b) => a + b.confidence, 0) / bets.length) * 100) / 100
    : Math.min(0.3, ocrConfidence);

  return CouponParseSchema.parse({
    bets,
    physicalDate,
    physicalTime,
    printedTotalOdds,
    stakeAmount,
    confidence,
    needsReview: bets.length === 0 || bets.some((b) => b.needsReview),
  });
}

async function parseWithLlm(text: string): Promise<{ parse: CouponParse; model: string }> {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI_API_KEY yok");
  const baseUrl = process.env.AI_API_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `OCR TEXT:\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI boş yanıt");
  const parsed = CouponParseSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error("AI çıktısı Zod doğrulamasından geçemedi");
  return { parse: parsed.data, model };
}

export type ParseResult = { parse: CouponParse; model: string; promptVersion: string; source: "llm" | "rules" };

export async function parseCouponText(text: string, ocrConfidence: number): Promise<ParseResult> {
  if (process.env.AI_API_KEY?.trim()) {
    try {
      const { parse, model } = await parseWithLlm(text);
      return { parse, model, promptVersion: PROMPT_VERSION, source: "llm" };
    } catch (e) {
      console.error(JSON.stringify({
        error_code: "AI_PARSE_FALLBACK",
        message: e instanceof Error ? e.message : String(e),
      }));
    }
  }
  return { parse: parseWithRules(text, ocrConfidence), model: "rule-based-v1", promptVersion: PROMPT_VERSION, source: "rules" };
}
