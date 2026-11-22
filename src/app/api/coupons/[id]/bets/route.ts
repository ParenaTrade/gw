import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couponBets } from "@/db/schema";
import { handleRoute, jsonOk, requireSessionUser, ApiError } from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { getCouponAny, getCouponForMember } from "@/lib/coupons/service";
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
    } else if (!(await getCouponAny(couponId))) {
      throw new ApiError(404, "COUPON_NOT_FOUND", "Kupon bulunamadı.");
    }

    const bets = await db
      .select()
      .from(couponBets)
      .where(eq(couponBets.couponId, couponId))
      .orderBy(couponBets.rowNumber);
    return jsonOk({ bets });
  });
}
