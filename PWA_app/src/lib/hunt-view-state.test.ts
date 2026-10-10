import { describe, expect, it } from "vitest";

import type { HuntEvent, ScoredAd } from "@/lib/server/hunt/pipeline";
import { applyHuntViewEvent, createHuntViewState, matchLabel } from "./hunt-view-state";

function ad(over: Partial<ScoredAd> & { sourceAdId: string }): ScoredAd {
  return {
    title: "",
    price: null,
    city: "",
    score: 0,
    breakdown: { title: 0, description: 0, priceKnown: 0 },
    evidence: [],
    matchKind: "exact",
    missingInfo: [],
    ...over,
  };
}

describe("hunt view state — never show provisional cards", () => {
  it("starts empty while running and restores cached finals immediately", () => {
    const fresh = createHuntViewState(null);
    expect(fresh.results).toEqual([]);
    expect(fresh.done).toBe(false);
    const cached = createHuntViewState({ results: [ad({ sourceAdId: "a" })] });
    expect(cached.results.map((r) => r.sourceAdId)).toEqual(["a"]);
    expect(cached.done).toBe(true);
  });

  it("details-batch advances progress only and never appends cards", () => {
    let s = createHuntViewState(null);
    s = applyHuntViewEvent(s, { type: "details-batch", checked: 10, total: 40, confirmed: [ad({ sourceAdId: "x" })] } as HuntEvent);
    expect(s.results).toEqual([]);
    expect(s.checked).toBe(10);
    expect(s.total).toBe(40);
    expect(s.done).toBe(false);
    // Replay is idempotent: same event again changes nothing visible.
    const again = applyHuntViewEvent(s, { type: "details-batch", checked: 10, total: 40, confirmed: [ad({ sourceAdId: "x" })] } as HuntEvent);
    expect(again.results).toEqual([]);
  });

  it("done replaces the list once in exact server order; repeats cannot duplicate", () => {
    let s = createHuntViewState(null);
    const first = [ad({ sourceAdId: "b" }), ad({ sourceAdId: "a" })];
    s = applyHuntViewEvent(s, { type: "done", results: first, stats: {} as never } as HuntEvent);
    expect(s.results.map((r) => r.sourceAdId)).toEqual(["b", "a"]);
    expect(s.done).toBe(true);
    const replay = applyHuntViewEvent(s, { type: "done", results: first, stats: {} as never } as HuntEvent);
    expect(replay.results.map((r) => r.sourceAdId)).toEqual(["b", "a"]);
    expect(replay.results).toHaveLength(2);
  });

  it("tracks discovered vs shortlisted honestly without implying review", () => {
    let s = createHuntViewState(null);
    s = applyHuntViewEvent(s, { type: "lists-progress", pagesDone: 1, adsSeen: 120 });
    expect(s.discovered).toBe(120);
    expect(s.results).toEqual([]);
    s = applyHuntViewEvent(s, { type: "candidates", count: 40, dupsCollapsed: 2 });
    expect(s.shortlisted).toBe(40);
  });
});

describe("matchLabel — honest status from verified fields", () => {
  it("maps detailUnknown, exact, and near correctly", () => {
    expect(matchLabel({ detailUnknown: true, matchKind: "exact" })).toBe("بررسی ناقص");
    expect(matchLabel({ detailUnknown: true, matchKind: "near" })).toBe("بررسی ناقص");
    expect(matchLabel({ matchKind: "exact" })).toBe("تطابق متنی کامل");
    expect(matchLabel({ matchKind: "near" })).toBe("تطابق متنی نسبی");
  });
});
