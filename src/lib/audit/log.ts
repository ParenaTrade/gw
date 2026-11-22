import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { hashWithPepper } from "@/lib/security/hash";
import { maskName, maskPhone } from "@/lib/format";

const REDACT_KEYS = /token|secret|password|authorization|code|otp|credential|publickey/i;
const PHONE_KEYS = /phone/i;
const NAME_KEYS = /full_?name/i;

/** Audit verisinde hassas alanları maskeler / tamamen gizler. */
export function sanitizeAuditData(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map((v) => sanitizeAuditData(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.test(k)) out[k] = "[REDACTED]";
      else if (PHONE_KEYS.test(k) && typeof v === "string") out[k] = maskPhone(v);
      else if (NAME_KEYS.test(k) && typeof v === "string") out[k] = maskName(v);
      else out[k] = sanitizeAuditData(v, depth + 1);
    }
    return out;
  }
  return value;
}

export type AuditInput = {
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** Audit yazımı asla ana akışı bozmaz; hata olursa sunucu loguna düşer. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeData: sanitizeAuditData(input.before) as Record<string, unknown> | null,
      afterData: sanitizeAuditData(input.after) as Record<string, unknown> | null,
      ipHash: input.ip ? hashWithPepper(input.ip) : null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        error_code: "AUDIT_WRITE_FAILED",
        action: input.action,
        message: e instanceof Error ? e.message : String(e),
      })
    );
  }
}
