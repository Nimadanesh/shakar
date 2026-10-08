"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  clearTaskReturn,
  peekTaskReturn,
  taskReturnMatches,
} from "@/lib/task-return";

/**
 * Pure retry-decision for the scroll restore (unit-testable).
 *
 * The results list renders ASYNCHRONOUSLY (loading skeleton → GET →
 * results, or a live SSE stream that replays). The restore must keep
 * retrying while the page is GROWING, and may only conclude "unreachable"
 * once the height has STABILIZED (content truly finished, still shorter
 * than the target). Concluding "too short" during loading was the
 * 2026-10-08 "lands at top" bug: the skeleton is always shorter than
 * target + viewport, so the old logic gave up on the first attempt.
 */
export interface RestoreProbe {
  tries: number;
  stableTries: number;
  lastHeight: number;
}

export interface RestoreReading {
  /** window.scrollY >= target - 4 */
  reached: boolean;
  /** document.documentElement.scrollHeight */
  height: number;
  /** height <= target + viewport */
  tooShort: boolean;
}

export function nextRestoreProbe(
  probe: RestoreProbe,
  reading: RestoreReading,
  opts: { maxTries: number; stableLimit: number }
): { done: boolean; probe: RestoreProbe } {
  const tries = probe.tries + 1;
  if (reading.reached) return { done: true, probe };
  const stableTries =
    Math.abs(reading.height - probe.lastHeight) < 2 ? probe.stableTries + 1 : 0;
  const settled = stableTries >= opts.stableLimit;
  const done = tries >= opts.maxTries || (settled && reading.tooShort);
  return { done, probe: { tries, stableTries, lastHeight: reading.height } };
}

const MAX_TRIES = 40; // ~12s at 300ms — covers slow GET + SSE replay
const STABLE_LIMIT = 5; // height unchanged 5× in a row → content settled

/**
 * Task-continuity scroll restore. The task page (hunt results) calls this
 * once on mount: if a task return was recorded for this page (user went to
 * an ad's detail, or through the auth gate, and came back), the exact
 * scroll position is restored after the results render. Otherwise nothing
 * happens.
 *
 * The slot is PEEKED, not consumed on read — and cleared only when the
 * restore finishes (reached / settled-too-short / max tries). Consuming
 * on first read was the second half of the 2026-10-08 bug: React
 * StrictMode (and any effect re-run) mounts the effect twice; the first
 * pass consumed the slot and its timer died in cleanup, so the second
 * pass found nothing and the user landed at the top. With peek +
 * clear-on-done, a repeated effect simply retries the same restore.
 * The 10-minute staleness guard + pathname match still prevent a fresh
 * visit from inheriting someone else's scroll.
 */
export function useTaskReturnRestore(enabled: boolean = true) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;
    const tr = peekTaskReturn();
    if (!tr) return;
    if (!taskReturnMatches(tr, pathname)) return;
    if (tr.scrollY <= 0) {
      clearTaskReturn();
      return;
    }

    let probe: RestoreProbe = { tries: 0, stableTries: 0, lastHeight: 0 };

    const attempt = () => {
      window.scrollTo(0, tr.scrollY);
      const reading: RestoreReading = {
        reached: window.scrollY >= tr.scrollY - 4,
        height: document.documentElement.scrollHeight,
        tooShort:
          document.documentElement.scrollHeight <= tr.scrollY + window.innerHeight,
      };
      const next = nextRestoreProbe(probe, reading, {
        maxTries: MAX_TRIES,
        stableLimit: STABLE_LIMIT,
      });
      probe = next.probe;
      if (next.done) clearTaskReturn();
      else timer = window.setTimeout(attempt, 300);
    };
    let timer = window.setTimeout(attempt, 60);
    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);
}
