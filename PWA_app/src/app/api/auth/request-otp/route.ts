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
  const { config, provider, store } = getOtpBackend();
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
  if (!ipSendAllowed(clientIp(req), now)) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "درخواست زیاد است؛ کمی بعد دوباره تلاش کن." } },
      { status: 429 }
    );
  }
  if ((await store.sentSince(mobile, now - 3600_000)) >= MAX_SENDS_PER_HOUR) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "سقف ارسال کد برای این شماره پر شده؛ یک ساعت دیگر تلاش کن." },
      },
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

  const code = randomCode();
  const record = await store.create({
    mobile,
    codeHash: await hashCode(code),
    expiresAt: now + CODE_TTL_MS,
    maxAttempts: MAX_ATTEMPTS,
  });

  try {
    await provider.sendCode(mobile, code);
  } catch (err) {
    // Our fault, not the user's: drop the record so the retry isn't punished
    // by the cooldown or the hourly count.
    await store.remove(record.id).catch(() => {});
    console.error("[otp] send failed:", err instanceof Error ? err.message : String(err));
    const retryable = err instanceof OtpProviderError && err.retryable;
    return NextResponse.json(
      { ok: false, error: { code: "NETWORK", message: "ارسال پیامک ناموفق بود؛ دوباره تلاش کن." } },
      { status: retryable ? 502 : 500 }
    );
  }

  return NextResponse.json({ ok: true, data: { retryAfterSec: 60 } });
}
