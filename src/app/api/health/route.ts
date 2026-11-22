import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: "ok",
      mode: isSupabaseConfigured() ? "supabase" : "local",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 500 });
  }
}
