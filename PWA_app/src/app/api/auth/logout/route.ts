import { NextResponse } from "next/server";
import { getOtpConfig } from "@/lib/otp/config";
import { clearSessionCookieHeader } from "@/lib/otp/session";

export async function POST() {
  // Mirror the Secure attribute of the login Set-Cookie (verify-otp uses
  // secure=isProd). A non-Secure clear cannot delete a Secure cookie —
  // the browser keeps the original and the user is instantly "back in".
  const { isProd } = getOtpConfig();
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookieHeader(isProd));
  return res;
}
