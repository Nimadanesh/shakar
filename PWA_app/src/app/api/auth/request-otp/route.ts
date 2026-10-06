import { NextResponse } from "next/server";
import { normalizeMobile, randomCode } from "@/lib/otp/mobile";
import { clientIp, getOtpBackend, ipSendAllowed } from "@/lib/otp/server";
import { hashCode } from "@/lib/otp/store";
import { OtpProviderError } from "@/lib/otp/provider";

const CODE_TTL_MS = 5 * 60_000;
const MAX_SENDS_PER_HOUR = 5;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

function notConfigured() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "سرویس پیامک هنوز وصل نشده است. به‌زودی فعال می‌شود.",
      },
    },
    { status: 503 }
  );
}

/**
 * Issues a 5-digit OTP for an Iranian mobile. Fail-closed: in production
 * every dependency (provider, Supabase, session secret) is required —
 * a missing piece returns NOT_CONFIGURED, never a fake "sent".
 */
export async function POST(req: Request) {
  const { config, provider, store, sb } = getOtpBackend();
  if (config.isProd && !config.ready) {
    console.error("[otp] request-otp not configured:", config.missing.join(", "));
    return notConfigured();
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const rawMobile =
    typeof body === "object" && body !== null
      ? (body as { mobile?: unknown }).mobile
      : null;
  const mobile = typeof rawMobile === "string" ? normalizeMobile(rawMobile) : null;
  if (!mobile) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_MOBILE", message: "شماره موبایل معتبر نیست." } },
      { status: 400 }
    );
  }

  const now = Date.now();
  // Finding #10a: cross-instance IP budget (atomic RPC; in-memory
  // fallback only when the m8 migration hasn't run yet).
  if (!(await ipSendAllowed(sb, clientIp(req)))) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "درخواست زیاد است؛ کمی بعد دوباره تلاش کن." } },
      { status: 429 }
    );
  }
  const latest = await store.latestActive(mobile, now);
  if (latest && now - latest.createdAt < RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (now - latest.createdAt)) / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: `کد ارسال شده؛ ${retryAfterSec} ثانیه دیگر دوباره تلاش کن.`,
          retryAfterSec,
        },
      },
      { status: 429 }
    );
  }

  // Finding #10b: claimSend counts recent sends AND inserts the row in
  // one statement — two racing sends cannot both slip under the limit.
  // (The old sentSince()+create() pair is gone; the mobile-limit check now
  // runs after the cooldown check, which is inherent to the atomic claim:
  // claiming first would trip the cooldown on its own fresh row.)
  const code = randomCode();
  const claimed = await store.claimSend({
    mobile,
    codeHash: await hashCode(code),
    expiresAt: now + CODE_TTL_MS,
    maxAttempts: MAX_ATTEMPTS,
    limit: MAX_SENDS_PER_HOUR,
    windowSecs: 3600,
  });
  if (!claimed) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "سقف ارسال کد برای این شماره پر شده؛ یک ساعت دیگر تلاش کن." },
      },
      { status: 429 }
    );
  }

  try {
    await provider.sendCode(mobile, code);
  } catch (err) {
    // Our fault, not the user's: drop the record so the retry isn't punished
    // by the cooldown or the hourly count.
    await store.remove(claimed.id).catch(() => {});
    console.error("[otp] send failed:", err instanceof Error ? err.message : String(err));
    const retryable = err instanceof OtpProviderError && err.retryable;
    return NextResponse.json(
      { ok: false, error: { code: "NETWORK", message: "ارسال پیامک ناموفق بود؛ دوباره تلاش کن." } },
      { status: retryable ? 502 : 500 }
    );
  }

  return NextResponse.json({ ok: true, data: { retryAfterSec: 60 } });
}
