import { NextResponse } from "next/server";
import { normalizeCode, normalizeMobile } from "@/lib/otp/mobile";
import { ensureProfileId, getOtpBackend } from "@/lib/otp/server";
import { hashCode, safeEqual } from "@/lib/otp/store";
import {
  mintSessionToken,
  sessionCookieHeader,
  sessionTtlSeconds,
} from "@/lib/otp/session";

function notConfigured() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "سرویس ورود هنوز وصل نشده است. به‌زودی فعال می‌شود.",
      },
    },
    { status: 503 }
  );
}

/**
 * Verifies a 5-digit OTP and mints the session cookie. Fail-closed:
 * production requires the full backend (provider, Supabase, secret).
 *
 * DEV EXCEPTION (documented, development only): any well-formed 5-digit
 * code verifies, so the gate→resume loop can be exercised without SMS.
 * Production builds never take this path.
 */
export async function POST(req: Request) {
  const { config, store, sb } = getOtpBackend();
  if (config.isProd && !config.ready) {
    console.error("[otp] verify-otp not configured:", config.missing.join(", "));
    return notConfigured();
  }
  if (config.isProd && !sb) return notConfigured();

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const raw =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const mobile = typeof raw.mobile === "string" ? normalizeMobile(raw.mobile) : null;
  const code = typeof raw.code === "string" ? normalizeCode(raw.code) : null;
  if (!mobile) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_MOBILE", message: "شماره موبایل معتبر نیست." } },
      { status: 400 }
    );
  }
  if (!code) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CODE", message: "کد تأیید باید ۵ رقم باشد." } },
      { status: 400 }
    );
  }

  const now = Date.now();
  const secure = config.isProd;

  if (!config.isProd) {
    // Dev backdoor: any well-formed code verifies a local dev session.
    // With Supabase configured we still mint a real profile row.
    let userId = `dev:${mobile}`;
    if (sb) {
      try {
        userId = await ensureProfileId(sb, mobile);
      } catch {
        userId = `dev:${mobile}`;
      }
    }
    const token = await mintSessionToken({ userId, mobile }, config.sessionSecret);
    const res = NextResponse.json({ ok: true, data: { userId, mobile } });
    res.headers.set(
      "Set-Cookie",
      sessionCookieHeader(token, { secure, maxAge: sessionTtlSeconds() })
    );
    return res;
  }

  const record = await store.latestActive(mobile, now);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: { code: "EXPIRED_CODE", message: "کد منقضی شده؛ کد جدید بگیر." } },
      { status: 400 }
    );
  }
  if (record.attempts >= record.maxAttempts) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "تلاش زیاد؛ کد جدید بگیر." } },
      { status: 429 }
    );
  }
  if (!safeEqual(await hashCode(code), record.codeHash)) {
    await store.incrementAttempts(record.id);
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CODE", message: "کد اشتباه است." } },
      { status: 400 }
    );
  }

  await store.consume(record.id, now);
  const userId = await ensureProfileId(sb!, mobile);
  const token = await mintSessionToken({ userId, mobile }, config.sessionSecret);
  const res = NextResponse.json({ ok: true, data: { userId, mobile } });
  res.headers.set(
    "Set-Cookie",
    sessionCookieHeader(token, { secure, maxAge: sessionTtlSeconds() })
  );
  return res;
}
