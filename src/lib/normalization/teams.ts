import { foldText, similarity, stripClubTokens } from "./text";

/**
 * Canonical takım kayıtları + alias sözlüğü.
 * kural: yalnızca fuzzy skora göre nihai karar VERİLMEZ — matcher'da
 * lig/tarih bağlamı ve ikinci takım skoru ile birlikte değerlendirilir.
 */

export type CanonicalTeam = { name: string; aliases: string[] };

export const CANONICAL_TEAMS: CanonicalTeam[] = [
  { name: "Fenerbahçe", aliases: ["Fenerbahce", "Fenerbahçe SK", "Fener"] },
  { name: "Galatasaray", aliases: ["Galatasaray SK", "Gala", "GS"] },
  { name: "Beşiktaş", aliases: ["Besiktas", "Besiktas JK", "BJK"] },
  { name: "Trabzonspor", aliases: ["Trabzon", "TS"] },
  { name: "Barcelona", aliases: ["FC Barcelona", "Barca", "Barça"] },
  { name: "Real Madrid", aliases: ["Real Madrid CF", "R Madrid", "Real"] },
  { name: "Liverpool", aliases: ["Liverpool FC", "LFC"] },
  { name: "Arsenal", aliases: ["Arsenal FC", "ARS"] },
  { name: "Manchester United", aliases: ["Man Utd", "Manchester Utd", "Manchester United FC", "Man United"] },
  { name: "Manchester City", aliases: ["Man City", "Manchester City FC"] },
  { name: "Ajax", aliases: ["AFC Ajax", "Ajax Amsterdam"] },
  { name: "PSV", aliases: ["PSV Eindhoven"] },
  { name: "Celtic", aliases: ["Celtic FC", "Celtic Glasgow"] },
  { name: "Rangers", aliases: ["Rangers FC", "Glasgow Rangers"] },
];

export type TeamResolution = {
  canonical: string;
  score: number;
  method: "exact" | "fuzzy" | "none";
};

export function resolveTeam(input: string, extraTeams: CanonicalTeam[] = []): TeamResolution {
  const folded = stripClubTokens(foldText(input));
  if (!folded) return { canonical: input.trim(), score: 0, method: "none" };

  const all = [...CANONICAL_TEAMS, ...extraTeams];
  for (const team of all) {
    const names = [team.name, ...team.aliases].map((n) => stripClubTokens(foldText(n)));
    if (names.includes(folded)) {
      return { canonical: team.name, score: 1, method: "exact" };
    }
  }

  let best: TeamResolution = { canonical: input.trim(), score: 0, method: "none" };
  for (const team of all) {
    for (const n of [team.name, ...team.aliases]) {
      const score = similarity(folded, n);
      if (score > best.score) best = { canonical: team.name, score, method: "fuzzy" };
    }
  }
  return best.score >= 0.6 ? best : { canonical: input.trim(), score: best.score, method: "none" };
}
