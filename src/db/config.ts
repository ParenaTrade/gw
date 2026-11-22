import type { PoolConfig } from "pg";

/**
 * DATABASE_URL → pg Pool ayarı.
 *
 * - Uzak sunucularda (Supabase vb.) SSL açılır. `sslmode=` parametresi URL'den
 *   çıkarılır: pg, URL'deki değeri `ssl` seçeneğinin üzerine yazar ve
 *   `sslmode=require` sertifika zinciri hatalarına (self-signed) yol açabilir.
 * - Serverless için kısa zaman aşımları: yanıtsız bağlantı sessizce asılı kalmaz.
 * - Supabase "Transaction pooler" (6543) ile uyumludur (adlandırılmış prepared
 *   statement kullanılmaz).
 */
export function buildPoolConfig(databaseUrl: string): PoolConfig {
  let connectionString = databaseUrl.trim();
  let hostname = "";
  try {
    const url = new URL(connectionString);
    hostname = url.hostname;
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    connectionString = url.toString();
  } catch {
    // Geçersiz URL: pg kendi hatasını verir.
  }

  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "";
  return {
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  };
}
