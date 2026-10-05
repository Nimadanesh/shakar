/**
 * Auth backend seam. Guest-first product: guests hunt fully; auth gates
 * ONLY persistent actions (favorite, save hunt, کمین).
 *
 * HONESTY CONTRACT: these functions are the boundary to the real auth
 * backend (OTP via Iranian mobile). No backend is connected yet, so in
 * PRODUCTION requestOtp/verifyOtp return an explicit NOT_CONFIGURED
 * error — they NEVER fake a successful login. The UI surfaces
 * pending/error states honestly. When the backend lands, implement the
 * network calls here; the UI needs no changes.
 *
 * DEV EXCEPTION: in development builds only (NODE_ENV=development),
 * any well-formed 5-digit code verifies a local dev session so the
 * full gate→resume loop can be exercised end-to-end. The auth UI labels
 * this clearly. Production builds never take this path.
 */

/**
 * True only in local development. Gates the clearly-labeled dev bypass
 * below; production builds always return false.
 */
export function isDevBypass(): boolean {
  return process.env.NODE_ENV === "development";
}

export interface Session {
  userId: string;
  mobile: string;
}

export type AuthErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_MOBILE"
  | "INVALID_CODE"
  | "EXPIRED_CODE"
  | "RATE_LIMITED"
  | "NETWORK";

export interface AuthError {
  code: AuthErrorCode;
  /** User-facing Persian message. */
  message: string;
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthError };

const SESSION_KEY = "shakar:session:v1";
const PENDING_KEY = "shakar:pending-action:v1";

/**
 * Iranian mobile: 09xxxxxxxxx. Accepts Persian digits, spaces and dashes.
 * Returns the normalized 11-digit string, or null when invalid.
 */
export function normalizeMobile(input: string): string | null {
  const en = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s-]/g, "");
  return /^09\d{9}$/.test(en) ? en : null;
}

/** OTP codes are 5 digits (Persian digits accepted). */
export function normalizeCode(input: string): string | null {
  const en = input.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\s/g, "");
  return /^\d{5}$/.test(en) ? en : null;
}

export async function requestOtp(
  _mobile: string
): Promise<AuthResult<{ retryAfterSec: number }>> {
  // Dev bypass: lets the full auth loop be exercised locally.
  if (isDevBypass()) return { ok: true, data: { retryAfterSec: 60 } };
  // No SMS provider is connected. Explicit failure — never a fake "sent".
  return {
    ok: false,
    error: {
      code: "NOT_CONFIGURED",
      message: "سرویس پیامک هنوز وصل نشده است. به‌زودی فعال می‌شود.",
    },
  };
}

export async function verifyOtp(
  _mobile: string,
  _code: string
): Promise<AuthResult<Session>> {
  // Dev bypass: any well-formed code verifies a LOCAL dev session only.
  if (isDevBypass()) {
    return { ok: true, data: { userId: "dev-user", mobile: _mobile } };
  }
  // No auth backend is connected. Explicit failure — never a fake session.
  return {
    ok: false,
    error: {
      code: "NOT_CONFIGURED",
      message: "سرویس ورود هنوز وصل نشده است. به‌زودی فعال می‌شود.",
    },
  };
}

/** Local session check. Null until a real verify succeeds. */
export function getSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Session).userId === "string" &&
      typeof (parsed as Session).mobile === "string"
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist a verified session. Called only with a real backend session. */
export function storeSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function signOut(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Pending-action gate                                                 */
/* ------------------------------------------------------------------ */

import type { ContextBase } from "@/lib/search-context";

export type PendingAction =
  | { type: "favorite"; adId: string }
  | { type: "radar"; query: string; base: ContextBase };

export function storePendingAction(action: PendingAction): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(action));
  } catch {
    // ignore
  }
}

/** Takes (and clears) the stored pending action, if any. */
export function takePendingAction(): PendingAction | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as PendingAction).type === "string") {
      return parsed as PendingAction;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true when the action may proceed (a session exists).
 * Otherwise stores the action and navigates to /auth; returns false.
 * The caller passes its router push as `navigate`.
 */
export function requireAuth(
  action: PendingAction,
  navigate: (url: string) => void,
  returnTo = "/"
): boolean {
  if (getSession()) return true;
  storePendingAction(action);
  const resume = encodeURIComponent(JSON.stringify(action));
  navigate(`/auth?resume=${resume}&returnTo=${encodeURIComponent(returnTo)}`);
  return false;
}
