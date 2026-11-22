import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { classifyDbError, REQUIRED_TABLES } from "@/db/diagnostics";

export const dynamic = "force-dynamic";

/**
 * Sağlık kontrolü + kurulum teşhisi. Bağlantı adresi, şifre veya ham hata
 * metni ASLA döndürülmez; yalnızca sınıflandırılmış neden ve yönlendirme.
 */
export async function GET() {
  const mode = isSupabaseConfigured() ? "supabase" : "local";

  try {
    await db.execute(sql`select 1`);
  } catch (e) {
    const failure = classifyDbError(e);
    console.error(
      JSON.stringify({
        error_code: "HEALTH_DB_ERROR",
        reason: failure.reason,
        message: e instanceof Error ? e.message : String(e),
        cause: (e as { cause?: { message?: string; code?: string } } | null)?.cause?.message,
      })
    );
    return Response.json({ ok: false, db: "unreachable", mode, ...failure }, { status: 500 });
  }

  try {
    const names = sql.join(REQUIRED_TABLES.map((t) => sql`${t}`), sql`, `);
    const result = await db.execute(
      sql`select t.name as name, to_regclass('public.' || t.name) is not null as present
          from unnest(array[${names}]::text[]) as t(name)`
    );
    const rows = result.rows as { name: string; present: boolean }[];
    const missing = rows.filter((r) => !r.present).map((r) => r.name);
    if (missing.length > 0) {
      return Response.json(
        {
          ok: false,
          db: "connected",
          mode,
          reason: "TABLES_MISSING",
          missingTables: missing,
          hint: "Supabase SQL Editor'da supabase/migrations/001…011 dosyalarını sırayla çalıştırın.",
        },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error(JSON.stringify({ error_code: "HEALTH_TABLE_CHECK", message: e instanceof Error ? e.message : String(e) }));
    return Response.json({ ok: false, db: "connected", mode, reason: "TABLE_CHECK_FAILED" }, { status: 500 });
  }

  return Response.json({ ok: true, db: "ok", mode, timestamp: new Date().toISOString() });
}
