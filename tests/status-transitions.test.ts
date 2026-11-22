import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  COUPON_STATUSES,
  isActiveStatus,
  MEMBER_APPROVABLE_STATUSES,
  STATUS_META,
  TRANSITIONS,
} from "@/lib/coupons/status";

describe("durum makinesi", () => {
  it("kanonik durum listesi eksiksiz ve meta ile eşleşir", () => {
    expect(COUPON_STATUSES.length).toBe(23);
    for (const s of COUPON_STATUSES) {
      expect(STATUS_META[s].label.length).toBeGreaterThan(0);
      expect(STATUS_META[s].description.length).toBeGreaterThan(0);
      expect(TRANSITIONS[s]).toBeDefined();
    }
  });

  it("geçerli ana akış transition'ları", () => {
    expect(canTransition("DRAFT", "UPLOADED")).toBe(true);
    expect(canTransition("UPLOADED", "OCR_PROCESSING")).toBe(true);
    expect(canTransition("OCR_PROCESSING", "AI_PROCESSING")).toBe(true);
    expect(canTransition("AI_PROCESSING", "READY_FOR_MEMBER_APPROVAL")).toBe(true);
    expect(canTransition("READY_FOR_MEMBER_APPROVAL", "MEMBER_APPROVED")).toBe(true);
    expect(canTransition("MEMBER_APPROVED", "PARTNER_QUEUE")).toBe(true);
    expect(canTransition("PARTNER_QUEUE", "PARTNER_PROCESSING")).toBe(true);
    expect(canTransition("SUBMITTED", "ACCEPTED")).toBe(true);
    expect(canTransition("RESULT_PENDING", "WON")).toBe(true);
    expect(canTransition("WON", "SETTLED")).toBe(true);
    expect(canTransition("NEEDS_REVIEW", "READY_FOR_MEMBER_APPROVAL")).toBe(true);
    expect(canTransition("READY_FOR_MEMBER_APPROVAL", "NEEDS_REVIEW")).toBe(true);
    expect(canTransition("OCR_FAILED", "OCR_PROCESSING")).toBe(true);
  });

  it("geçersiz transition'lar engellenir", () => {
    expect(canTransition("DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransition("SETTLED", "WON")).toBe(false);
    expect(canTransition("CANCELLED", "UPLOADED")).toBe(false);
    expect(canTransition("PARTNER_QUEUE", "SUBMITTED")).toBe(false);
    expect(() => assertTransition("DRAFT", "SETTLED")).toThrow(/Geçersiz durum geçişi/);
  });

  it("üye onayı yalnızca izin verilen durumlarda", () => {
    expect(MEMBER_APPROVABLE_STATUSES).toContain("UPLOADED");
    expect(MEMBER_APPROVABLE_STATUSES).toContain("READY_FOR_MEMBER_APPROVAL");
    expect(MEMBER_APPROVABLE_STATUSES).not.toContain("ACCEPTED");
    expect(MEMBER_APPROVABLE_STATUSES).not.toContain("PARTNER_QUEUE");
  });

  it("terminal durumlar aktif sayılmaz", () => {
    expect(isActiveStatus("SETTLED")).toBe(false);
    expect(isActiveStatus("WON")).toBe(false);
    expect(isActiveStatus("PARTNER_QUEUE")).toBe(true);
  });
});
