/** Türkçe karakter normalization + benzerlik skorları ( RapidFuzz benzeri, bağımlılıksız). */

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", C: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

/** ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u + diakritik temizliği + token sadeleştirme. */
export function foldText(input: string): string {
  return input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CLUB_TOKENS = new Set(["fc", "sk", "ac", "cf", "sc", "afc", "cfc", "fk", "ks", "club", "calcio", "kulubu"]);

export function stripClubTokens(folded: string): string {
  return folded
    .split(" ")
    .filter((t) => t && !CLUB_TOKENS.has(t))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 0..1 benzerlik: Levenshtein oranı + token Jaccard karışımı. */
export function similarity(a: string, b: string): number {
  const fa = stripClubTokens(foldText(a));
  const fb = stripClubTokens(foldText(b));
  if (!fa || !fb) return 0;
  if (fa === fb) return 1;
  const lev = 1 - levenshtein(fa, fb) / Math.max(fa.length, fb.length);
  const ta = new Set(fa.split(" "));
  const tb = new Set(fb.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const jaccard = inter / (ta.size + tb.size - inter);
  // Tek token typo'larında Levenshtein, çok kelimeli yeniden adlandırmalarda
  // Jaccard baskındır; ikisinin maksimumu alınır (ağırlıklı toplam typo'yı
  // haksız yere düşürür). Nihai karar yine matcher bağlamıyla verilir.
  return Math.max(0, Math.min(1, Math.max(lev, jaccard)));
}

/** "1,85" / "1.85" / "18" → "1.85" / "18.00" (decimal-safe string). */
export function normalizeOddsString(input: string): string | null {
  const m = input.trim().replace(",", ".").match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return `${m[1]}.${(m[2] ?? "").padEnd(2, "0")}`;
}
