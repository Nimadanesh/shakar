/**
 * R12: unit tests for the Mizan rejection guards.
 *
 * huntTargetKinds encodes the R11 lesson (33 wrong rejections, 13 from one
 * hole): a judgment naming the hunt's OWN target kind must never reject —
 * "service" on repair hunts, "derived" on the peanut-butter hunt.
 * mizanSaysReject: Noul is the sole rejection channel, only corroborated.
 */
import { describe, expect, it } from "vitest";
import {
  huntTargetKinds,
  mizanSaysReject,
  type MizanJudgment,
} from "./mizan";

describe("huntTargetKinds (R12 generalized guard)", () => {
  it("goods hunt targets nothing rejectable", () => {
    const t = huntTargetKinds("vehicle", false, ["پراید"]);
    expect(t.size).toBe(0);
  });

  it("service hunt by kind targets service (H2/H17 class)", () => {
    const t = huntTargetKinds("service", false, ["تعمیرکار", "یخچال"]);
    expect(t.has("service")).toBe(true);
    expect(t.has("part")).toBe(false);
  });

  it("service hunt by intent targets service even when kind is the goods", () => {
    // «تعمیرکار یخچال میخوام»: queryKindForDef may return the target's kind;
    // serviceIntent is the structural signal.
    const t = huntTargetKinds("appliance", true, ["تعمیرکار", "یخچال", "میخوام"]);
    expect(t.has("service")).toBe(true);
  });

  it("derived hunt targets derived (H20: کره بادوم زمینی)", () => {
    const t = huntTargetKinds("food-derived", false, ["کره", "بادوم", "زمینی"]);
    expect(t.has("derived")).toBe(true);
    expect(t.has("service")).toBe(false);
  });

  it("part hunt targets part (H14: باطری ماشین)", () => {
    const t = huntTargetKinds("vehicle-part", false, ["باطری", "ماشین"]);
    expect(t.has("part")).toBe(true);
  });

  it("accessory hunt targets accessory (H15: قاب آیفون)", () => {
    const t = huntTargetKinds("mobile-accessory", false, ["قاب", "آیفون", "۱۳"]);
    expect(t.has("accessory")).toBe(true);
  });

  it("hunt words naming a part target part+accessory even under a goods kind", () => {
    const t = huntTargetKinds("vehicle", false, ["باطری", "ماشین"]);
    expect(t.has("part")).toBe(true);
    expect(t.has("accessory")).toBe(true);
  });

  it("training hunt protects service (Mizan has no training label)", () => {
    const t = huntTargetKinds("training", false, ["آموزش", "تعمیرات", "موبایل"]);
    expect(t.has("service")).toBe(true);
  });

  it("consumable hunt targets nothing in the Mizan label space", () => {
    const t = huntTargetKinds("consumable", false, ["پودر", "لباسشویی"]);
    expect(t.size).toBe(0);
  });

  it("never protects other or whole, for any hunt shape", () => {
    const shapes: Array<[string, boolean, string[]]> = [
      ["vehicle", false, ["پراید"]],
      ["service", true, ["تعمیرکار", "یخچال"]],
      ["food-derived", false, ["کره", "بادوم", "زمینی"]],
      ["vehicle-part", false, ["باطری", "ماشین"]],
      ["mobile-accessory", false, ["قاب", "آیفون"]],
      ["training", false, ["آموزش", "تعمیرات"]],
      ["general", false, ["یخچال"]],
    ];
    for (const [kind, intent, terms] of shapes) {
      const t = huntTargetKinds(kind, intent, terms);
      expect(t.has("other")).toBe(false);
      expect(t.has("whole")).toBe(false);
    }
  });
});

describe("mizanSaysReject (Noul channel)", () => {
  const base: MizanJudgment = {
    itemKind: null,
    itemConfidence: 0,
    violates: null,
    violateProbability: 0,
    actionable: false,
    unavailable: false,
  };

  it("rejects only a corroborated high-probability violation", () => {
    const j: MizanJudgment = {
      ...base,
      violates: true,
      violateProbability: 0.9,
      actionable: true,
    };
    expect(mizanSaysReject(j, true).reject).toBe(true);
    expect(mizanSaysReject(j, false).reject).toBe(false);
  });

  it("never rejects on Choice alone, however confident", () => {
    const j: MizanJudgment = {
      ...base,
      itemKind: "part",
      itemConfidence: 0.99,
      actionable: true,
    };
    expect(mizanSaysReject(j, true).reject).toBe(false);
  });

  it("never rejects when not actionable", () => {
    const j: MizanJudgment = {
      ...base,
      violates: true,
      violateProbability: 0.5,
      actionable: false,
    };
    expect(mizanSaysReject(j, true).reject).toBe(false);
  });
});
