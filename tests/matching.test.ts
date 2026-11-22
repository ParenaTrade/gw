import { describe, expect, it } from "vitest";
import { matchEvent, scoreEventMatch, selectionOdds, type CatalogEvent } from "@/lib/matching/events";

const EVENT: CatalogEvent = {
  id: "e1",
  externalId: "EVT-001",
  homeTeam: "Fenerbahçe",
  awayTeam: "Galatasaray",
  league: "Süper Lig",
  eventDate: "2026-11-22",
  startTime: "20:00",
  markets: { MATCH_WINNER: { HOME: "1.78", DRAW: "3.60", AWAY: "4.20" } },
};

describe("event matching", () => {
  it("tam bağlam (takımlar + lig + tarih) → yüksek güven >= 0.95", () => {
    const r = matchEvent(
      { home: "Fenerbahçe", away: "Galatasaray", league: "Süper Lig", date: "2026-11-22" },
      [EVENT]
    );
    expect(r.event?.externalId).toBe("EVT-001");
    expect(r.confidence).toBeGreaterThanOrEqual(0.95);
    expect(r.needsReview).toBe(false);
  });

  it("alias'lar canonical üzerinden tam eşleşir", () => {
    const r = matchEvent({ home: "Fener", away: "Gala", league: "Süper Lig", date: "2026-11-22" }, [EVENT]);
    expect(r.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("fuzzy eşleşme manuel kontrol bandına sabitlenir (0.80–0.95)", () => {
    const r = matchEvent(
      { home: "Fenerbahcee", away: "Galatasaray", league: "Süper Lig", date: "2026-11-22" },
      [EVENT]
    );
    expect(r.event).not.toBeNull();
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
    expect(r.confidence).toBeLessThan(0.95);
    expect(r.needsReview).toBe(true);
  });

  it("alakasız takımlar → eşleşme başarısız (< 0.80)", () => {
    const r = matchEvent({ home: "Boca Juniors", away: "River Plate", league: "Liga Profesional", date: "2026-11-22" }, [EVENT]);
    expect(r.event).toBeNull();
    expect(r.confidence).toBeLessThan(0.8);
    expect(r.needsReview).toBe(true);
  });

  it("market/seçim oranı katalogdan okunur", () => {
    expect(selectionOdds(EVENT, "MATCH_WINNER", "HOME")).toBe("1.78");
    expect(selectionOdds(EVENT, "MATCH_WINNER", "AWAY")).toBe("4.20");
    expect(selectionOdds(EVENT, "OVER_UNDER", "OVER")).toBeNull();
  });

  it("skor deterministik ve 0..1 aralığında", () => {
    const s = scoreEventMatch({ home: "Fenerbahçe", away: "Galatasaray" }, EVENT);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(s).toBe(0.9);
  });
});
