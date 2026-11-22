import { describe, expect, it } from "vitest";
import { couponCreateSchema, phoneSchema, verifySchema } from "@/lib/validation/schemas";

describe("zod giriş doğrulama", () => {
  it("TR telefon normalizasyonu", () => {
    expect(phoneSchema.parse("0555 111 22 33")).toBe("+905551112233");
    expect(phoneSchema.parse("5551112233")).toBe("+905551112233");
    expect(phoneSchema.parse("+90 (555) 111-22-33")).toBe("+905551112233");
    expect(phoneSchema.parse("00905551112233")).toBe("+905551112233");
    expect(() => phoneSchema.parse("123")).toThrow();
  });

  it("OTP kodu 6 hane zorunlu", () => {
    expect(verifySchema.parse({ phone: "5551112233", code: "123456" }).code).toBe("123456");
    expect(() => verifySchema.parse({ phone: "5551112233", code: "12a456" })).toThrow();
    expect(() => verifySchema.parse({ phone: "5551112233", code: "12345" })).toThrow();
  });

  it("kupon oluşturma şeması", () => {
    const ok = couponCreateSchema.parse({ physicalDate: "2026-11-22", physicalTime: "18:32", stakeAmount: "50.00" });
    expect(ok.stakeAmount).toBe("50.00");
    expect(() => couponCreateSchema.parse({ stakeAmount: "50,00" })).toThrow();
    expect(() => couponCreateSchema.parse({ physicalDate: "22.11.2026" })).toThrow();
    expect(couponCreateSchema.parse({})).toEqual({});
  });
});
