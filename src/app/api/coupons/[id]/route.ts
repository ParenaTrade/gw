import { handleRoute, jsonOk, requireSessionUser, ApiError, getClientIp } from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { getCouponDetail, getCouponForMember } from "@/lib/coupons/service";
import { writeAudit } from "@/lib/audit/log";
import type { UserRole } from "@/types/database";

const STAFF: UserRole[] = ["PARTNER_ADMIN", "OPERATOR", "AUDITOR", "ADMIN"];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireSessionUser();

    const isStaff = STAFF.includes(user.profile.role as UserRole);
    if (!isStaff) {
      if (!user.member) throw new ApiError(403, "FORBIDDEN", "Bu işlem için yetkiniz yok.");
      const own = await getCouponForMember(couponId, user.member.id);
      if (!own) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
    }

    const detail = await getCouponDetail(couponId);
    if (!detail) throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");

    if (isStaff) {
      // Operatör görüntülemeleri audit log'a kaydedilir (gereksinim 36).
      await writeAudit({
        actorId: user.identity.id,
        actorRole: user.profile.role,
        action: "PARTNER_COUPON_VIEW",
        entityType: "coupon",
        entityId: couponId,
        after: { view: "api_detail" },
        ip: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return jsonOk(detail);
  });
}
