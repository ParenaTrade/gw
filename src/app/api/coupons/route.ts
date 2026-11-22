import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  parseQuery,
  readJson,
  requireMember,
} from "@/lib/security/api";
import { couponCreateSchema, couponListQuerySchema } from "@/lib/validation/schemas";
import { createCoupon, listMemberCoupons } from "@/lib/coupons/service";

export async function GET(req: Request) {
  return handleRoute(req, async () => {
    const user = await requireMember();
    const query = parseQuery(req, couponListQuerySchema);
    const coupons = await listMemberCoupons(user.member.id, query.filter, query.limit);
    return jsonOk({ coupons });
  });
}

export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const user = await requireMember();
    enforceRateLimit("coupon-create", user.member.id, 30, 60 * 60 * 1000);
    const body = await readJson(req, couponCreateSchema);
    const coupon = await createCoupon(user.member.id, body, {
      actorId: user.identity.id,
      actorRole: user.profile.role,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return jsonOk({ coupon }, 201);
  });
}
