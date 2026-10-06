import "server-only";

import { cookies } from "next/headers";
import { getOtpConfig } from "@/lib/otp/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/otp/session";

/**
 * Best-effort authenticated user id from our own session cookie.
 * Null = guest. The backend derives identity from its own session on every
 * request — a userId arriving in a body/query param is untrusted input.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value ?? null;
    if (!token) return null;
    const config = getOtpConfig();
    const claims = await verifySessionToken(token, config.sessionSecret);
    return claims?.userId ?? null;
  } catch {
    return null;
  }
}
