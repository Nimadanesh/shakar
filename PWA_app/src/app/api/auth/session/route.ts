import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOtpConfig } from "@/lib/otp/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/otp/session";

/** Session probe for the client mirror. 200 with { user: null } when signed out. */
export async function GET() {
  const config = getOtpConfig();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;
  const claims = token ? await verifySessionToken(token, config.sessionSecret) : null;
  if (!claims) return NextResponse.json({ ok: true, data: { user: null } });
  return NextResponse.json({
    ok: true,
    data: { user: { userId: claims.userId, mobile: claims.mobile } },
  });
}
