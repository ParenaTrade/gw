import { describe, expect, it } from "vitest";
import { compareAmounts, fromCents, multiplyStakeByOdds, sumAmounts, toCents } from "@/lib/money";

describe("decimal-safe para aritmetiği", () => {
  it("kuruş dönüşümü kayıpsız", () => {
    expect(toCents("50.00")).toBe(BigInt(5000));
    expect(toCents("0.01")).toBe(BigInt(1));
    expect(toCents("-842.00")).toBe(BigInt(-84200));
    expect(fromCents(BigInt(54094))).toBe("540.94");
    expect(fromCents(BigInt(-50))).toBe("-0.50");
  });

  it("float hatası olmayan oran çarpımı (HALF-UP)", () => {
    // 50.00 × 1.85 × 3.40 × 1.72 = 540.94
    expect(multiplyStakeByOdds("50.00", ["1.85", "3.40", "1.72"])).toBe("540.94");
    // 100.00 × 2.10 × 4.01 = 842.10
    expect(multiplyStakeByOdds("100.00", ["2.10", "4.01"])).toBe("842.10");
    expect(multiplyStakeByOdds("10.00", ["1.01"])).toBe("10.10");
  });

  it("ledger toplamı string kalır", () => {
    expect(sumAmounts(["842.00", "-842.00"])).toBe("0.00");
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
  });

  it("geçersiz biçimler reddedilir", () => {
    expect(() => toCents("12.345")).toThrow();
    expect(() => toCents("abc")).toThrow();
    expect(() => multiplyStakeByOdds("-1.00", ["2.00"])).toThrow();
  });

  it("karşılaştırma", () => {
    expect(compareAmounts("1.78", "1.85")).toBe(-1);
    expect(compareAmounts("2.00", "2.00")).toBe(0);
  });
});
