import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Server Supabase client — istek başına bir kez oluşturulur.
 * Cookie tabanlı session yönetimi (@supabase/ssr getAll/setAll köprüsü).
 * RSC içinde cookie yazımı denenebilir; hata yutulur, session refresh
 * middleware katmanında gerçekleşir.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component içinden çağrıldı; middleware refresh'i yeterli.
        }
      },
    },
  });
}
