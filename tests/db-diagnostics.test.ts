import { describe, expect, it } from "vitest";
import { buildPoolConfig } from "@/db/config";
import { classifyDbError } from "@/db/diagnostics";

describe("DATABASE_URL → pool ayarı", () => {
  it("uzak (Supabase) sunucuda SSL açar ve sslmode parametresini çıkarır", () => {
    const cfg = buildPoolConfig("postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require");
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    expect(cfg.connectionString).not.toContain("sslmode");
    expect(cfg.connectionString).toContain("pooler.supabase.com:6543");
  });

  it("yerel PostgreSQL'de SSL kapalı", () => {
    expect(buildPoolConfig("postgresql://postgres:postgres@127.0.0.1:5432/app_db").ssl).toBeUndefined();
    expect(buildPoolConfig("postgresql://postgres:postgres@localhost:5432/app_db").ssl).toBeUndefined();
  });

  it("kısa bağlantı zaman aşımı ayarlı", () => {
    expect(buildPoolConfig("postgresql://u:p@db.example.com:5432/postgres").connectionTimeoutMillis).toBeLessThanOrEqual(10_000);
  });
});

describe("veritabanı hata sınıflandırma", () => {
  it("eksik env", () => {
    expect(classifyDbError(new Error("DATABASE_URL is required")).reason).toBe("DATABASE_URL_MISSING");
  });
  it("IPv6 doğrudan adres (Vercel)", () => {
    expect(classifyDbError({ code: "ENETUNREACH", message: "connect ENETUNREACH 2a05:d018::1:5432" }).reason).toBe("IPV6_UNREACHABLE");
  });
  it("drizzle'ın sardığı (cause) hatayı da çözer", () => {
    const wrapped = { message: "Failed query: select 1", cause: { code: "28P01", message: "password authentication failed for user" } };
    expect(classifyDbError(wrapped).reason).toBe("AUTH_FAILED");
  });
  it("pooler kullanıcı adı hatası", () => {
    expect(classifyDbError(new Error("Tenant or user not found")).reason).toBe("POOLER_USER_INVALID");
  });
  it("AggregateError (çoklu adres) içindeki kodu bulur", () => {
    const agg = { message: "", errors: [{ code: "ENETUNREACH", message: "connect ENETUNREACH" }] };
    expect(classifyDbError(agg).reason).toBe("IPV6_UNREACHABLE");
  });
  it("yanıt hiçbir sır içermez", () => {
    const out = JSON.stringify(classifyDbError(new Error("password authentication failed for user postgres at db.secret.supabase.co")));
    expect(out).not.toContain("db.secret");
  });
});
