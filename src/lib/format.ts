/** Biçimlendirme + telefon normalizasyonu. Para hesabı YAPILMAZ (bkz. lib/money). */

/** TR ağırlıklı E.164 normalizasyonu. Geçersizse null. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("5")) digits = `90${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** KVKK maskeleme: +90******2233 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const last4 = phone.slice(-4);
  if (phone.startsWith("+90")) return `+90******${last4}`;
  return `${phone.slice(0, 3)}******${last4}`;
}

/** +90 555 111 22 33 biçimi (yalnızca üyenin kendi ekranında). */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.startsWith("+90") && phone.length === 13) {
    const d = phone.slice(3);
    return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  }
  return phone;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : `${part[0]}***`))
    .join(" ");
}

/** PG timestamp string ('2026-01-01 10:00:00+00') → Date (Safari uyumlu). */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let iso = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso)) iso = iso.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = `${iso}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dtFmt.format(d) : "—";
}

export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

/** Yalnızca görüntüleme — finansal hesap lib/money.ts içinde yapılır. */
export function fmtMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} ₺`;
}

export function fmtOdds(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toFixed(2);
}
