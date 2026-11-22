import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { couponImages } from "@/db/schema";
import { handleRoute, requireSessionUser, ApiError } from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { getCouponAny, getCouponForMember } from "@/lib/coupons/service";
import { readCouponImage } from "@/lib/storage";
import type { UserRole } from "@/types/database";

const STAFF: UserRole[] = ["PARTNER_ADMIN", "OPERATOR", "AUDITOR", "ADMIN"];

/**
 * Private görsel servisi — public URL YOK.
 * Erişim: kupon sahibi üye veya yetkili staff. Cookie auth + owner kontrolü.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; imageId: string }> }
) {
  return handleRoute(req, async () => {
    const { id, imageId } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const imgId = idParamSchema.parse(imageId);
    const user = await requireSessionUser();

    const [image] = await db
      .select()
      .from(couponImages)
      .where(and(eq(couponImages.id, imgId), eq(couponImages.couponId, couponId)))
      .limit(1);
    if (!image) throw new ApiError(404, "IMAGE_NOT_FOUND", "Görsel bulunamadı.");

    const isStaff = STAFF.includes(user.profile.role as UserRole);
    if (!isStaff) {
      if (!user.member) throw new ApiError(403, "FORBIDDEN", "Bu işlem için yetkiniz yok.");
      const own = await getCouponForMember(couponId, user.member.id);
      if (!own) throw new ApiError(404, "IMAGE_NOT_FOUND", "Görsel bulunamadı.");
    } else {
      const coupon = await getCouponAny(couponId);
      if (!coupon) throw new ApiError(404, "IMAGE_NOT_FOUND", "Görsel bulunamadı.");
    }

    const bytes = await readCouponImage(image.storagePath);
    if (!bytes) throw new ApiError(404, "IMAGE_NOT_FOUND", "Görsel bulunamadı.");

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ETag: `"${image.sha256}"`,
      },
    });
  });
}
