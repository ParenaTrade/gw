import { handleRoute, jsonOk, parseQuery, requireStaff } from "@/lib/security/api";
import { partnerCouponQuerySchema } from "@/lib/validation/schemas";
import { listPartnerCoupons } from "@/lib/coupons/service";

export async function GET(req: Request) {
  return handleRoute(req, async () => {
    await requireStaff(["PARTNER_ADMIN", "OPERATOR", "AUDITOR", "ADMIN"]);
    const query = parseQuery(req, partnerCouponQuerySchema);
    const coupons = await listPartnerCoupons(query.status, query.limit);
    return jsonOk({ coupons });
  });
}
