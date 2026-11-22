import { describe, expect, it } from "vitest";
import { maskName, maskPhone, normalizePhone } from "@/lib/format";
import { sanitizeAuditData } from "@/lib/audit/log";

describe("KVKK maskeleme ve audit sanitizasyonu", () => {
  it("telefon maskeleme", () => {
    expect(maskPhone("+905551112233")).toBe("+90******2233");
    expect(maskPhone(null)).toBe("—");
    expect(normalizePhone("abc")).toBeNull();
  });

  it("ad maskeleme", () => {
    expect(maskName("Demo Üye")).toBe("D*** Ü***");
  });

  it("audit: secret/token asla loglanmaz, PII maskelenir", () => {
    const input = {
      phone: "+905551112233",
      fullName: "Demo Üye",
      access_token: "super-secret-token",
      otpCode: "123456",
      nested: { password: "hunter2", stake: "50.00" },
    };
    const out = sanitizeAuditData(input) as Record<string, unknown>;
    expect(out.phone).toBe("+90******2233");
    expect(out.fullName).toBe("D*** Ü***");
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.otpCode).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).stake).toBe("50.00");
  });
});
