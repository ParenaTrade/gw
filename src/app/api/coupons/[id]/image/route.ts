import { after } from "next/server";
import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  requireMember,
  ApiError,
} from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { attachOriginalImage, startProcessing } from "@/lib/coupons/service";
import { runCouponPipeline } from "@/lib/coupons/pipeline";

/** Orijinal kupon görseli yükleme (multipart/form-data, alan: file). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireMember();
    enforceRateLimit("coupon-image", user.member.id, 40, 60 * 60 * 1000);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "INVALID_FORM", "Görsel form verisi okunamadı.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "FILE_REQUIRED", "Görsel dosyası gerekli.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const actionCtx = {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    };
    const result = await attachOriginalImage(couponId, user.member.id, bytes, actionCtx);

    // Ana akış: yükleme sonrası OCR + AI otomatik başlar (yanıt sonrası iş).
    try {
      await startProcessing(couponId, user.member.id, actionCtx);
      after(() => runCouponPipeline(couponId, user.identity.id));
    } catch {
      // Otomatik başlatma başarısızsa üye manuel "Dijitalleştir" butonunu kullanır.
    }
    return jsonOk(result, 201);
  });
}
