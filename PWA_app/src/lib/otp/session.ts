/**
 * Session: custom JWT in an httpOnly cookie. The cookie is the real
 * session; the client's localStorage mirror (lib/auth.ts) is a display
 * hint only. Never trust a userId arriving from the client.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "shekaar_session";
const SESSION_TTL_SECONDS = 30 * 24 * 3600; // 30 days

export interface SessionClaims {
  userId: string;
  mobile: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function mintSessionToken(
  claims: SessionClaims,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string" || typeof payload.mobile !== "string") {
      return null;
    }
    return { userId: payload.userId, mobile: payload.mobile };
  } catch {
    return null;
  }
}

export interface SessionCookieOptions {
  secure: boolean;
  maxAge: number;
}

/** Set-Cookie value for the session cookie. */
export function sessionCookieHeader(token: string, opts: SessionCookieOptions): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Set-Cookie value that clears the session cookie.
 *
 * MUST mirror the Secure attribute of the original Set-Cookie: browsers
 * will not let a non-Secure Set-Cookie overwrite or delete a cookie that
 * was set with Secure (the deletion is stored as a separate cookie entry
 * and the original survives). In production the session cookie is Secure,
 * so logout must clear with Secure too — otherwise the user is "logged
 * out" in the UI but the server still sees the valid cookie on the next
 * request and they are instantly logged back in.
 */
export function clearSessionCookieHeader(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function sessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}
