import { db } from "@/db";
import { eventCatalog, teams } from "@/db/schema";
import type { CanonicalTeam } from "@/lib/normalization/teams";
import type { CatalogEvent } from "./events";

/** Event kataloğu + canonical takımlar (demo besleme; Faz 5'te adapter besler). */
export async function loadCatalog(): Promise<{ catalog: CatalogEvent[]; extraTeams: CanonicalTeam[] }> {
  const [events, teamRows] = await Promise.all([db.select().from(eventCatalog), db.select().from(teams)]);
  return {
    catalog: events.map((e) => ({
      id: e.id,
      externalId: e.externalId,
      homeTeam: e.homeTeam,
      awayTeam: e.awayTeam,
      league: e.league,
      eventDate: e.eventDate,
      startTime: e.startTime,
      markets: e.markets,
    })),
    extraTeams: teamRows.map((t) => ({ name: t.canonicalName, aliases: t.aliases })),
  };
}
