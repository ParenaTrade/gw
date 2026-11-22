import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  requireMember,
} from "@/lib/security/api";
import { betEditSchema, idParamSchema } from "@/lib/validation/schemas";
import { updateBetForMember } from "@/lib/coupons/service";

/** Üye satır düzeltme — normalize + yeniden eşleştirme + audit. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; betId: string }> }
) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const { id, betId } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const betUuid = idParamSchema.parse(betId);
    const user = await requireMember();
    enforceRateLimit("bet-edit", user.member.id, 120, 60 * 60 * 1000);
    const body = await readJson(req, betEditSchema);

    const result = await updateBetForMember(couponId, betUuid, user.member.id, body, {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk(result);
  });
}
