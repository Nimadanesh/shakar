import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { adKindForTitle, kindGateRejects, queryKindForDef } from "./kindLexicon";
import { assessModelSpecificity } from "./semantics";

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
  "و",
  "خریدار",
  "فروش",
  "فروشی",
  "فوری",
  "اقساطی",
  "اقساتی",
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

  // Narrow positive control: the source title explicitly seeks a damaged
  // whole vehicle even though the title begins with an appraisal phrase.
  if (tokens.join(" ").includes("خودرو تصادفی")) return "vehicle";

  // Candidate component heads are checked first so later model names cannot
  // turn a part listing into a whole vehicle.
  const partHeads = CANDIDATE_HEADS.filter(([, kind]) => kind === "vehicle-part")
    .sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, kind] of partHeads) {
    if (tokens.join(" ").startsWith(phrase)) return kind;
  }

  // Candidate whole-vehicle aliases are checked before the existing parser,
  // but compound appliance heads are protected explicitly. This avoids an
  // existing parser's unknown result masking an unambiguous vehicle head.
  const normalizedHead = tokens.join(" ");
  if (normalizedHead.startsWith("ماشین لباسشویی")) return "appliance";

  const vehicleHeads = CANDIDATE_HEADS.filter(([, kind]) => kind === "vehicle")
    .sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, kind] of vehicleHeads) {
    if (normalizedHead.startsWith(phrase)) return kind;
  }

  // Preserve all other established compound-head rules before returning unknown.
  const established = adKindForTitle(normalizedHead);
  if (established !== null) return established;
  return null;
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
    expect(shadowAdKindForTitle("ماشین لباسشویی پاکشوما")).toBe("appliance");
    expect(shadowAdKindForTitle("خریدار خودرو تصادفی")).toBe("vehicle");
    expect(shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید")).toBe("vehicle-part");
    expect(kindGateRejects(queryKind, shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید"))?.tier).toBe("reject");
  });
});


describe("Issue 16 — three-reader counter-risk (test-only)", () => {
  it("shows a candidate part kind can broaden same-kind marker skipping on a specific-part hunt", () => {
    // Today, because «کاتالیزور» is not in HEAD_KIND, category fallback says
    // vehicle. If it were added as vehicle-part, queryKindForDef would resolve
    // the direct hunt to vehicle-part. The marker guard then treats *all*
    // vehicle-part markers as compatible siblings, not just the hunted part.
    expect(queryKindForDef(["کاتالیزور"], false, "vehicles")).toBe("vehicle");

    const currentKind = assessModelSpecificity(
      ["کاتالیزور"],
      "دیسک و کاتالیزور پراید",
      "vehicles",
      "vehicle",
      "کاتالیزور",
      "دیسک و کاتالیزور پراید"
    );
    const hypotheticalBroadPartKind = assessModelSpecificity(
      ["کاتالیزور"],
      "دیسک و کاتالیزور پراید",
      "vehicles",
      "vehicle-part",
      "کاتالیزور",
      "دیسک و کاتالیزور پراید"
    );

    expect(currentKind.mismatch).toBe(true);
    expect(currentKind.tier).toBe("reject");
    // This assertion records the counter-risk; it is not an endorsed outcome.
    expect(hypotheticalBroadPartKind.mismatch).toBe(false);
  });

  it("keeps role-prefix parsing separate from the item-kind dictionary", () => {
    const title = "خرید فروش کاتالیزور";
    expect(adKindForTitle(title)).toBeNull();
    expect(shadowAdKindForTitle(title)).toBe("vehicle-part");

    // The whole-car positive and tire-only negative remain role-independent.
    expect(shadowAdKindForTitle("کارشناسی وقیمت گذاری خودرو تصادفی وخریدار تصادفی")).toBe("vehicle");
    expect(shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید")).toBe("vehicle-part");
    expect(kindGateRejects(queryKind, shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید"))?.tier).toBe("reject");
  });
});
