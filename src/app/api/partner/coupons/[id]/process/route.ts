import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  requireStaff,
} from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { claimCoupon } from "@/lib/coupons/service";

/**
 * Operatör kuponu işleme alır. Atomic claim: iki operatör aynı kuponu
 * aynı anda işleyemez (FOR UPDATE + PARTNER_QUEUE guard → 409).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireStaff(["PARTNER_ADMIN", "OPERATOR", "ADMIN"]);
    enforceRateLimit("partner-claim", user.identity.id, 60, 60 * 60 * 1000);

    const coupon = await claimCoupon(couponId, {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk({ coupon });
  });
}
