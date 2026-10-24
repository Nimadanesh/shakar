import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { adKindForTitle, kindGateRejects, queryKindForDef } from "./kindLexicon";

/**
 * Issue 16 shadow experiment ONLY.
 *
 * This deliberately does not change production classification. It models a
 * safer candidate parser that first removes leading transaction-role cues,
 * then classifies the principal item head. Unknown remains unknown and never
 * becomes a hard rejection. The small candidate lexicon is local to this test
 * so we can measure paired outcomes before proposing any production edit.
 */
const LEADING_ROLE_CUES = new Set([
  "خرید",
  "خریدار",
  "فروش",
  "فروشی",
  "فوری",
  "اقساطی",
  "عمده",
  "انواع",
  "تکی",
  "معاوضه",
  "تعویض",
  "نیازمند",
  "میخر",
]);

const CANDIDATE_HEADS: Array<[string, string]> = [
  ["لوازم یدکی", "vehicle-part"],
  ["کاتالیزور", "vehicle-part"],
  ["اگزوز", "vehicle-part"],
  ["سپر", "vehicle-part"],
  ["گلگیر", "vehicle-part"],
  ["کاپوت", "vehicle-part"],
  ["چراغ", "vehicle-part"],
  ["بدنه", "vehicle-part"],
  ["لاستیک", "vehicle-part"],
  ["تویوتا", "vehicle"],
  ["دنا", "vehicle"],
  ["پارس", "vehicle"],
  ["پراید", "vehicle"],
  ["پژو", "vehicle"],
  ["سمند", "vehicle"],
  ["تیبا", "vehicle"],
  ["ماشین", "vehicle"],
  ["خودرو", "vehicle"],
];

function shadowAdKindForTitle(title: string): string | null {
  const tokens = normalizeForMatch(title).split(" ").filter(Boolean);
  while (tokens.length > 0 && LEADING_ROLE_CUES.has(tokens[0])) tokens.shift();
  if (tokens.length === 0) return null;

  // Longest explicit candidate head wins, but only at the principal title head.
  for (const [phrase, kind] of [...CANDIDATE_HEADS].sort((a, b) => b[0].length - a[0].length)) {
    if (tokens.join(" ").startsWith(phrase) || tokens.slice(0, phrase.split(" ").length).join(" ") === phrase) {
      return kind;
    }
  }

  // Keep the existing parser as a conservative fallback for established kinds.
  return adKindForTitle(tokens.join(" "));
}

describe("Issue 16 — candidate transaction-role / principal-item shadow parser (test-only)", () => {
  const queryKind = queryKindForDef(["خرید", "و", "فروش", "خودرو"], false, "vehicles");

  it("resolves transaction-prefixed catalyst and parts inventory as vehicle parts", () => {
    expect(shadowAdKindForTitle("خرید فروش انواع کاتالیزور خارجی ایران فرسوده")).toBe("vehicle-part");
    expect(shadowAdKindForTitle("خرید فروش کاتالیزور")).toBe("vehicle-part");
    expect(shadowAdKindForTitle("فروش لوازم یدکی لیفان بدنه ، موتوری و جلوبندی")).toBe("vehicle-part");
    expect(shadowAdKindForTitle("فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند")).toBe("vehicle-part");
    expect(shadowAdKindForTitle("فروش سپر جلوپنجره چراغ پراید پژو سمند ساینا کوئیک")).toBe("vehicle-part");
  });

  it("preserves principal whole-vehicle heads when the title mentions a secondary part", () => {
    expect(shadowAdKindForTitle("فروش فوری دنا پلاس توربو اتومات")).toBe("vehicle");
    expect(shadowAdKindForTitle("فروش دنا پلاس همراه با لاستیک زاپاس")).toBe("vehicle");
    expect(shadowAdKindForTitle("فروش فوری اقساطی تویوتا بیمه گارانتی سند بنام شما")).toBe("vehicle");
  });

  it("keeps unknown whole-vehicle buyer/dealer titles unknown instead of falsely rejecting them", () => {
    const buyer = shadowAdKindForTitle("کارشناسی وقیمت گذاری خودرو تصادفی وخریدار تصادفی");
    const dealer = shadowAdKindForTitle("فردا موتور FMC511 صفر و خشک برج روز نمایندگی");
    expect(buyer).toBe("vehicle");
    // The seller's brand phrase is not yet in the closed candidate lexicon.
    // Unknown remains a no-op: preserving recall is safer than guessing a part.
    expect(dealer).toBeNull();
    expect(kindGateRejects(queryKind, buyer)).toBeNull();
    expect(kindGateRejects(queryKind, dealer)).toBeNull();
  });

  it("shows the paired contrast with current production parsing without changing it", () => {
    const title = "خرید فروش کاتالیزور";
    expect(adKindForTitle(title)).toBeNull();
    expect(shadowAdKindForTitle(title)).toBe("vehicle-part");
    expect(kindGateRejects(queryKind, adKindForTitle(title))).toBeNull();
    expect(kindGateRejects(queryKind, shadowAdKindForTitle(title))?.tier).toBe("reject");
  });

  it("does not turn transaction role itself into item kind", () => {
    expect(shadowAdKindForTitle("خریدار خودرو تصادفی")).toBe("vehicle");
    expect(shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید")).toBe("vehicle-part");
    expect(kindGateRejects(queryKind, shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید"))?.tier).toBe("reject");
  });
});
