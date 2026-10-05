"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Crosshair, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";
import { markOnboarded } from "@/lib/first-run";

const BEATS = [
  {
    icon: Sparkles,
    title: "فقط همان چندتایی را ببین که واقعاً می‌خواهی.",
    sub: "شکار، برای حرفه‌ای‌های دیوار",
    tagline: true,
    mock: false,
  },
  {
    icon: Crosshair,
    title: "تعریف کن، شکار کن",
    sub: "به زبان خودت بنویس چی می‌خوای، مشخصات شکار رو بده، یه دکمه بزن — تمام.",
    tagline: false,
    mock: true,
  },
  {
    icon: Bell,
    title: "کمین بذار",
    sub: "آگهی اوکازیون که اومد، خبرت می‌کنم؛ از دستش نمی‌دی.",
    tagline: false,
    mock: false,
  },
] as const;

/**
 * A miniature, non-interactive echo of the real hunt form — the beat's
 * promise made visible, in the product's own visual language.
 */
function HuntMock() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[280px] flex-col gap-2 rounded-lg border border-border bg-card p-3 text-start"
    >
      <p className="text-[13px] leading-5 text-foreground">پیانو یاماها U3</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] leading-4 text-foreground">
          یاماها
        </span>
        <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] leading-4 text-foreground">
          U3
        </span>
        <span className="rounded-md border border-border px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
          <span className="line-through">دیجیتال</span>
        </span>
      </div>
      <div className="flex h-9 items-center justify-center rounded-lg bg-action-primary text-[13px] font-medium text-primary-foreground">
        شکار کن
      </div>
    </div>
  );
}

/**
 * First-launch value communication. Three quiet beats, no feature tour.
 * Sets the onboarded flag on completion OR skip — never traps the user.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const touchX = useRef<number | null>(null);

  const complete = useCallback(() => {
    markOnboarded();
    router.replace("/");
  }, [router]);

  const beat = BEATS[step];
  const Icon = beat.icon;
  const isLast = step === BEATS.length - 1;

  function handleTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    // RTL: swipe left = next, swipe right = previous.
    if (dx < -48 && step < BEATS.length - 1) setStep(step + 1);
    else if (dx > 48 && step > 0) setStep(step - 1);
  }

  return (
    <main
      className="flex flex-1 flex-col py-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between">
        <LogoMark className="size-9 text-foreground" />
        <button
          type="button"
          onClick={complete}
          className="min-h-11 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          رد شدن
        </button>
      </div>

      <div
        key={step}
        className="animate-rise flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center"
      >
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full border border-border bg-card text-foreground"
        >
          <Icon size={28} strokeWidth={1.5} />
        </span>
        <h1
          className={cn(
            "max-w-xs text-foreground",
            beat.tagline
              ? "text-xl font-semibold leading-9"
              : "text-2xl font-bold leading-10"
          )}
        >
          {beat.title}
        </h1>
        <p className="max-w-xs text-[15px] leading-7 text-muted-foreground">
          {beat.sub}
        </p>
        {beat.mock && <HuntMock />}
      </div>

      <div className="flex flex-col gap-4">
        <div
          className="flex items-center justify-center gap-2"
          role="tablist"
          aria-label="مراحل آشنایی"
        >
          {BEATS.map((b, i) => (
            <button
              key={b.title}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`مرحله ${i + 1}`}
              onClick={() => setStep(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === step ? "w-6 bg-foreground" : "w-2 bg-border-strong hover:bg-muted-foreground"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (isLast ? complete() : setStep(step + 1))}
          className="min-h-[52px] w-full rounded-lg bg-action-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
        >
          {isLast ? "شروع شکار" : "بعدی"}
        </button>
      </div>
    </main>
  );
}
