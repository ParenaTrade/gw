import { describe, expect, it } from "vitest";
import { parseWithRules } from "@/lib/ai/parser";
import { CouponParseSchema } from "@/lib/ai/schema";

const CLEAN_OCR = `SPOR KUPONU
CPN-000123

FENERBAHCE - GALATASARAY
MS 1 1.85
BARCELONA - REAL MADRID
MS X 3.40
LIVERPOOL - ARSENAL
KG VAR 1.72
22.11.2026 18:32
TOPLAM ORAN 10.82
BAHIS TUTARI 50.00 TL

SANSINIZ ACİK OLSUN!`;

describe("kural tabanlı kupon parser (AI yokken)", () => {
  it("temiz OCR metnini eksiksiz yapılandırır", () => {
    const parse = parseWithRules(CLEAN_OCR, 0.92);
    expect(parse.bets).toHaveLength(3);
    expect(parse.bets[0]).toMatchObject({
      row: 1,
      homeTeam: "FENERBAHCE",
      awayTeam: "GALATASARAY",
      market: "MATCH_WINNER",
      selection: "HOME",
      printedOdds: 1.85,
      needsReview: false,
    });
    expect(parse.bets[1].printedOdds).toBe(3.4);
    expect(parse.bets[2]).toMatchObject({ market: "BOTH_TEAMS_TO_SCORE", selection: "YES", printedOdds: 1.72 });
    expect(parse.physicalDate).toBe("2026-11-22");
    expect(parse.physicalTime).toBe("18:32");
    expect(parse.printedTotalOdds).toBe(10.82);
    expect(parse.stakeAmount).toBe("50.00");
    expect(parse.needsReview).toBe(false);
  });

  it("okunamayan oran uydurulmaz, needs_review işaretlenir", () => {
    const noisy = `BOCA JUNIORS - RIVER PLATE
MS 1
22.11.2026 20:00`;
    const parse = parseWithRules(noisy, 0.7);
    expect(parse.bets).toHaveLength(1);
    expect(parse.bets[0].printedOdds).toBeNull();
    expect(parse.bets[0].needsReview).toBe(true);
    expect(parse.needsReview).toBe(true);
  });

  it("boş metin → boş kupon + needs_review", () => {
    const parse = parseWithRules("", 0.9);
    expect(parse.bets).toHaveLength(0);
    expect(parse.needsReview).toBe(true);
  });

  it("çıktı her zaman Zod şemasından geçer", () => {
    const parse = parseWithRules(CLEAN_OCR, 0.92);
    expect(CouponParseSchema.safeParse(parse).success).toBe(true);
  });

  it("tek satır biçimi de desteklenir", () => {
    const parse = parseWithRules("Ajax - PSV MS 1 2.10", 0.9);
    expect(parse.bets).toHaveLength(1);
    expect(parse.bets[0]).toMatchObject({ homeTeam: "Ajax", awayTeam: "PSV", printedOdds: 2.1 });
  });
});

describe("AI şema doğrulaması", () => {
  it("uydurma veri reddedilir: oran null ama needsReview false → geçersiz", () => {
    const bad = {
      row: 1, homeTeam: "A", awayTeam: "B", league: null,
      market: "MATCH_WINNER", selection: "HOME",
      printedOdds: null, confidence: 0.9, needsReview: false,
    };
    const result = CouponParseSchema.shape.bets.element.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
