import { after } from "next/server";
import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  requireMember,
} from "@/lib/security/api";
import { idParamSchema } from "@/lib/validation/schemas";
import { startProcessing } from "@/lib/coupons/service";
import { runCouponPipeline } from "@/lib/coupons/pipeline";

/**
 * OCR + AI işleme başlatır. Yanıt 202 döner; uzun iş `after()` ile yanıt
 * sonrası çalışır (Vercel timeout koruması). Durum /status ile izlenir.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const couponId = idParamSchema.parse(id);
    const user = await requireMember();
    enforceRateLimit("coupon-process", user.member.id, 15, 60 * 60 * 1000);

    const actionCtx = {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    };
    await startProcessing(couponId, user.member.id, actionCtx);
    after(() => runCouponPipeline(couponId, user.identity.id));
    return jsonOk({ status: "OCR_PROCESSING" }, 202);
  });
}
