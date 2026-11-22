import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { rateLimit } from "./rate-limit";
import type { UserRole } from "@/types/database";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Cookie tabanlı auth için CSRF koruması: Origin/host eşleşmesi. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // browser dışı istemci (mobil app) — token/cookie zaten gerekir
  const host = req.headers.get("host");
  try {
    if (new URL(origin).host !== host) {
      throw new ApiError(403, "CSRF_REJECTED", "İstek kaynağı doğrulanamadı.");
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "CSRF_REJECTED", "İstek kaynağı doğrulanamadı.");
  }
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Geçersiz istek gövdesi.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      first ? `${first.path.join(".") || "body"}: ${first.message}` : "Doğrulama hatası."
    );
  }
  return parsed.data;
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Geçersiz sorgu parametreleri.");
  }
  return parsed.data;
}

export function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number
) {
  const result = rateLimit(`${scope}:${identifier}`, limit, windowMs);
  if (!result.ok) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin."
    );
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "Oturum bulunamadı. Lütfen giriş yapın.");
  }
  return user;
}

export async function requireMember() {
  const user = await requireSessionUser();
  if (!user.member) {
    throw new ApiError(403, "MEMBER_REQUIRED", "Bu işlem için üye profili gerekiyor.");
  }
  return { ...user, member: user.member };
}

export async function requireStaff(roles: UserRole[]) {
  const user = await requireSessionUser();
  if (!roles.includes(user.profile.role as UserRole)) {
    throw new ApiError(403, "FORBIDDEN", "Bu işlem için yetkiniz yok.");
  }
  return user;
}

/**
 * Route sarmalayıcı: request_id, süre ölçümü, hata normalizasyonu.
 * Teknik hata detayı yalnızca sunucu loguna gider; kullanıcıya generic mesaj.
 */
export async function handleRoute(
  req: Request,
  fn: (ctx: { requestId: string }) => Promise<Response>
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const path = new URL(req.url).pathname;
  try {
    const res = await fn({ requestId });
    res.headers.set("x-request-id", requestId);
    console.info(
      JSON.stringify({
        request_id: requestId,
        path,
        method: req.method,
        status: res.status,
        duration_ms: Date.now() - started,
      })
    );
    return res;
  } catch (e) {
    let res: NextResponse;
    if (e instanceof ApiError) {
      res = jsonError(e.status, e.code, e.message);
    } else if (e instanceof ZodError) {
      res = jsonError(400, "VALIDATION_ERROR", "Doğrulama hatası.");
    } else {
      console.error(
        JSON.stringify({
          request_id: requestId,
          path,
          error_code: "INTERNAL_ERROR",
          stage: "ROUTE_HANDLER",
          message: e instanceof Error ? e.message : String(e),
        })
      );
      res = jsonError(
        500,
        "INTERNAL_ERROR",
        "İşlem şu anda tamamlanamıyor. Lütfen tekrar deneyin."
      );
    }
    res.headers.set("x-request-id", requestId);
    return res;
  }
}
