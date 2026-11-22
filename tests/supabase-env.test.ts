import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

function jwt(role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ role })}.signature`;
}

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("supabase env validator", () => {
  it("yapılandırma yoksa isSupabaseConfigured false", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseEnv()).toThrow(/tanımlı değil/);
  });

  it("anon JWT kabul edilir", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon");
    expect(getSupabaseEnv().anonKey).toBe(jwt("anon"));
  });

  it("publishable key modeli desteklenir", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_abc123";
    expect(getSupabaseEnv().anonKey).toBe("sb_publishable_abc123");
  });

  it("service_role JWT reddedilir", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("service_role");
    expect(() => getSupabaseEnv()).toThrow(/service_role/);
  });

  it("sb_secret_ anahtarı reddedilir", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_secret_xyz";
    expect(() => getSupabaseEnv()).toThrow(/Ayrıcalıklı/);
  });

  it("https zorunlu, localhost http istisnası", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://evil.example.com";
    expect(() => getSupabaseEnv()).toThrow(/https/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(getSupabaseEnv().url).toBe("http://127.0.0.1:54321");
  });
});
