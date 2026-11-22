import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  requireMember,
  ApiError,
} from "@/lib/security/api";
import { approveBodySchema, idParamSchema } from "@/lib/validation/schemas";
import { approveCoupon, getCouponForMember } from "@/lib/coupons/service";

/**
 * KUPONU ONAYLA — idempotent.
 * Idempotency-Key header'ı verilmezse coupon_id + approval_version türetilir.
 * Aynı kupon ikinci kez onaylanamaz (DB transaction + status guard).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireMember();
    enforceRateLimit("coupon-approve", user.member.id, 20, 60 * 60 * 1000);
    await readJson(req, approveBodySchema);

    const coupon = await getCouponForMember(couponId, user.member.id);
    if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");

    const headerKey = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey =
      headerKey && headerKey.length <= 200
        ? headerKey
        : `${couponId}:approval:v${coupon.approvalVersion}`;

    const result = await approveCoupon(couponId, user.member.id, idempotencyKey, {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk(result);
  });
}
