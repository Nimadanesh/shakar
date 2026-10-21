import "server-only";

/**
 * Best-effort client IP for abuse controls (H1 fix, 2026-10-15).
 *
 * Behind Railway (or any appending proxy) the client controls the LEFTMOST
 * X-Forwarded-For entry: sending `X-Forwarded-For: 1.2.3.4` arrives as
 * `1.2.3.4, <real-ip>`. Trusting the first entry lets an attacker rotate
 * IPs per request and defeat every IP-based cap (guest-hunt velocity,
 * OTP send limits) — unbounded free hunts, direct money burn.
 *
 * The trustworthy entry is the LAST one: the edge appends the real client
 * IP when proxying. Single-proxy setup (Railway) → last entry is the
 * client IP. If we ever sit behind N>1 trusted proxies, take the Nth
 * entry from the right via TRUSTED_PROXY_COUNT.
 */
const TRUSTED_PROXY_COUNT = Math.max(
  1,
  Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10) || 1
);

export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // Nth from the right: the entries our own edge appended.
    const ip = parts[parts.length - TRUSTED_PROXY_COUNT];
    if (ip) return ip;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || null;
}
