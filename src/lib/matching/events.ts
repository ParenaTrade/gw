import { resolveTeam, type CanonicalTeam } from "@/lib/normalization/teams";
import { foldText, similarity } from "@/lib/normalization/text";

/**
 * Event matching: home_team + away_team + league + date kombinasyonu.
 * Confidence eşikleri: >=0.95 yüksek güven, 0.80–0.95 manuel kontrol,
 * <0.80 eşleşme başarısız. Yalnızca fuzzy skora göre nihai karar verilmez:
 * fuzzy eşleşmeler her zaman manuel kontrol bandına sabitlenir.
 */

export type CatalogEvent = {
  id: string;
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  league: string | null;
  eventDate: string | null;
  startTime: string | null;
  markets: Record<string, Record<string, string>>;
};

export type MatchInput = {
  home: string;
  away: string;
  league?: string | null;
  date?: string | null;
};

export type MatchResult = {
  event: CatalogEvent | null;
  confidence: number;
  needsReview: boolean;
};

function teamSim(input: string, catalogName: string, extraTeams: CanonicalTeam[]): { sim: number; exact: boolean } {
  const resolved = resolveTeam(input, extraTeams);
  const foldedCatalog = foldText(catalogName);
  const foldedResolved = foldText(resolved.canonical);
  if (resolved.method === "exact" && foldedResolved === foldedCatalog) {
    return { sim: 1, exact: true };
  }
  const direct = similarity(input, catalogName);
  const viaCanonical = similarity(resolved.canonical, catalogName);
  return { sim: Math.max(direct, viaCanonical), exact: false };
}

function dateBonus(inputDate: string | null | undefined, eventDate: string | null): number {
  if (!inputDate || !eventDate) return 0;
  const a = new Date(`${inputDate}T00:00:00Z`).getTime();
  const b = new Date(`${eventDate}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const days = (b - a) / 86_400_000;
  return days >= -1 && days <= 7 ? 0.05 : 0;
}

export function scoreEventMatch(input: MatchInput, event: CatalogEvent, extraTeams: CanonicalTeam[] = []): number {
  const home = teamSim(input.home, event.homeTeam, extraTeams);
  const away = teamSim(input.away, event.awayTeam, extraTeams);
  let score = 0.45 * home.sim + 0.45 * away.sim;

  if (input.league && event.league) {
    const fl = foldText(input.league);
    const el = foldText(event.league);
    if (fl && (fl === el || el.includes(fl) || fl.includes(el))) score += 0.05;
  }
  score += dateBonus(input.date, event.eventDate);

  // Fuzzy-only karar engeli: bağlam tam olsa bile fuzzy takım → manuel kontrol.
  if (!home.exact || !away.exact) score = Math.min(score, 0.92);
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

export function matchEvent(input: MatchInput, catalog: CatalogEvent[], extraTeams: CanonicalTeam[] = []): MatchResult {
  let best: { event: CatalogEvent; score: number } | null = null;
  for (const event of catalog) {
    const score = scoreEventMatch(input, event, extraTeams);
    if (!best || score > best.score) best = { event, score };
  }
  if (!best || best.score < 0.8) {
    return { event: null, confidence: best?.score ?? 0, needsReview: true };
  }
  return { event: best.event, confidence: best.score, needsReview: best.score < 0.95 };
}

export function selectionOdds(event: CatalogEvent, market: string, selection: string): string | null {
  const value = event.markets?.[market]?.[selection];
  return typeof value === "string" ? value : null;
}
