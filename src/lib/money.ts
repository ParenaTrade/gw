/**
 * Decimal-safe para/oran aritmetiği — bigint tabanlı, float YOK.
 * Tutarlar string olarak taşınır ("50.00"), oranlar 2 ondalık ("1.85").
 * Yuvarlama kuralı: HALF-UP, 2 ondalık (TRY kuruş).
 */

const AMOUNT_RE = /^-?\d{1,12}(\.\d{1,2})?$/;
const ODDS_RE = /^\d{1,6}(\.\d{1,2})?$/;
const HUNDRED = BigInt(100);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

export function toCents(amount: string): bigint {
  if (!AMOUNT_RE.test(amount)) {
    throw new Error(`Geçersiz tutar biçimi: ${amount}`);
  }
  const negative = amount.startsWith("-");
  const body = negative ? amount.slice(1) : amount;
  const [whole, frac = ""] = body.split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const frac = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

function toOddsScaled(odds: string): bigint {
  if (!ODDS_RE.test(odds)) throw new Error(`Geçersiz oran biçimi: ${odds}`);
  const [whole, frac = ""] = odds.split(".");
  return BigInt(whole) * HUNDRED + BigInt((frac + "00").slice(0, 2));
}

/**
 * stake × Π(odds) — tüm oranlar çarpıldıktan sonra tek kez HALF-UP yuvarlanır.
 * Örn: multiplyStakeByOdds("50.00", ["1.85","3.40","1.72"]) → "540.94"
 */
export function multiplyStakeByOdds(stake: string, oddsList: string[]): string {
  const stakeCents = toCents(stake);
  if (stakeCents < ZERO) throw new Error("Stake negatif olamaz.");
  let numerator = stakeCents;
  let denominator = ONE;
  for (const odds of oddsList) {
    numerator *= toOddsScaled(odds);
    denominator *= HUNDRED;
  }
  const rounded = (numerator + denominator / TWO) / denominator;
  return fromCents(rounded);
}

export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), ZERO));
}

export function compareAmounts(a: string, b: string): number {
  const ca = toCents(a);
  const cb = toCents(b);
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}
