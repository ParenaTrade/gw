import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * KUponum proxy (Next.js 16; eski adıyla middleware):
 * 1. Güvenlik başlıkları (tüm yanıtlar).
 * 2. Supabase yapılandırılmışsa cookie tabanlı session refresh.
 *
 * Yetkilendirme kararları (RLS + server-side role kontrolü) sayfa/route
 * katmanında alınır; middleware yalnızca session tazeler ve başlık ekler.
 */
export async function proxy(request: NextRequest) {
  let response: NextResponse;

  if (isSupabaseConfigured() && !request.nextUrl.pathname.startsWith("/api")) {
    const result = await updateSupabaseSession(request);
    response = result.response;
  } else {
    response = NextResponse.next({ request });
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
