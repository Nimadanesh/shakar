/**
 * Regression tests for the 2026-10-08 "lands at top" bug.
 *
 * Root cause: when returning from an ad's detail page, the results list
 * renders asynchronously (loading skeleton → GET → results, or a live SSE
 * stream that replays). The old restore logic concluded "unreachable" on
 * the FIRST attempt whenever scrollHeight <= target + viewport — which is
 * always true while the page is still a short skeleton. The retry gave up
 * before the results rendered, and the user landed at the top.
 *
 * The fix: keep retrying while the page is GROWING; only conclude
 * "too short" once the height has STABILIZED.
 */
import { describe, expect, it } from "vitest";

import {
  nextRestoreProbe,
  type RestoreProbe,
} from "@/hooks/useTaskReturnRestore";

const OPTS = { maxTries: 40, stableLimit: 5 };
const FRESH: RestoreProbe = { tries: 0, stableTries: 0, lastHeight: 0 };

function runSequence(
  heights: number[],
  opts = OPTS
): { doneAt: number | null; finalProbe: RestoreProbe } {
  let probe: RestoreProbe = { ...FRESH };
  for (let i = 0; i < heights.length; i++) {
    const next = nextRestoreProbe(
      probe,
      { reached: false, height: heights[i], tooShort: true },
      opts
    );
    probe = next.probe;
    if (next.done) return { doneAt: i, finalProbe: probe };
  }
  return { doneAt: null, finalProbe: probe };
}

describe("nextRestoreProbe", () => {
  it("keeps retrying while the page is growing (the bug scenario)", () => {
    // Skeleton (800) → results streaming in (1200, 2000, 3200) →
    // settled above the target. Must NOT give up early.
    const { doneAt } = runSequence([800, 1200, 2000, 3200, 3200, 3200]);
    expect(doneAt).toBeNull();
  });

  it("gives up once the height stabilizes below the target", () => {
    // Short page that never grows: after 5 stable readings → done.
    const { doneAt } = runSequence([800, 800, 800, 800, 800, 800, 800]);
    expect(doneAt).not.toBeNull();
    // 1st reading sets lastHeight; 5 more unchanged → settled → done.
    expect(doneAt).toBe(5);
  });

  it("a single growing-then-stable sequence does not stop early", () => {
    // The exact old-bug shape: first reading is a short skeleton.
    // Old logic: done at i=0. New logic: keeps going while growing.
    const { doneAt } = runSequence([600, 900, 1500]);
    expect(doneAt).toBeNull();
  });

  it("stops immediately when the target is reached", () => {
    const next = nextRestoreProbe(
      FRESH,
      { reached: true, height: 4000, tooShort: false },
      OPTS
    );
    expect(next.done).toBe(true);
  });

  it("gives up at maxTries even if the page keeps growing", () => {
    const heights = Array.from({ length: 50 }, (_, i) => 1000 + i * 100);
    const { doneAt } = runSequence(heights, { maxTries: 10, stableLimit: 5 });
    expect(doneAt).toBe(9);
  });

  it("a late growth spurt resets the stability counter", () => {
    // 4 stable readings, then growth, then stable again → the first
    // stable run must NOT trigger done.
    const { doneAt } = runSequence([
      800, 800, 800, 800, // 4 stable (not yet at limit 5)
      1600, // growth resets
      1600, 1600, 1600, 1600, 1600, // 5 stable → done here
    ]);
    expect(doneAt).toBe(9);
  });
});
