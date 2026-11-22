import { assertSameOrigin, getClientIp, handleRoute, jsonOk } from "@/lib/security/api";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";

export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const user = await getSessionUser();
    await destroySession();
    if (user) {
      await writeAudit({
        actorId: user.identity.id,
        actorRole: user.profile.role,
        action: "LOGOUT",
        entityType: "auth",
        ip: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return jsonOk({ ok: true });
  });
}
