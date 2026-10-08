"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";
import {
  isDevBypass,
  normalizeMobile,
  requestOtp,
  storeSession,
  verifyOtp,
  type PendingAction,
  type Session,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { OtpOrbit } from "./OtpOrbit";
import { peekTaskReturn } from "@/lib/task-return";
import { toggleFavoriteStored } from "@/hooks/useFavorites";

const RESEND_SECONDS = 60;

function parseResume(raw: string | null): PendingAction | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as PendingAction;
    return null;
  } catch {
    return null;
  }
}

function contextLine(action: PendingAction | null): string {
  if (!action) return "برای ادامه، وارد شوید.";
  if (action.type === "favorite") return "برای ذخیره‌ی آگهی در علاقه‌مندی‌ها وارد شوید.";
  if (action.type === "radar") return "برای فعال‌سازی کمین وارد شوید.";
  return "برای ادامه، وارد شوید.";
}

/**
 * OTP auth flow: mobile → code → verifying → success → resume.
 * Fully built UI on the honest lib/auth.ts seam — in production, when no
 * backend is connected, request/verify fail explicitly and the error is
 * shown as-is. In development only, a clearly-labeled bypass accepts any
 * 5-digit code so the full loop can be exercised (see lib/auth.ts).
 */
export function AuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  /** Holds the verified session until the user taps «ادامه» in OtpOrbit. */
  const pendingSession = useRef<Session | null>(null);

  const pendingAction = useMemo(
    () => parseResume(searchParams.get("resume")),
    [searchParams]
  );
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function handleRequestOtp() {
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setError("شماره موبایل معتبر نیست. مثال: 09123456789");
      return;
    }
    setPending(true);
    setError(null);
    const result = await requestOtp(normalized);
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMobile(normalized);
    setStep("code");
    setResendIn(result.data.retryAfterSec || RESEND_SECONDS);
  }

  async function handleResend(): Promise<boolean> {
    const result = await requestOtp(mobile);
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    setResendIn(result.data.retryAfterSec || RESEND_SECONDS);
    return true;
  }

  const inputClass =
    "min-h-[52px] w-full rounded-lg border border-border bg-secondary px-4 text-center text-lg tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";

  return (
    <main className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="flex w-full max-w-xs flex-col gap-6">
        {step === "mobile" ? (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <Phone size={24} strokeWidth={1.5} />
              </span>
              <h1 className="text-xl font-bold text-foreground">ورود به شکار</h1>
              <p className="text-sm leading-6 text-muted-foreground">{contextLine(pendingAction)}</p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-[13px] font-medium text-foreground">
                شماره موبایل
                <input
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="09123456789"
                  aria-label="شماره موبایل"
                  autoComplete="tel"
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={pending}
                className={cn(
                  "min-h-[52px] w-full rounded-lg bg-action-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  pending ? "opacity-60" : "hover:bg-action-primary-hover active:bg-action-primary-active"
                )}
              >
                {pending ? "در حال ارسال…" : "ارسال کد تأیید"}
              </button>
            </div>
          </>
        ) : (
          <OtpOrbit
            mobile={mobile}
            context={contextLine(pendingAction)}
            resendIn={resendIn}
            onResend={handleResend}
            onEditNumber={() => {
              setStep("mobile");
              setError(null);
            }}
            onVerify={async (code) => {
              const result = await verifyOtp(mobile, code);
              if (!result.ok) return { ok: false as const, message: result.error.message };
              pendingSession.current = result.data;
              return { ok: true as const };
            }}
            onSuccess={() => {
              if (pendingSession.current) {
                storeSession(pendingSession.current);
                pendingSession.current = null;
              }
              // Task continuity: apply the gated favorite BEFORE navigating,
              // so the target page renders it as already-liked. The task
              // return slot (page + scroll) is consumed by the target page
              // itself for scroll restore.
              const tr = peekTaskReturn();
              if (tr?.pendingFavorite) toggleFavoriteStored(tr.pendingFavorite);
              router.replace(returnTo);
            }}
          />
        )}

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3"
          >
            <p className="text-[13px] leading-6 text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="self-start min-h-9 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              بازگشت
            </button>
          </div>
        )}

        <p className="text-center text-xs leading-5 text-muted-foreground">
          با ورود، شکارها و علاقه‌مندی‌هایتان حفظ می‌شود.
        </p>
        {isDevBypass() && (
          <p className="text-center text-[11px] leading-5 text-muted-foreground">
            حالت توسعه: هر کد ۵ رقمی قبول می‌شود (فقط در محیط توسعه).
          </p>
        )}
      </div>
    </main>
  );
}
