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
  "پخش",
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

  it("demonstrates the false-acceptance counter-risk when a specific-part hunt mentions a different part only secondarily", () => {
    // Synthetic diagnostic only, not a source ad or a human grade. The listing
    // subject is a brake disc; catalyst appears only as contextual text.
    // If the hunt's query kind is broadened to vehicle-part, the current
    // kind-wide guard skips «دیسک» and loses the wrong-subject rejection.
    const listingTitle = "دیسک ترمز پراید سالم";
    const listingText = "دیسک ترمز پراید سالم و آماده نصب؛ مناسب خودروهای دارای کاتالیزور فابریک";
    const currentKind = assessModelSpecificity(
      ["کاتالیزور"],
      listingText,
      "vehicles",
      "vehicle",
      "کاتالیزور",
      listingTitle
    );
    const hypotheticalBroadPartKind = assessModelSpecificity(
      ["کاتالیزور"],
      listingText,
      "vehicles",
      "vehicle-part",
      "کاتالیزور",
      listingTitle
    );

    expect(currentKind.mismatch).toBe(true);
    expect(currentKind.tier).toBe("reject");
    expect(hypotheticalBroadPartKind.mismatch).toBe(false);
  });

  it("keeps role-prefix parsing separate from the item-kind dictionary", () => {
    const queryKind = "vehicle";
    const title = "خرید فروش کاتالیزور";
    expect(adKindForTitle(title)).toBeNull();
    expect(shadowAdKindForTitle(title)).toBe("vehicle-part");

    // The whole-car positive and tire-only negative remain role-independent.
    expect(shadowAdKindForTitle("کارشناسی وقیمت گذاری خودرو تصادفی وخریدار تصادفی")).toBe("vehicle");
    expect(shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید")).toBe("vehicle-part");
    expect(kindGateRejects(queryKind, shadowAdKindForTitle("لاستیک تیبا معاوضه با پراید"))?.tier).toBe("reject");
  });

  it("characterizes production-versus-shadow outcomes for frozen role-prefixed titles", () => {
    const cases: Array<{ id: string; title: string; candidate: string | null }> = [
      {
        id: "05F-B01 catalyst inventory",
        title: "خرید فروش انواع کاتالیزور خارجی ایران فرسوده",
        candidate: "vehicle-part",
      },
      {
        id: "05F-B04 body-parts inventory",
        title: "فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند",
        candidate: "vehicle-part",
      },
      {
        id: "05F-B07 whole-vehicle dealer",
        title: "فردا موتور FMC511/صفر و خشک برج روز/نمایندگی",
        candidate: null,
      },
      {
        id: "05F-B02 buyer-seeking vehicle",
        title: "خریدار خودرو تصادفی",
        candidate: "vehicle",
      },
      {
        id: "05F-D08 exhaust/catalyst inventory",
        title: "پخش انواع اگزوز.طرح تعویض کاتالیزورهای فرسوده",
        candidate: "vehicle-part",
      },
    ];

    for (const row of cases) {
      // The current production head parser does not consume these leading
      // transaction-role prefixes; unknown must remain a no-op.
      expect(adKindForTitle(row.title), row.id).toBeNull();
      expect(shadowAdKindForTitle(row.title), row.id).toBe(row.candidate);
    }
  });

  it("runs the candidate parser against the locked Issue 16 source-title controls", () => {
    const queryKind = queryKindForDef(["خرید", "و", "فروش", "خودرو"], false, "vehicles");
    expect(queryKind).toBe("vehicle");

    // Source-pinned titles only. These are shadow outcomes, not production
    // outcomes and not human grades. Unknown dealer heads must remain no-op.
    const cases: Array<{ id: string; title: string; expected: string | null; gate: string | null }> = [
      { id: "B01 catalyst", title: "خرید فروش انواع کاتالیزور خارجی ایران فرسوده", expected: "vehicle-part", gate: "reject" },
      { id: "B02 damaged-vehicle buyer", title: "کارشناسی وقیمت گذاری خودرو تصادفی /وخریدار تصادفی", expected: "vehicle", gate: null },
      { id: "B03 bulk body parts", title: "بدنه کاپوت گلگیر سپر چراغ قیمت عمده", expected: "vehicle-part", gate: "reject" },
      { id: "B04 stock body-parts inventory", title: "فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند", expected: "vehicle-part", gate: "reject" },
      { id: "B05 catalyst repair", title: "کاتالیزور o. تعمیر. o خرید خاک و منبع", expected: "vehicle-part", gate: "reject" },
      { id: "B06 tire-only exchange", title: "لاستیک تیبا 95درصد معاوضه با پراید", expected: "vehicle-part", gate: "reject" },
      { id: "B07 whole-vehicle dealer", title: "فردا موتور FMC511/صفر و خشک برج روز/نمایندگی", expected: null, gate: null },
      { id: "D02 Toyota vehicle offer", title: "فروش فوری اقساطی تویوتا/بیمه گارانتی/سندبنام شما", expected: "vehicle", gate: null },
      { id: "D03 Lifan parts inventory", title: "فروش لوازم یدکی لیفان بدنه ، موتوری و جلوبندی", expected: "vehicle-part", gate: "reject" },
      { id: "D05 direct Dena sale", title: "دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری", expected: "vehicle", gate: null },
      { id: "D07 vehicle installment sales", title: "فروش اقساطی خودرو", expected: "vehicle", gate: null },
      { id: "D08 exhaust/catalyst control", title: "پخش انواع اگزوز.طرح تعویض کاتالیزورهای فرسوده", expected: "vehicle-part", gate: "reject" },
    ];

    for (const row of cases) {
      const actualKind = shadowAdKindForTitle(row.title);
      expect(actualKind, row.id).toBe(row.expected);
      const verdict = kindGateRejects(queryKind, actualKind);
      expect(verdict?.tier ?? null, row.id).toBe(row.gate);
    }
  });

});


/**
 * Subject-identity/co-offer prototype, deliberately test-local and not wired
 * into production. It is intentionally conservative: only a clear title-level
 * target offer can override a different known part subject; description-only
 * target mentions cannot. Unknown principal subjects return "unknown".
 */
type ShadowSubjectVerdict = "reject" | "allow" | "unknown";

const SHADOW_PART_SUBJECTS = [
  "اگزوز",
  "کاتالیزور",
  "دیسک ترمز",
  "دیسک",
  "لنت ترمز",
  "لنت",
  "باتری",
  "لاستیک",
  "چراغ",
  "سپر",
  "گلگیر",
  "کاپوت",
] as const;

function shadowSpecificSubjectVerdict(
  querySubject: string,
  title: string,
  description: string
): ShadowSubjectVerdict {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedDescription = normalizeForMatch(description);
  const target = normalizeForMatch(querySubject);

  // Capture 06C C01 is human grade 1 for «کاتالیزور خودرو»: its principal
  // product is catalyst dust («خاک کاتالیزور»), not a catalytic converter.
  // Keep this subtype distinction local to the experiment until more paired
  // evidence exists; a later direct occurrence of «کاتالیزور» can still count.
  if (target === normalizeForMatch("کاتالیزور")) {
    const dustStart = normalizedTitle.indexOf(normalizeForMatch("خاک کاتالیزور"));
    const firstTargetStart = normalizedTitle.indexOf(target);
    if (
      dustStart >= 0 &&
      firstTargetStart === dustStart + "خاک ".length &&
      normalizedTitle.slice(dustStart, firstTargetStart).trim() === normalizeForMatch("خاک")
    ) {
      return "reject";
    }
  }

  const knownTitleSubjects = SHADOW_PART_SUBJECTS.filter((subject) =>
    normalizedTitle.includes(normalizeForMatch(subject))
  );
  if (knownTitleSubjects.length === 0) return "unknown";

  // A direct target mention is not enough. Require a connector located
  // between two non-overlapping known part mentions; an unrelated "و" elsewhere
  // in the title must not turn two mentions into an explicit co-offer.
  const targetStart = normalizedTitle.indexOf(target);
  const hasTargetInTitle = targetStart >= 0;
  const targetEnd = targetStart + target.length;
  // A connector alone can also join service/repair objects. Require a lexical
  // title cue that the listing is offering items, not merely discussing them.
  const hasExplicitOfferCue =
    /(?:^| )(?:فروش|عرضه|موجود|فروشی)(?: |$)/.test(normalizedTitle);
  const hasServiceCue =
    /(?:^| )(?:خدمات|تعمیر|تعویض|اجرت|نصب)(?: |$)/.test(normalizedTitle);
  const explicitCoOffer =
    hasTargetInTitle && hasExplicitOfferCue && !hasServiceCue && knownTitleSubjects.some((subject) => {
    const other = normalizeForMatch(subject);
    if (other === target) return false;
    const otherStart = normalizedTitle.indexOf(other);
    if (otherStart < 0) return false;
    const otherEnd = otherStart + other.length;
    // Overlapping aliases (e.g. "دیسک" inside "دیسک ترمز") are one
    // mention, not evidence that two different items are co-offered.
    if (targetStart < otherEnd && otherStart < targetEnd) return false;
    const between = targetEnd <= otherStart
      ? normalizedTitle.slice(targetEnd, otherStart)
      : normalizedTitle.slice(otherEnd, targetStart);
    return /^(?:\s*و\s*|\s*همراه با\s*|\s*به همراه\s*|\s*به‌همراه\s*)$/.test(between);
  });

  if (explicitCoOffer) return "allow";

  // If a different recognized part leads the title and the target appears only
  // in the description, do not let broad same-kind compatibility erase subject
  // identity. This remains a diagnostic policy, not a production verdict.
  const firstSubject = knownTitleSubjects
    .slice()
    .sort((a, b) => normalizedTitle.indexOf(normalizeForMatch(a)) - normalizedTitle.indexOf(normalizeForMatch(b)))[0];
  const firstSubjectNormalized = normalizeForMatch(firstSubject);
  if (
    firstSubjectNormalized !== target &&
    !hasTargetInTitle &&
    normalizedDescription.includes(target)
  ) {
    return "reject";
  }

  // A known different principal subject without an explicit target co-offer is
  // a counter-signal; the prototype does not silently accept it.
  if (firstSubjectNormalized !== target) return "reject";
  return "allow";
}

describe("Issue 16 — source-backed secondary-part marker controls (test-only)", () => {
  it("preserves the D05 whole-vehicle positive when existing part markers occur after the clean subject", () => {
    // Frozen source snapshot: I16-CAPTURE-05D-BLIND.md D05, source ID
    // gacTnnuH, human grade 3. Exact title; description excerpt preserves
    // the existing PART_MARKERS «کمک» and «تایر» as secondary details.
    const title = "دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری";
    const description =
      "دنا پلاس توربو اتومات 1400 بدون رنگ کامل بدون ضربه شاسی جلو عقب پلمپ بدون صافکاری و پی دی آر بدنه مثل آینه داخل کابین در حد صفر همه مصرفیها تعویض رو 120 تا تسمه تایم روغن گیربکس خنک کن روغن موتور تازه تعویض شده کمک فنر عقب نو کمک فنر جلو تازه پیچی شده ماشین نرم و بی صر و صدا تایر جلو نو چینی خلاصه ماشین دست خودم بوده با وسواس نگهداری شده و تو پارکینگ بوده اکثرا مناسب مصرف کننده به دلیل نیاز مالی میفروشم";
    const queryTerms = ["دنا", "پلاس", "توربو", "اتومات"];
    const result = assessModelSpecificity(
      queryTerms,
      `${title} ${description}`,
      "vehicles",
      "vehicle",
      queryTerms.join(" "),
      title
    );

    expect(result.mismatch).toBe(false);
  });

  it("still rejects the B03 parts-only inventory when an existing part marker leads the subject", () => {
    // Frozen source snapshot: I16-CAPTURE-05F-FRESH-SUBSET-BLIND.md H05F-B03,
    // human grade 1. «چراغ» is an existing PART_MARKERS entry before the
    // vehicle model name in the body, so this is a true paired marker control.
    const title = "بدنه کاپوت گلگیر سپر چراغ قیمت عمده";
    const listingText =
      `${title} پخش قطعات بدنه محصولات سایپا و ایران خودرو کاپوت پراید گلگیر پراید روکش در پراید`;
    const result = assessModelSpecificity(
      ["پراید"],
      listingText,
      "vehicles",
      "vehicle",
      "پراید",
      title
    );

    expect(result.mismatch).toBe(true);
    expect(result.tier).toBe("reject");
  });
});


describe("Issue 16 — subject identity / explicit co-offer prototype (test-only)", () => {
  it("preserves the source-backed D05 whole-car positive with secondary parts in description", () => {
    const title = "دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری";
    const description = "کمک فنر عقب نو و تایر جلو نو؛ خودرو دست خودم بوده";
    // Item-kind parser remains the authority for this whole-car control.
    expect(shadowAdKindForTitle(title)).toBe("vehicle");
    const markerResult = assessModelSpecificity(
      ["دنا", "پلاس", "توربو", "اتومات"],
      `${title} ${description}`,
      "vehicles",
      "vehicle",
      "دنا پلاس توربو اتومات",
      title
    );
    expect(markerResult.mismatch).toBe(false);
    // Part identity logic is scoped to direct specific-part hunts, not this car hunt.
    expect(shadowSpecificSubjectVerdict("کاتالیزور", title, description)).toBe("unknown");
  });

  it("keeps the source-backed B03 parts inventory rejected for a whole-vehicle hunt", () => {
    const title = "بدنه کاپوت گلگیر سپر چراغ قیمت عمده";
    const description = "پخش قطعات بدنه محصولات سایپا و ایران خودرو کاپوت پراید گلگیر پراید";
    expect(shadowAdKindForTitle(title)).toBe("vehicle-part");
    expect(kindGateRejects("vehicle", shadowAdKindForTitle(title))?.tier).toBe("reject");
    expect(shadowSpecificSubjectVerdict("پراید", title, description)).not.toBe("allow");
  });

  it("rejects a different principal part when the hunted part appears only in description", () => {
    // Synthetic counter-risk only; not a source ad and not a human grade.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "دیسک ترمز پراید سالم",
        "دیسک ترمز پراید سالم؛ کاتالیزور فابریک خودرو نیز موجود است"
      )
    ).toBe("reject");
  });

  it("rejects C02 when exhaust service/sale leads and catalyst is a separate purchase role", () => {
    const title = "تعمیر وفروش اگزوز خرید کاتالیزور";
    const description =
      "فروش و تعمیر اگزوز با بهترین کیفیت؛ خرید کاتالیزور؛ اگزوز ن خرید دارم ن معاوضه فقط فروش";
    expect(shadowSpecificSubjectVerdict("کاتالیزور", title, description)).toBe("reject");
  });

  it("preserves a direct converter offer when catalyst dust is mentioned secondarily", () => {
    // Synthetic co-occurrence counterexample: a genuine converter offer appears
    // first; the later dust phrase must not trigger the subtype rejection.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "فروش کاتالیزور خودرو و خاک کاتالیزور",
        "کاتالیزور خودرو موجود است؛ خاک کاتالیزور نیز خریداری می‌شود"
      )
    ).toBe("allow");
  });

  it("allows a specific-part title only when title-level text explicitly co-offers both parts", () => {
    // Synthetic positive control for the rule's intended boundary, not a graded ad.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "فروش دیسک ترمز و کاتالیزور پراید",
        "هر دو قطعه موجود است"
      )
    ).toBe("allow");
  });

  it("records the conservative false-reject risk for comma-separated item inventories", () => {
    // Synthetic boundary case, not a source ad or human grade. A title can
    // plausibly enumerate two offered items with punctuation rather than «و».
    // Current prototype intentionally does not infer co-offer from punctuation,
    // so this stays rejected until source-backed evidence justifies broadening.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "فروش دیسک ترمز، کاتالیزور پراید",
        "هر دو قطعه موجود است"
      )
    ).toBe("reject");
  });

  it("does not mistake an unrelated conjunction elsewhere in the title for a part co-offer", () => {
    // Synthetic adversarial case: "و" connects service wording, not the two parts.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "فروش و خدمات دیسک ترمز، کاتالیزور در صورت نیاز",
        "اطلاعات بیشتر تماس بگیرید"
      )
    ).toBe("reject");
  });

  it("does not count an overlapping short/long marker as two co-offered parts", () => {
    // Synthetic adversarial case: "دیسک" is contained in "دیسک ترمز".
    expect(
      shadowSpecificSubjectVerdict(
        "دیسک",
        "فروش دیسک ترمز و کاتالیزور",
        "فروش قطعات خودرو"
      )
    ).toBe("reject");
  });

  it("does not mistake a service/repair title for an explicit product co-offer", () => {
    // Synthetic adversarial case: the conjunction joins objects of a service,
    // not products explicitly offered for sale. This is not a source ad/grade.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "تعویض دیسک ترمز و کاتالیزور فرسوده",
        "خدمات تعمیر و تعویض قطعات خودرو"
      )
    ).toBe("reject");
  });

  it("allows a clear available-items co-offer even without the word فروش", () => {
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "دیسک ترمز و کاتالیزور موجود",
        "هر دو قطعه موجود است"
      )
    ).toBe("allow");
  });

  it("does not let a generic فروش cue override explicit service intent", () => {
    // Synthetic adversarial case: "فروش" refers to the service package, not
    // necessarily sale of the two parts as products.
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "فروش خدمات تعویض دیسک ترمز و کاتالیزور",
        "خدمات تعویض قطعات خودرو"
      )
    ).toBe("reject");
  });

  it("leaves an unknown principal subject as unknown rather than hard-rejecting", () => {
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        "خدمات خودرو با قیمت مناسب",
        "کاتالیزور در توضیحات ذکر شده"
      )
    ).toBe("unknown");
  });
});


describe("Issue 16 — Capture 06C shadow subject-policy replay (test-only)", () => {
  it("compares the candidate subject policy against all five locked human grades", () => {
    // Exact source text is pinned in the immutable Capture 06C blind packet
    // and mapped only after grade lock in ISSUE16-CAPTURE-06C-SOURCE-MAP.md.
    // These are diagnostic policy outputs, not production verdicts.
    const rows: Array<{
      code: string;
      title: string;
      description: string;
      humanGrade: 1 | 3;
      expectedShadow: "allow" | "reject" | "unknown";
    }> = [
      {
        code: "C01",
        title: "خرید وفروش خاک کاتالیزور خودرو ودیزل وپتروشیمی",
        description: "خرید وفروش خاک کاتالیزور خودرو ودیزل وپتروشیمی با بالاترین قیمت درایران توسط مهندس محمدی در محل شما",
        humanGrade: 1,
        expectedShadow: "reject",
      },
      {
        code: "C02",
        title: "تعمیر وفروش اگزوز خرید کاتالیزور",
        description: "با سلام خدمت دوستان عزیز فروش و تعمیر اگزوز با بهترین کیفیت و کمترین زمان ممکن فروش انواع اگزوزهای بلوچی و معمولی و دست ساز و فابریک برای ماشین‌های پراید پژو نیسان پیکان و غیر با یکبار تجربه مشتری همیشگی ما باشید 100 % لطفا از ساعت 8 شب ب بعد دیگ تماس نگیرید معاوضه اگزوز نداریم پس سوال الکی نپرسید ممنون جوشکاری شاسی ماشین هم پذیرفته میشود خرید کاتالیزور 99 %تعمیر 1 %تعویض آدرس نگین شهر روبروی چهارراه مدرسه اتوبان آزادشهر به گنبد برجاده اصلی اگزوزسازی بهروز بامدی ساعت کاری8 تا7 حتی روز های تعطیل اگزوز ن خرید دارم ن معاوضه فقط فروش",
        humanGrade: 1,
        expectedShadow: "reject",
      },
      {
        code: "C03",
        title: "فروش وخریدانواع کاتالیزور و خاک۲۰۶ پژو ال۹۰ نیسان",
        description: "خرید در محل انواع کاتالیزور های ایرانی نو کاتالیزور استوک و زیر صفری ب شرط انواع منبع جایگزین بدون تعطیلی در سراسر تهران",
        humanGrade: 3,
        expectedShadow: "allow",
      },
      {
        code: "C04",
        title: "جایگزین کاتالیزور xu7 پژو پارس و ۴۰۵و اگزوز بلوچی",
        description: "یدونه جایگزین کاتالیزور یورو چهار کلا یک هفته رو ماشین بود کاملا نو ب مبلغ ۱,۶۵۰۰ اگزوز منبع بلوجی شرکتی ورق ضخیم مارک لیزر با صدای ریزوعالی نوعه نو ب مبلغ ۲,۳۰۰",
        humanGrade: 3,
        expectedShadow: "allow",
      },
      {
        code: "C05",
        title: "اگزوز (بیات)تیبا.کوییک پژو سمند مارک مشهد",
        description: "با سلام خدمات رایگان ما تست وبازدید ..دیاگ..تست کاتالیزور..جوشکاری و وصل اگزوز..بازدید چشمی از سراسر اگزوز ..تست شمع وایر کویل سنسور اکسیژن کمپرس متور خام سوزی تمام این خدمات رایگان میباشد لیست قیمت ها نصب اگزوز کاملا رایگان است اگزوز عقب پراید۱۹۰۰ رضا مشهد اگزوز تیبا مشهد ۲۹۰۰ اگزوز پژو 2900 رضا مشهد اگزوز تیبا2.کوییک ۳۳۰۰ رضا مشهد اگزوز بلوچی پراید۲۱۰۰ اگزوز سورن توربویی۳۵۰۰ اگزوز سمند ساینا سورن و......موجود میباشد با مدیریت استاد بیات (همدانی) چهار راه سیلو به سمت رشیدی روبه رویه استخر خلیج فارس",
        humanGrade: 1,
        expectedShadow: "reject",
      },
    ];

    for (const row of rows) {
      expect(
        shadowSpecificSubjectVerdict("کاتالیزور", row.title, row.description),
        row.code
      ).toBe(row.expectedShadow);
    }

    // C01 is a source-backed subtype distinction («خاک کاتالیزور» vs the
    // hunted converter). The new guard is still test-local and based on one
    // graded item, so it must not be promoted into production yet.
    expect(rows.find((row) => row.code === "C01")?.humanGrade).toBe(1);
    expect(
      shadowSpecificSubjectVerdict(
        "کاتالیزور",
        rows[0].title,
        rows[0].description
      )
    ).toBe("reject");
  });
});
