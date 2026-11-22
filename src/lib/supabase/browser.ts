"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client (singleton).
 * Supabase yapılandırılmamışsa null döner; uygulama yerel çalışma modundadır.
 * Service/secret anahtar bu dosyaya asla girmez.
 */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    const { url, anonKey } = getSupabaseEnv();
    cached = createBrowserClient<Database>(url, anonKey);
  }
  return cached;
}
