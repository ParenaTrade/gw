/**
 * Veritabanı bağlantı hatasını, sırları (URL/şifre) sızdırmadan
 * kullanıcıya yol gösteren bir koda çevirir. /api/health tarafından kullanılır.
 */
export type DbFailure = { reason: string; hint: string };

function flatten(e: unknown): { code: string; text: string } {
  const parts: string[] = [];
  let code = "";
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i += 1) {
    const o = cur as { code?: string; message?: string; cause?: unknown; errors?: unknown[] };
    if (!code && typeof o.code === "string") code = o.code;
    if (o.message) parts.push(o.message);
    if (Array.isArray(o.errors)) {
      for (const inner of o.errors) {
        const x = inner as { code?: string; message?: string };
        if (!code && typeof x?.code === "string") code = x.code;
        if (x?.message) parts.push(x.message);
      }
    }
    cur = o.cause;
  }
  return { code, text: parts.join(" | ") };
}

export function classifyDbError(e: unknown): DbFailure {
  const { code, text } = flatten(e);
  const msg = text.toLowerCase();

  if (msg.includes("database_url is required")) {
    return { reason: "DATABASE_URL_MISSING", hint: "Vercel > Settings > Environment Variables'a DATABASE_URL ekleyip Redeploy edin." };
  }
  if (msg.includes("tenant or user not found")) {
    return { reason: "POOLER_USER_INVALID", hint: "Pooler kullanıcı adı 'postgres.<proje-ref>' biçiminde olmalı. Supabase > Connect'ten adresi aynen kopyalayın." };
  }
  if (code === "28P01" || msg.includes("password authentication failed")) {
    return { reason: "AUTH_FAILED", hint: "Veritabanı şifresi yanlış. Supabase > Settings > Database'den sıfırlayın; özel karakterleri URL'de kodlayın (@ → %40)." };
  }
  if (code === "ENETUNREACH" || msg.includes("enetunreach")) {
    return { reason: "IPV6_UNREACHABLE", hint: "Doğrudan bağlantı adresi (db.xxx.supabase.co) IPv6'dır, Vercel erişemez. Supabase > Connect > 'Transaction pooler' adresini kullanın." };
  }
  if (code === "ENOTFOUND" || msg.includes("enotfound") || msg.includes("getaddrinfo")) {
    return { reason: "HOST_NOT_FOUND", hint: "DATABASE_URL içindeki sunucu adı çözümlenemedi. Adresi Supabase > Connect'ten yeniden kopyalayın." };
  }
  if (code === "ECONNREFUSED" || msg.includes("econnrefused")) {
    return { reason: "CONNECTION_REFUSED", hint: "Bağlantı reddedildi. Adres localhost/127.0.0.1 olabilir; Supabase pooler adresini kullanın." };
  }
  if (code === "ETIMEDOUT" || msg.includes("timeout") || msg.includes("timed out")) {
    return { reason: "TIMEOUT", hint: "Bağlantı zaman aşımına uğradı. Doğru port (pooler: 6543) ve proje duraklatılmamış mı (Supabase Dashboard) kontrol edin." };
  }
  if (msg.includes("certificate") || msg.includes("ssl")) {
    return { reason: "SSL_ERROR", hint: "SSL doğrulama hatası. Bağlantı adresini Supabase'ten kopyalayıp sslmode parametresini eklemeyin." };
  }
  if (code === "3D000" || (msg.includes("database") && msg.includes("does not exist"))) {
    return { reason: "DATABASE_NOT_FOUND", hint: "Veritabanı adı yanlış. Supabase'te varsayılan ad 'postgres'tir." };
  }
  if (msg.includes("invalid url") || msg.includes("invalid connection string")) {
    return { reason: "URL_INVALID", hint: "DATABASE_URL biçimi geçersiz. postgresql://kullanici:sifre@sunucu:port/postgres olmalı; şifrede özel karakter varsa kodlayın." };
  }
  return { reason: "UNKNOWN", hint: "Vercel > Logs'ta bu isteğin 'HEALTH_DB_ERROR' kaydına bakın." };
}

/** Uygulamanın çalışması için gereken tablolar. */
export const REQUIRED_TABLES = [
  "profiles",
  "members",
  "member_devices",
  "member_credentials",
  "auth_identities",
  "auth_sessions",
  "auth_challenges",
  "auth_otps",
  "coupons",
  "coupon_bets",
  "coupon_images",
  "audit_logs",
] as const;
