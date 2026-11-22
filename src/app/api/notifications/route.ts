import { handleRoute, jsonOk, requireMember } from "@/lib/security/api";
import { listNotifications } from "@/lib/notifications/service";

export async function GET(req: Request) {
  return handleRoute(req, async () => {
    const user = await requireMember();
    const notifications = await listNotifications(user.member.id, 20);
    return jsonOk({ notifications });
  });
}
