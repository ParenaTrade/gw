import { handleRoute, jsonOk, requireSessionUser, ApiError } from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { getCouponAny, getCouponForMember } from "@/lib/coupons/service";
import type { UserRole } from "@/types/database";

const STAFF: UserRole[] = ["PARTNER_ADMIN", "OPERATOR", "AUDITOR", "ADMIN"];

/** Hafif durum polling endpoint'i (üye kuponum ekranı). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireSessionUser();
    const isStaff = STAFF.includes(user.profile.role as UserRole);

    const coupon = isStaff
      ? await getCouponAny(couponId)
      : user.member
        ? await getCouponForMember(couponId, user.member.id)
        : null;
    if (!coupon) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");

    return jsonOk({
      status: coupon.status,
      updatedAt: coupon.updatedAt,
      uploadedAt: coupon.uploadedAt,
      memberApprovedAt: coupon.memberApprovedAt,
      partnerReceivedAt: coupon.partnerReceivedAt,
      partnerProcessedAt: coupon.partnerProcessedAt,
      platformProcessedAt: coupon.platformProcessedAt,
      resultUpdatedAt: coupon.resultUpdatedAt,
    });
  });
}
