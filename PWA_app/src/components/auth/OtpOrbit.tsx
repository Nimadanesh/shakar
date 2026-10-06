"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import "./otp-orbit.css";
import {
  MOTION,
  applyVerdict,
  burstParticles,
  playCollapse,
  playReducedVerification,
  playShake,
  playSpin,
  playVerification,
  prefersReducedMotion,
  restoreSlots,
  wait,
  type OrbitElements,
} from "./orbitChoreography";

const CODE_LEN = 5;
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Normalize Persian digits → English, strip everything else, cap length. */
function toEnDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/\D/g, "")
    .slice(0, CODE_LEN);
}

export type VerifyOutcome = { ok: true } | { ok: false; message: string };

interface OtpOrbitProps {
  mobile: string;
  context: string;
  resendIn: number;
  onResend: () => Promise<boolean>;
  onEditNumber: () => void;
  onVerify: (code: string) => Promise<VerifyOutcome>;
  /** Called when the user taps «ادامه» after the success ritual. */
  onSuccess: () => void;
}

type Phase = "input" | "animating" | "success" | "error";

/**
 * 5-digit OTP input with the orbital verification ritual: once the code is
 * complete the slots curl onto a circular orbit, spin 450° around a fixed
 * hub (covering the verify round-trip), take the green verdict on success
 * and collapse into a checkmark — or shake red and restore editing on error.
 *
 * Auto-fill: the single real input carries autocomplete="one-time-code",
 * so iOS/Android offer the SMS code with one tap.
 */
export function OtpOrbit({
  mobile,
  context,
  resendIn,
  onResend,
  onEditNumber,
  onVerify,
  onSuccess,
}: OtpOrbitProps) {
  const [digits, setDigits] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const digitsRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep the hidden input focused while editing so the keyboard (and the
  // OS one-time-code suggestion) is always one step away.
  useEffect(() => {
    if (phase === "input") inputRef.current?.focus({ preventScroll: true });
  }, [phase ]);

  const collect = useCallback((): OrbitElements | null => {
    const stage = stageRef.current;
    const row = rowRef.current;
    const orbit = orbitRef.current;
    const ring = ringRef.current;
    const hub = hubRef.current;
    if (!stage || !row || !orbit || !ring || !hub) return null;
    const slots = Array.from(stage.querySelectorAll<HTMLElement>(".otp-slot"));
    const digitEls = Array.from(stage.querySelectorAll<HTMLElement>(".otp-digit"));
    if (slots.length !== CODE_LEN) return null;
    return { stage, row, orbit, ring, hub, slots, digits: digitEls };
  }, []);

  const run = useCallback(
    async (code: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      const els = collect();
      if (!els) {
        runningRef.current = false;
        return;
      }
      setPhase("animating");
      setErrorMsg(null);
      inputRef.current?.blur();

      const verifyPromise = onVerify(code);
      try {
        if (prefersReducedMotion()) {
          const result = await verifyPromise;
          if (!mountedRef.current) return;
          if (result.ok) {
            await playReducedVerification(els);
            if (!mountedRef.current) return;
            setPhase("success");
          } else {
            setDigits("");
            digitsRef.current = "";
            setErrorMsg(result.message);
            setPhase("error");
          }
          return;
        }

        await playVerification(els);
        if (!mountedRef.current) return;
        const spin = playSpin(els);
        const result = await verifyPromise;
        await spin;
        if (!mountedRef.current) return;

        if (result.ok) {
          applyVerdict(els);
          await wait(MOTION.verdict);
          if (!mountedRef.current) return;
          await playCollapse(els);
          if (!mountedRef.current) return;
          setPhase("success");
          if (particlesRef.current) burstParticles(particlesRef.current);
        } else {
          restoreSlots(els);
          setDigits("");
          digitsRef.current = "";
          setErrorMsg(result.message);
          setPhase("error");
          await playShake(els);
          if (!mountedRef.current) return;
          // Let the red verdict read, then clear the tint and re-enable input.
          await wait(1000);
          if (!mountedRef.current) return;
          els.stage.classList.remove("has-error");
          setPhase("input");
        }
      } finally {
        runningRef.current = false;
      }
    },
    [collect, onVerify]
  );

  const handleChange = (raw: string) => {
    if (phase !== "input" || runningRef.current) return;
    const next = toEnDigits(raw);
    digitsRef.current = next;
    setDigits(next);
    if (next.length === CODE_LEN) {
      // Let the last digit paint before the ritual starts.
      window.setTimeout(() => {
        if (mountedRef.current && digitsRef.current === next) void run(next);
      }, 60);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || resendBusy || phase === "animating") return;
    setResendBusy(true);
    try {
      await onResend();
    } finally {
      if (mountedRef.current) setResendBusy(false);
    }
  };

  const activeIndex = Math.min(digits.length, CODE_LEN - 1);
  const faResendIn = resendIn.toLocaleString("fa-IR");
  const showWorkbench = phase !== "success";

  return (
    <div ref={stageRef} className="otp-stage flex w-full flex-col items-center">
      <p className="mb-5 text-center text-[13px] leading-6 text-muted-foreground">{context}</p>

      <div className="w-full rounded-3xl border border-border bg-card p-5">
        {phase === "success" ? (
          <div className="otp-swap flex flex-col items-center gap-1.5 pb-1 text-center">
            <h2 className="text-lg font-bold text-[var(--success)]">تأیید شد</h2>
            <p className="text-xs leading-5 text-muted-foreground">
              شماره‌ی موبایل شما با موفقیت تأیید شد.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 pb-1 text-center">
            <h2 className="text-lg font-bold text-foreground">تأیید شماره موبایل</h2>
            <p className="text-xs leading-5 text-muted-foreground">
              کد ۵ رقمی ارسال‌شده به{" "}
              <span dir="ltr" className="font-semibold tabular-nums text-foreground">
                {mobile}
              </span>{" "}
              را وارد کنید.
            </p>
          </div>
        )}

        <div className="otp-animbox" aria-live="polite">
          {showWorkbench && (
            <div className="otp-row-wrap">
              <div
                ref={rowRef}
                className="otp-row"
                dir="ltr"
                role="group"
                aria-label="کد تأیید ۵ رقمی"
              >
                {Array.from({ length: CODE_LEN }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={cn(
                      "otp-slot",
                      digits.length > i && "is-filled",
                      phase === "input" && i === activeIndex && digits.length <= i && "is-active"
                    )}
                  >
                    <span className="otp-digit">{digits[i] ?? ""}</span>
                  </span>
                ))}
              </div>
              <input
                ref={inputRef}
                className="otp-hidden-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="کد تأیید ۵ رقمی"
                value={digits}
                disabled={phase !== "input"}
                onChange={(e) => handleChange(e.target.value)}
              />
            </div>
          )}

          {showWorkbench && (
            <div ref={orbitRef} className="otp-orbit" aria-hidden="true">
              <div ref={ringRef} className="otp-ring">
                <svg viewBox="0 0 172 172" width="172" height="172">
                  <circle
                    cx="86"
                    cy="86"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="2 8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span ref={hubRef} className="otp-hub" />
            </div>
          )}

          {phase === "success" && (
            <div className="otp-success">
              <div ref={particlesRef} className="otp-particles" aria-hidden="true" />
              <span className="otp-check-box" aria-hidden="true">
                <svg className="otp-check" viewBox="0 0 26 26">
                  <path d="M7 13.5l5 5L19 9" />
                </svg>
              </span>
              <span className="otp-secure">
                <Lock size={13} strokeWidth={2} aria-hidden="true" />
                تأیید شد و امن است
              </span>
            </div>
          )}
        </div>

        {phase === "success" ? (
          <button
            type="button"
            onClick={onSuccess}
            autoFocus
            className="otp-swap min-h-[52px] w-full rounded-xl bg-action-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover active:bg-action-primary-active focus-visible:outline-2 focus-visible:outline-ring"
          >
            ادامه
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {phase === "error" && errorMsg && (
              <p role="alert" className="pb-1 text-center text-[13px] font-medium text-[var(--danger)]">
                {errorMsg}
              </p>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onEditNumber}
                disabled={phase === "animating"}
                className="min-h-11 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                ویرایش شماره
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={phase === "animating" || resendIn > 0 || resendBusy}
                className={cn(
                  "min-h-11 rounded-lg px-2 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  resendIn > 0 || resendBusy || phase === "animating"
                    ? "cursor-default text-muted-foreground/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {resendIn > 0
                  ? `ارسال مجدد تا ${faResendIn} ثانیه`
                  : resendBusy
                    ? "در حال ارسال…"
                    : "ارسال مجدد کد"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
