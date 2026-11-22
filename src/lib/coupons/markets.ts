/** Market/seçim görüntüleme etiketleri (normalize edilmiş kanonik değerler). */

const LABELS: Record<string, Record<string, string>> = {
  MATCH_WINNER: { HOME: "MS 1", DRAW: "MS X", AWAY: "MS 2" },
  BOTH_TEAMS_TO_SCORE: { YES: "KG VAR", NO: "KG YOK" },
  OVER_UNDER: { OVER: "ÜST", UNDER: "ALT" },
  DOUBLE_CHANCE: { HOME_DRAW: "1-X", HOME_AWAY: "1-2", DRAW_AWAY: "X-2" },
};

export function marketLabel(market: string, selection: string): string {
  return LABELS[market]?.[selection] ?? `${market} / ${selection}`;
}
