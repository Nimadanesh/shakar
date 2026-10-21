import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Shared CRON_SECRET guard for internal routes (M3 fix, 2026-10-15).
 *
 * Uses crypto.timingSafeEqual instead of `!==` (timing side-channel),
 * with a length check first (timingSafeEqual throws on length mismatch).
 * The .trim() on both sides is intentional: pasted secrets often smuggle
 * a trailing space/newline from the Railway variable editor — an invisible
 * mismatch that 403s forever (see the trailing-space incident).
 *
 * Returns null when authorized, or the error response to return.
 */
export function checkCronSecret(
  req: Request,
  notConfiguredError = "cron-not-configured"
): { ok: true } | { ok: false; status: 503 | 403; error: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 503, error: notConfiguredError };
  }
  const provided = req.headers.get("x-cron-secret")?.trim() ?? "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}
