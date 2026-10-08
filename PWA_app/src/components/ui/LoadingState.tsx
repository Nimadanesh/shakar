"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * WAITING ELEMENT — pixel-grid loader for button-triggered work.
 *
 * One variant only: square cells, chevron wavefront driving right.
 * The 650ms cycle is shorter than the sweep, so two fronts are
 * always in flight. Monochrome, Persian shimmer label, Persian
 * elapsed timer. The global reduced-motion rule freezes the grid.
 *
 * Rule: never theatrical. This renders only while real work is
 * pending (a navigation transition, an async call) — no fake
 * delays, no timers that pretend.
 * ───────────────────────────────────────────────────────── */

// Chevron wavefront: middle-left cell fires first, opening rightward.
const WAVE = [90, 180, 270, 0, 90, 180, 90, 180, 270];
const CYCLE_MS = 650;

export function LoaderGrid({ tone }: { tone: "default" | "on-primary" }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
    >
      {WAVE.map((delay, index) => (
        <span
          key={index}
          className={`size-[4px] rounded-[1px] ${tone === "on-primary" ? "bg-primary-foreground" : "bg-foreground"}`}
          style={{ animation: `pixel-on ${CYCLE_MS}ms ease-in-out ${delay}ms infinite` }}
        />
      ))}
    </span>
  );
}

function formatElapsed(sec: number): string {
  const fa = (n: string) => n.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  if (sec < 60) return `${fa(String(sec))} ثانیه`;
  const minutes = Math.floor(sec / 60);
  return `${fa(String(minutes))} دقیقه و ${fa(String(sec % 60))} ثانیه`;
}

function useElapsed(active: boolean): string {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!active) return;
    // 1s tick, not 100ms: the old 10-renders/sec churned the whole subtree
    // for the duration of a long hunt for 0.1s precision nobody needs.
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  return formatElapsed(sec);
}

export function LoadingState({
  label,
  showElapsed = true,
  tone = "default",
  className,
}: {
  /** Persian label, e.g. «در حال شکار». No default — the caller names the work. */
  label: string;
  showElapsed?: boolean;
  /** "on-primary" when rendered on a primary button (dark cells/label). */
  tone?: "default" | "on-primary";
  className?: string;
}) {
  const elapsed = useElapsed(showElapsed);
  const onPrimary = tone === "on-primary";
  const strong = onPrimary ? "var(--primary-foreground)" : "var(--foreground)";
  const soft = onPrimary
    ? "color-mix(in srgb, var(--primary-foreground) 55%, transparent)"
    : "var(--muted-foreground)";

  return (
    <span role="status" className={cn("flex w-fit items-center gap-2.5", className)}>
      <LoaderGrid tone={tone} />
      <span
        className="bg-clip-text text-[13px] font-medium text-transparent"
        style={{
          backgroundImage: `linear-gradient(90deg, ${soft} 35%, ${strong} 50%, ${soft} 65%)`,
          backgroundSize: "200% 100%",
          animation: "shimmer-text 1.4s linear infinite",
        }}
      >
        {label}
      </span>
      {showElapsed && (
        <span
          className="text-[12px] tabular-nums"
          style={{ color: soft }}
        >
          {elapsed}
        </span>
      )}
    </span>
  );
}
