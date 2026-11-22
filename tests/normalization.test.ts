import { describe, expect, it } from "vitest";
import { foldText, normalizeOddsString, similarity, stripClubTokens } from "@/lib/normalization/text";
import { resolveTeam } from "@/lib/normalization/teams";
import { normalizeMarket, marketDisplay } from "@/lib/normalization/markets";

describe("türkçe karakter normalization", () => {
  it("ç ğ ı ö ş ü katlama", () => {
    expect(foldText("FENERBAHÇE")).toBe("fenerbahce");
    expect(foldText("Beşiktaş JK")).toBe("besiktas jk");
    expect(foldText("İSTANBUL")).toBe("istanbul");
    expect(stripClubTokens(foldText("Manchester United FC"))).toBe("manchester united");
  });

  it("oran string normalizasyonu", () => {
    expect(normalizeOddsString("1,85")).toBe("1.85");
    expect(normalizeOddsString("3.4")).toBe("3.40");
    expect(normalizeOddsString("12")).toBe("12.00");
    expect(normalizeOddsString("abc")).toBeNull();
  });
});

describe("takım normalization", () => {
  it("alias → canonical (exact)", () => {
    expect(resolveTeam("Man Utd")).toMatchObject({ canonical: "Manchester United", method: "exact", score: 1 });
    expect(resolveTeam("Manchester Utd").canonical).toBe("Manchester United");
    expect(resolveTeam("Manchester United FC").canonical).toBe("Manchester United");
    expect(resolveTeam("Fenerbahce").canonical).toBe("Fenerbahçe");
    expect(resolveTeam("Barça").canonical).toBe("Barcelona");
  });

  it("fuzzy tek başına kesin karar değildir", () => {
    const r = resolveTeam("Fenerbahcee");
    expect(r.canonical).toBe("Fenerbahçe");
    expect(r.method).toBe("fuzzy");
    expect(r.score).toBeGreaterThan(0.8);
    expect(r.score).toBeLessThan(1);
  });

  it("benzerlik skoru makul", () => {
    expect(similarity("Liverpool", "Liverpool FC")).toBe(1);
    expect(similarity("Ajax", "PSV")).toBeLessThan(0.5);
  });
});

describe("market normalization", () => {
  it("sözlük eşlemeleri", () => {
    expect(normalizeMarket("MS 1")).toEqual({ market: "MATCH_WINNER", selection: "HOME" });
    expect(normalizeMarket("1")).toEqual({ market: "MATCH_WINNER", selection: "HOME" });
    expect(normalizeMarket("EV SAHİBİ")).toEqual({ market: "MATCH_WINNER", selection: "HOME" });
    expect(normalizeMarket("MS X")).toEqual({ market: "MATCH_WINNER", selection: "DRAW" });
    expect(normalizeMarket("2")).toEqual({ market: "MATCH_WINNER", selection: "AWAY" });
    expect(normalizeMarket("KG VAR")).toEqual({ market: "BOTH_TEAMS_TO_SCORE", selection: "YES" });
    expect(normalizeMarket("BTTS YES")).toEqual({ market: "BOTH_TEAMS_TO_SCORE", selection: "YES" });
    expect(normalizeMarket("bilinmeyen market")).toBeNull();
  });

  it("görüntüleme etiketi", () => {
    expect(marketDisplay("MATCH_WINNER", "HOME")).toBe("MS 1");
    expect(marketDisplay("BOTH_TEAMS_TO_SCORE", "YES")).toBe("KG VAR");
  });
});
