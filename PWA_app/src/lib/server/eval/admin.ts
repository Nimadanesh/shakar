import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Admin authorization for the private evaluation dashboard.
 * Bearer token from EVAL_ADMIN_TOKEN only — never hardcoded, never logged.
 * When unconfigured, admin routes answer 503 (honest NOT_CONFIGURED,
 * mirroring the OTP honesty contract) instead of failing open.
 */
export function adminTokenConfigured(): boolean {
  return (process.env.EVAL_ADMIN_TOKEN ?? "").trim() !== "";
}

export function isAdminAuthorized(req: Request): boolean {
  const expected = (process.env.EVAL_ADMIN_TOKEN ?? "").trim();
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer (.+)$/);
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Dev-only bootstrap gate (mirrors the OTP dev-bypass honesty pattern). */
export function devBootstrapAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.EVAL_ALLOW_DEV_BOOTSTRAP === "1"
  );
}
