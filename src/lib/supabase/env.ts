/**
 * Supabase ortam değişkeni doğrulaması.
 *
 * Browser + server + middleware ortak kullanır.
 * Public anahtar (anon JWT veya sb_publishable_*) dışında anahtar kabul etmez.
 * Ayrıcalıklı anahtarların NEXT_PUBLIC_* altında kullanılmasını engeller.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  }
  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL geçerli bir URL değil.");
  }

  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL https:// ile başlamalı.");
  }

  if (anonKey.startsWith("sb_secret_")) {
    throw new Error(
      "Ayrıcalıklı Supabase anahtarı NEXT_PUBLIC_SUPABASE_ANON_KEY olarak kullanılamaz."
    );
  }

  const role = decodeJwtRole(anonKey);
  if (role === "service_role") {
    throw new Error(
      "service_role anahtarı public Supabase anahtarı olarak kullanılamaz."
    );
  }

  const isPublishable = anonKey.startsWith("sb_publishable_");
  if (!isPublishable && role !== "anon") {
    throw new Error(
      "Supabase public anahtarı anon JWT veya sb_publishable_* biçiminde olmalı."
    );
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim())
  );
}
