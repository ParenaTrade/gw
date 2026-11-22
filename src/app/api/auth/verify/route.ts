import {
  assertSameOrigin,
  enforceRateLimit,
  getClientIp,
  handleRoute,
  jsonOk,
  readJson,
  ApiError,
} from "@/lib/security/api";
import { verifySchema } from "@/lib/validation/schemas";
import { verifyOtpCode } from "@/lib/auth/otp";
import {
  createSession,
  ensureIdentity,
  provisionMemberProfile,
  recordDeviceLogin,
} from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  return handleRoute(req, async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    enforceRateLimit("otp-verify-ip", ip, 30, 15 * 60 * 1000);
    const body = await readJson(req, verifySchema);
    enforceRateLimit("otp-verify-phone", body.phone, 10, 15 * 60 * 1000);
    const userAgent = req.headers.get("user-agent");

    let identityId: string;
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new ApiError(500, "AUTH_CONFIG", "Auth yapılandırması hatalı.");
      const { data, error } = await supabase.auth.verifyOtp({
        phone: body.phone,
        token: body.code,
        type: "sms",
      });
      if (error || !data.user) {
        throw new ApiError(400, "OTP_INVALID", "Kod geçersiz veya süresi dolmuş.");
      }
      const identity = await ensureIdentity(data.user.id, body.phone);
      identityId = identity.id;
      await provisionMemberProfile(identity.id, body.phone);
    } else {
      const otp = await verifyOtpCode(body.phone, body.code);
      const identity = await ensureIdentity(null, body.phone);
      identityId = identity.id;
      await provisionMemberProfile(identity.id, body.phone, otp.pendingFullName ?? undefined);
      await createSession(identity.id, userAgent);
    }

    const { member, profile } = await provisionMemberProfile(identityId, body.phone);
    await recordDeviceLogin(member.id, userAgent);
    await writeAudit({
      actorId: identityId,
      actorRole: profile.role,
      action: "LOGIN_OTP",
      entityType: "member",
      entityId: member.id,
      after: { phone: body.phone, memberCode: member.memberCode },
      ip,
      userAgent,
    });

    return jsonOk({
      member: {
        id: member.id,
        memberCode: member.memberCode,
        fullName: member.fullName,
        phone: member.phone,
        role: profile.role,
      },
    });
  });
}
