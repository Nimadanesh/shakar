import { describe, expect, it } from "vitest";
import { tierForVerdict, tierReasonIsSoft } from "./tier";

describe("HANDOFF-T — tier field, pure function", () => {
  it("tier 1: exact verdict, regardless of reasons", () => {
    expect(tierForVerdict("exact", [])).toEqual({ tier: 1, reasons: [] });
    expect(tierForVerdict("exact", ["missing-should"])).toEqual({
      tier: 1,
      reasons: ["missing-should"],
    });
  });

  it("tier 2: near with only sibling-variant reasons", () => {
    expect(tierForVerdict("near", ["sibling-variant"])).toEqual({
      tier: 2,
      reasons: ["sibling-variant"],
    });
    expect(
      tierForVerdict("near", ['sibling-variant:listing-adds:"پودر"'])
    ).toEqual({
      tier: 2,
      reasons: ['sibling-variant:listing-adds:"پودر"'],
    });
    expect(tierForVerdict("near", ['part:listing-adds:"رینگ"'])).toEqual({
      tier: 3,
      reasons: ['part:listing-adds:"رینگ"'],
    });
  });

  it("tier 2: near with only missing should", () => {
    expect(tierForVerdict("near", ["missing-should"])).toEqual({
      tier: 2,
      reasons: ["missing-should"],
    });
  });

  it("tier 2: near with soft reasons combined", () => {
    expect(
      tierForVerdict("near", ["sibling-variant", "missing-should"])
    ).toEqual({
      tier: 2,
      reasons: ["sibling-variant", "missing-should"],
    });
  });

  it("tier 3: near with partial-evidence (incomplete MUST)", () => {
    expect(tierForVerdict("near", ["partial-evidence"])).toEqual({
      tier: 3,
      reasons: ["partial-evidence"],
    });
  });

  it("tier 3: near with style-prefix, even though it contains sibling-variant", () => {
    expect(
      tierForVerdict("near", ['sibling-variant:style-prefix:"طرح پراید"'])
    ).toEqual({
      tier: 3,
      reasons: ['sibling-variant:style-prefix:"طرح پراید"'],
    });
    expect(tierReasonIsSoft('sibling-variant:style-prefix:"طرح پراید"')).toBe(
      false
    );
  });

  it("tier 3: near with R11/R12 demotions (bait, demand-goods, kind, cap)", () => {
    for (const reason of ["bait", "demand-goods", "kind", "cap"]) {
      expect(tierForVerdict("near", [reason]).tier).toBe(3);
    }
  });

  it("tier 3: near with detail-unknown and no-must-terms", () => {
    expect(tierForVerdict("near", ["detail-unknown"]).tier).toBe(3);
    expect(tierForVerdict("near", ["no-must-terms"]).tier).toBe(3);
  });

  it("tier 3: near with a soft reason plus any hard reason", () => {
    expect(
      tierForVerdict("near", ["sibling-variant", "partial-evidence"]).tier
    ).toBe(3);
    expect(tierForVerdict("near", ["missing-should", "bait"]).tier).toBe(3);
  });

  it("tier 3: near with an unknown fake reason", () => {
    expect(tierForVerdict("near", ["made-up-xyz"]).tier).toBe(3);
    expect(tierReasonIsSoft("made-up-xyz")).toBe(false);
  });

  it("tier 3: near with no reasons at all (unknown)", () => {
    expect(tierForVerdict("near", [])).toEqual({ tier: 3, reasons: [] });
  });

  it("tier 4: any rejection, reason kept verbatim", () => {
    expect(tierForVerdict("rejected", ["exclude"])).toEqual({
      tier: 4,
      reasons: ["exclude"],
    });
    expect(tierForVerdict("rejected", ['part:title-offering:"کارشناسی"'])).toEqual({
      tier: 4,
      reasons: ['part:title-offering:"کارشناسی"'],
    });
    expect(tierForVerdict("rejected", ["price-out-of-range"])).toEqual({
      tier: 4,
      reasons: ["price-out-of-range"],
    });
    expect(tierForVerdict("rejected", ["no-match"])).toEqual({
      tier: 4,
      reasons: ["no-match"],
    });
  });
});

describe("HANDOFF-K — mixed transaction caps at tier 3", () => {
  it("tier 3: near with transaction:mixed, alone or with cap", () => {
    expect(tierForVerdict("near", ["transaction:mixed"]).tier).toBe(3);
    expect(tierForVerdict("near", ["cap", "transaction:mixed"]).tier).toBe(3);
    expect(tierReasonIsSoft("transaction:mixed")).toBe(false);
  });
});

describe("HANDOFF-1 — buy-and-sell catalogue caps at tier 3", () => {
  it("tier 3: near with store:buy-sell, alone or with cap", () => {
    expect(tierForVerdict("near", ["store:buy-sell"]).tier).toBe(3);
    expect(tierForVerdict("near", ["cap", "store:buy-sell"]).tier).toBe(3);
    expect(tierReasonIsSoft("store:buy-sell")).toBe(false);
  });
});

describe("HANDOFF-2 — one-letter guess caps at tier 3", () => {
  it("tier 3: near with spelling-guess, alone or with cap", () => {
    expect(tierForVerdict("near", ["spelling-guess"]).tier).toBe(3);
    expect(tierForVerdict("near", ["cap", "spelling-guess"]).tier).toBe(3);
    expect(tierReasonIsSoft("spelling-guess")).toBe(false);
  });
});
