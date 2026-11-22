import type { CouponStatus } from "@/types/database";

/**
 * KUponum durum makinesi. Geçersiz transition her katmanda engellenir
 * (service + DB transaction + RLS). Faz 1'de OCR/AI adımları henüz aktif
 * değildir; UPLOADED → MEMBER_APPROVAL manuel üye doğrulama yoludur.
 */

export const COUPON_STATUSES = [
  "DRAFT",
  "UPLOADED",
  "OCR_PROCESSING",
  "OCR_FAILED",
  "AI_PROCESSING",
  "NEEDS_REVIEW",
  "READY_FOR_MEMBER_APPROVAL",
  "MEMBER_APPROVED",
  "PARTNER_QUEUE",
  "PARTNER_PROCESSING",
  "PLATFORM_PREPARING",
  "PENDING_CONFIRMATION",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "ODDS_CHANGED",
  "RESULT_PENDING",
  "WON",
  "LOST",
  "RESULT_UPDATED",
  "SETTLED",
  "FAILED",
  "CANCELLED",
] as const satisfies readonly CouponStatus[];

export const TRANSITIONS: Record<CouponStatus, readonly CouponStatus[]> = {
  DRAFT: ["UPLOADED", "CANCELLED", "FAILED"],
  UPLOADED: ["OCR_PROCESSING", "MEMBER_APPROVED", "CANCELLED", "FAILED"],
  OCR_PROCESSING: ["AI_PROCESSING", "OCR_FAILED", "FAILED"],
  OCR_FAILED: ["OCR_PROCESSING", "FAILED", "CANCELLED"],
  AI_PROCESSING: ["NEEDS_REVIEW", "READY_FOR_MEMBER_APPROVAL", "FAILED"],
  NEEDS_REVIEW: ["READY_FOR_MEMBER_APPROVAL", "CANCELLED", "FAILED"],
  READY_FOR_MEMBER_APPROVAL: ["MEMBER_APPROVED", "NEEDS_REVIEW", "CANCELLED"],
  MEMBER_APPROVED: ["PARTNER_QUEUE", "FAILED"],
  PARTNER_QUEUE: ["PARTNER_PROCESSING", "CANCELLED"],
  PARTNER_PROCESSING: ["PLATFORM_PREPARING", "FAILED"],
  PLATFORM_PREPARING: ["PENDING_CONFIRMATION", "ODDS_CHANGED", "FAILED"],
  PENDING_CONFIRMATION: ["SUBMITTED", "CANCELLED", "FAILED"],
  SUBMITTED: ["ACCEPTED", "REJECTED", "FAILED"],
  ACCEPTED: ["RESULT_PENDING"],
  REJECTED: ["SETTLED", "FAILED"],
  ODDS_CHANGED: ["PENDING_CONFIRMATION", "PLATFORM_PREPARING", "CANCELLED", "FAILED"],
  RESULT_PENDING: ["WON", "LOST", "FAILED"],
  WON: ["RESULT_UPDATED", "SETTLED"],
  LOST: ["RESULT_UPDATED", "SETTLED"],
  RESULT_UPDATED: ["WON", "LOST", "SETTLED"],
  SETTLED: [],
  FAILED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: CouponStatus, to: CouponStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: CouponStatus, to: CouponStatus) {
    super(`Geçersiz durum geçişi: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: CouponStatus, to: CouponStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Faz 1: üye, yüklenmiş kuponunu görseli kontrol ederek onaylar. */
export const MEMBER_APPROVABLE_STATUSES: readonly CouponStatus[] = [
  "UPLOADED",
  "READY_FOR_MEMBER_APPROVAL",
];

export const TERMINAL_STATUSES: readonly CouponStatus[] = [
  "SETTLED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
];

export const RESULT_STATUSES: readonly CouponStatus[] = ["WON", "LOST", "RESULT_UPDATED"];

export function isActiveStatus(status: CouponStatus): boolean {
  return !TERMINAL_STATUSES.includes(status) && !RESULT_STATUSES.includes(status);
}

export type StatusTone = "neutral" | "progress" | "warn" | "ok" | "danger";
export type StatusIcon =
  | "file"
  | "upload"
  | "scan"
  | "loader"
  | "eye"
  | "check"
  | "send"
  | "clock"
  | "alert"
  | "trophy"
  | "x"
  | "wallet"
  | "refresh";

export const STATUS_META: Record<
  CouponStatus,
  { label: string; description: string; icon: StatusIcon; tone: StatusTone }
> = {
  DRAFT: { label: "Taslak", description: "Kupon oluşturuldu, fotoğraf bekleniyor.", icon: "file", tone: "neutral" },
  UPLOADED: { label: "Yüklendi", description: "Fotoğraf alındı. Kontrol edip onaylayabilirsiniz.", icon: "upload", tone: "progress" },
  OCR_PROCESSING: { label: "Metin okunuyor", description: "Kupon görüntüsünden metin çıkarılıyor.", icon: "scan", tone: "progress" },
  OCR_FAILED: { label: "Okuma başarısız", description: "Metin okunamadı. Daha net bir fotoğraf gerekebilir.", icon: "alert", tone: "warn" },
  AI_PROCESSING: { label: "AI işliyor", description: "Kupon verisi yapılandırılıyor.", icon: "loader", tone: "progress" },
  NEEDS_REVIEW: { label: "Kontrol gerekiyor", description: "Bazı satırlar belirsiz. Lütfen kontrol edin.", icon: "eye", tone: "warn" },
  READY_FOR_MEMBER_APPROVAL: { label: "Onaya hazır", description: "Kuponunuz kontrol ve onayınızı bekliyor.", icon: "check", tone: "progress" },
  MEMBER_APPROVED: { label: "Onayladınız", description: "Kupon onayınız sisteme kaydedildi.", icon: "check", tone: "ok" },
  PARTNER_QUEUE: { label: "Partner sırasında", description: "Kupon yetkili partner operasyonuna iletildi.", icon: "clock", tone: "progress" },
  PARTNER_PROCESSING: { label: "Partner inceliyor", description: "Operatör kuponu işleme aldı.", icon: "eye", tone: "progress" },
  PLATFORM_PREPARING: { label: "Platform hazırlığı", description: "Yetkili platform entegrasyonunda hazırlanıyor.", icon: "loader", tone: "progress" },
  PENDING_CONFIRMATION: { label: "Son onay bekliyor", description: "İşlem öncesi son doğrulama yapılıyor.", icon: "clock", tone: "progress" },
  SUBMITTED: { label: "İletildi", description: "Kupon platforma yetkili yöntemle iletildi.", icon: "send", tone: "progress" },
  ACCEPTED: { label: "Oynandı", description: "Kupon platform tarafından kabul edildi.", icon: "check", tone: "ok" },
  REJECTED: { label: "Reddedildi", description: "Kupon platform tarafından kabul edilmedi.", icon: "x", tone: "danger" },
  ODDS_CHANGED: { label: "Oran değişti", description: "Basılı oran ile güncel oran farklı. Kontrol gerekiyor.", icon: "alert", tone: "warn" },
  RESULT_PENDING: { label: "Sonuç bekleniyor", description: "Maç sonuçları bekleniyor.", icon: "clock", tone: "progress" },
  WON: { label: "Kazandı", description: "Kuponunuz kazandı.", icon: "trophy", tone: "ok" },
  LOST: { label: "Kaybetti", description: "Kuponunuz kazanmadı.", icon: "x", tone: "danger" },
  RESULT_UPDATED: { label: "Sonuç güncellendi", description: "Platform sonucu revize etti. Kayıtlar korunur.", icon: "refresh", tone: "warn" },
  SETTLED: { label: "Ödeme tamamlandı", description: "Settlement tamamlandı, ledger'a işlendi.", icon: "wallet", tone: "ok" },
  FAILED: { label: "İşlem hatası", description: "Kupon işlenemedi. Operasyon ekibi bilgilendirildi.", icon: "alert", tone: "danger" },
  CANCELLED: { label: "İptal edildi", description: "Kupon iptal edildi.", icon: "x", tone: "neutral" },
};
