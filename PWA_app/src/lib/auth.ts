/**
 * Auth backend seam. Guest-first product: guests hunt fully; auth gates
 * ONLY persistent actions (favorite, save hunt, کمین).
 *
 * BACKEND (M2): real phone OTP via /api/auth/* routes (Kavenegar in
 * production, mock provider in development). The session cookie
 * (httpOnly) is the real session; the localStorage mirror below is a
 * display hint only — the server re-derives the user from its own
 * session on every request and never trusts a client-sent userId.
 *
 * HONESTY CONTRACT: requestOtp/verifyOtp never fake a result. In
 * PRODUCTION they return an explicit NOT_CONFIGURED error when the
 * provider is not configured — they NEVER fake a sent SMS or a login.
 *
 * DEV EXCEPTION: in development builds only (NODE_ENV=development),
 * the API routes use the mock provider and any well-formed 5-digit code
 * verifies, so the full gate→resume loop can be exercised end-to-end.
 * The auth UI labels this clearly. Production builds never take this path.
 */
import { normalizeCode, normalizeMobile } from "@/lib/otp/mobile";

export { normalizeCode, normalizeMobile };

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
  retryAfterSec?: number;
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthError };

const SESSION_KEY = "shakar:session:v1";
const PENDING_KEY = "shakar:pending-action:v1";

function toAuthError(payload: unknown, fallback: AuthError): AuthError {
  if (typeof payload === "object" && payload !== null) {
    const e = (payload as { error?: unknown }).error;
    if (typeof e === "object" && e !== null) {
      const code = (e as { code?: unknown }).code;
      const message = (e as { message?: unknown }).message;
      const retryAfterSec = (e as { retryAfterSec?: unknown }).retryAfterSec;
      return {
        code:
          code === "NOT_CONFIGURED" ||
          code === "INVALID_MOBILE" ||
          code === "INVALID_CODE" ||
          code === "EXPIRED_CODE" ||
          code === "RATE_LIMITED" ||
          code === "NETWORK"
            ? code
            : fallback.code,
        message: typeof message === "string" ? message : fallback.message,
        retryAfterSec: typeof retryAfterSec === "number" ? retryAfterSec : undefined,
      };
    }
  }
  return fallback;
}

async function postAuth<T>(
  path: string,
  body: unknown,
  fallback: AuthError
): Promise<AuthResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await res.json().catch(() => null);
    if (res.ok && typeof payload === "object" && payload !== null) {
      const p = payload as { ok?: unknown; data?: unknown };
      if (p.ok === true) return { ok: true, data: p.data as T };
    }
    return { ok: false, error: toAuthError(payload, fallback) };
  } catch {
    return { ok: false, error: fallback };
  }
}

export async function requestOtp(
  mobile: string
): Promise<AuthResult<{ retryAfterSec: number }>> {
  return postAuth<{ retryAfterSec: number }>("/api/auth/request-otp", { mobile }, {
    code: "NETWORK",
    message: "خطای شبکه؛ دوباره تلاش کن.",
  });
}

export async function verifyOtp(
  mobile: string,
  code: string
): Promise<AuthResult<Session>> {
  return postAuth<Session>("/api/auth/verify-otp", { mobile, code }, {
    code: "NETWORK",
    message: "خطای شبکه؛ دوباره تلاش کن.",
  });
}

/** Local session mirror (display hint). The httpOnly cookie is the real session. */
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

/** Persist a verified session mirror. Called only with a real backend session. */
export function storeSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

/**
 * Reconciles the local mirror with the server session (source of truth).
 * Returns the fresh session, or null when signed out (mirror cleared).
 */
export async function refreshSession(): Promise<Session | null> {
  try {
    const res = await fetch("/api/auth/session");
    const payload: unknown = await res.json().catch(() => null);
    if (typeof payload === "object" && payload !== null) {
      const user = (payload as { data?: { user?: unknown } }).data?.user;
      if (
        typeof user === "object" &&
        user !== null &&
        typeof (user as Session).userId === "string" &&
        typeof (user as Session).mobile === "string"
      ) {
        const session = user as Session;
        storeSession(session);
        return session;
      }
    }
  } catch {
    // ignore — keep whatever the mirror says
  }
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  return null;
}

export async function signOut(): Promise<void> {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore — the mirror is already cleared
  }
}

/* ------------------------------------------------------------------ */
/* Pending-action gate                                                 */
/* ------------------------------------------------------------------ */

import type { ContextBase } from "@/lib/search-context";

export type PendingAction =
  | { type: "favorite"; adId: string }
  | { type: "radar"; query: string; base: ContextBase; huntId?: string };

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
 *
 * BACKEND SECURITY CONTRACT (frozen 2026-10-06):
 * the `/auth?resume=…` pattern above is LOCAL-ONLY UX plumbing. It must
 * never become the backend's source of truth. The backend derives the
 * user exclusively from its own session (cookie/JWT → authenticated
 * user → userId). A `userId` arriving from the client is untrusted input,
 * never identity. Every mutation endpoint re-derives ownership
 * server-side.
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
