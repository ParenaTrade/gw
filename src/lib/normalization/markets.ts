import { foldText } from "./text";

/**
 * Market normalization sözlüğü — genişletilebilir.
 * MS 1 / 1 / HOME / EV SAHİBİ → MATCH_WINNER / HOME vb.
 */

export type NormalizedMarket = { market: string; selection: string };

const DICTIONARY: Record<string, NormalizedMarket> = {};

function register(keys: string[], market: string, selection: string) {
  for (const key of keys) DICTIONARY[foldText(key)] = { market, selection };
}

register(["MS 1", "MS1", "1", "HOME", "EV SAHİBİ", "EVSAHIBI", "MAC SONUCU 1"], "MATCH_WINNER", "HOME");
register(["MS X", "MSX", "X", "DRAW", "BERABERLİK", "MAC SONUCU X"], "MATCH_WINNER", "DRAW");
register(["MS 2", "MS2", "2", "AWAY", "DEPLASMAN", "MAC SONUCU 2"], "MATCH_WINNER", "AWAY");
register(["KG VAR", "KGVAR", "BTTS YES", "GG", "KARSILIKLI GOL VAR"], "BOTH_TEAMS_TO_SCORE", "YES");
register(["KG YOK", "KGYOK", "BTTS NO", "NG", "KARSILIKLI GOL YOK"], "BOTH_TEAMS_TO_SCORE", "NO");
register(["2.5 ÜST", "ÜST 2.5", "ÜST", "OVER 2.5", "OVER", "2 5 UST"], "OVER_UNDER", "OVER");
register(["2.5 ALT", "ALT 2.5", "ALT", "UNDER 2.5", "UNDER", "2 5 ALT"], "OVER_UNDER", "UNDER");
register(["ÇŞ 1-X", "1-X", "1X", "DOUBLE CHANCE 1X"], "DOUBLE_CHANCE", "HOME_DRAW");
register(["ÇŞ 1-2", "1-2", "12", "DOUBLE CHANCE 12"], "DOUBLE_CHANCE", "HOME_AWAY");
register(["ÇŞ X-2", "X-2", "X2", "DOUBLE CHANCE X2"], "DOUBLE_CHANCE", "DRAW_AWAY");

export function normalizeMarket(input: string): NormalizedMarket | null {
  return DICTIONARY[foldText(input)] ?? null;
}

/** UI seçim listesi (datalist). */
export const MARKET_OPTIONS = [
  "MS 1", "MS X", "MS 2",
  "KG VAR", "KG YOK",
  "2.5 ÜST", "2.5 ALT",
  "ÇŞ 1-X", "ÇŞ 1-2", "ÇŞ X-2",
];

export function marketDisplay(market: string, selection: string): string {
  const reverse: Record<string, string> = {
    "MATCH_WINNER:HOME": "MS 1",
    "MATCH_WINNER:DRAW": "MS X",
    "MATCH_WINNER:AWAY": "MS 2",
    "BOTH_TEAMS_TO_SCORE:YES": "KG VAR",
    "BOTH_TEAMS_TO_SCORE:NO": "KG YOK",
    "OVER_UNDER:OVER": "2.5 ÜST",
    "OVER_UNDER:UNDER": "2.5 ALT",
    "DOUBLE_CHANCE:HOME_DRAW": "ÇŞ 1-X",
    "DOUBLE_CHANCE:HOME_AWAY": "ÇŞ 1-2",
    "DOUBLE_CHANCE:DRAW_AWAY": "ÇŞ X-2",
  };
  return reverse[`${market}:${selection}`] ?? `${market} / ${selection}`;
}
