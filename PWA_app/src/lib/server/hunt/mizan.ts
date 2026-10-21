/**
 * Mizan adjudication — the decision-model judge for uncertain ads.
 *
 * Decision v2 (2026-10-20) — CURRENT LAW:
 * - Mizan has NO deletion authority. It judges in log-only mode; its
 *   would-be decisions are recorded as features (stats.mizanShadow) for
 *   the learned ranker. Deletion authority returns only per-channel,
 *   through the Decision v2 §3 reinstatement trial (frozen threshold,
 *   >=80 held-out deletions, failure <=5% with Wilson bound).
 * - Historical (R10–R12, now revoked): Choice wrong-kind rejection at
 *   >=0.9 behind the hunt-intent guard + title-evidence shield; Noul
 *   rejection at >=0.80 with deterministic corroboration. Those
 *   predicates still run — they compute the would-be features.
 *
 * Mizan runs locally via llama-server (/v1/systemone, Jev-compatible).
 * If unavailable, all adjudication is skipped — the engine degrades to
 * deterministic-only, never crashes.
 */

const MIZAN_URL =
  process.env.MIZAN_URL ?? "http://localhost:8080/v1/systemone";
const MIZAN_TIMEOUT_MS = Number(process.env.MIZAN_TIMEOUT_MS ?? 30000);
// Confidence thresholds (calibrated on 2026-10-19 pilot: all 3 errors < 0.6)
const MIZAN_ACT_THRESHOLD = 0.8;

export type ItemKind =
  | "whole"
  | "part"
  | "accessory"
  | "derived"
  | "service"
  | "other";

export interface MizanJudgment {
  /** What the ad is (Choice) */
  itemKind: ItemKind | null;
  itemConfidence: number;
  /** Whether it violates the hunt constraint (Noul) */
  violates: boolean | null;
  violateProbability: number;
  /** Should the caller act on this judgment? */
  actionable: boolean;
  /**
   * R9 double-check B1: distinguish "Mizan down/transport failure" from
   * "Mizan had no opinion". When true, the judgment is a transport failure
   * (server down, timeout, bad response) — NOT a model verdict.
   */
  unavailable: boolean;
}

interface SystemOneResponse {
  answers: Record<
    string,
    | { type: "choice"; choice?: string; value?: string; confidence?: number }
    | { type: "noul"; noul?: number; probability?: number }
  >;
}

async function callMizan(
  state: string,
  questions: Record<string, unknown>
): Promise<SystemOneResponse | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), MIZAN_TIMEOUT_MS);
  try {
    const res = await fetch(MIZAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, questions }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as SystemOneResponse;
  } catch {
    return null; // Mizan down → deterministic-only, never crash
  } finally {
    clearTimeout(t);
  }
}

/**
 * Build the Choice categories for a hunt kind.
 * Categories adapt: a vehicle hunt asks whole/part/accessory,
 * a food hunt asks raw/derived, etc.
 */
function choiceCriteriaFor(huntKind: string): Record<string, string> {
  const k = huntKind.toLowerCase();
  if (k.includes("vehicle") || k.includes("car") || k.includes("ماشین")) {
    return {
      whole: "یک خودروی سواری کامل یا یک موتور سیکلت کامل برای فروش (مثل پراید، پژو، هوندا ۱۲۵) — نه ماشین‌آلات راهسازی یا سنگین",
      part: "قطعه یا جزء خودرو، مثل کفی، دینام، باطری، لنت، ایسیو (کامپیوتر خودرو)، گیربکس، کمک فنر",
      accessory: "لوازم جانبی خودرو که ضروری نیست، مثل چادر، سیستم صوتی",
      other: "هر چیز دیگری، از جمله ماشین‌آلات راهسازی (بیل مکانیکی، بلدزر) و خودروهای سنگین",
    };
  }
  if (k.includes("food") || k.includes("بادام") || k.includes("غذا")) {
    return {
      whole: "ماده غذایی خام و فرآوری‌نشده",
      derived: "محصول غذایی فرآوری‌شده، مثل خلال، کره، پودر",
      other: "هر چیز دیگری",
    };
  }
  return {
    whole: "خودِ کالای اصلی که شکار می‌شود، کامل و سالم",
    part: "قطعه یا جزء آن کالا",
    accessory: "لوازم جانبی آن کالا",
    derived: "محصول مشتق‌شده از آن کالا",
    service: "خدمت مرتبط با آن کالا، نه خود کالا",
    other: "هر چیز دیگری",
  };
}

/** Map Mizan's choice label to our ItemKind. STRICT: unrecognized labels
 *  return null, NOT "other" — "other" is a rejection class (R11), so it
 *  must only fire when the model explicitly chose the "other" key.
 *  (DeepSeek double-check R11: the old catch-all promoted any unparsable
 *  or Persian label to "other" at full reported confidence.) */
function toItemKind(label: string | undefined): ItemKind | null {
  if (!label) return null;
  const l = label.trim().toLowerCase();
  if (l === "other") return "other";
  if (l.includes("whole") || l.includes("complete")) return "whole";
  if (l.includes("part")) return "part";
  if (l.includes("accessor")) return "accessory";
  if (l.includes("derived")) return "derived";
  if (l.includes("service")) return "service";
  return null;
}

/**
 * Adjudicate an uncertain ad (design v2: called post-detail at hook B).
 * @param title ad title (Persian)
 * @param description ad description (Persian) — for Noul (title+description)
 * @param huntKind kind of the hunt (e.g. "vehicle", from queryKindForDef)
 * @param constraintFa Persian description of the hunt's constraint, if any
 *        (e.g. "ماشین نباید تصادف کرده باشد"). Null = no Noul question.
 *
 * Returns both judgments:
 * - Choice (itemKind): ADVISORY ONLY — for ranking, never for rejection.
 * - Noul (violates): the rejection channel — requires corroboration by caller.
 */
export async function adjudicateAd(
  title: string,
  description: string,
  huntKind: string,
  constraintFa: string | null
): Promise<MizanJudgment> {
  const nope: MizanJudgment = {
    itemKind: null,
    itemConfidence: 0,
    violates: null,
    violateProbability: 0,
    actionable: false,
    unavailable: true, // transport failure → distinguishable (B1)
  };

  const questions: Record<string, unknown> = {
    item_kind: {
      type: "choice",
      instructions:
        "این آگهی چه چیزی می‌فروشد؟ دسته‌ای که بهترین توصیف برای کالای اصلی آگهی است را انتخاب کن.",
      criteria: choiceCriteriaFor(huntKind),
    },
  };
  if (constraintFa) {
    // Noul gets title+description (design v2: descriptions catch what titles hide).
    // (Description is capped at 800 chars at the call site — see below.)
    questions["violates"] = {
      type: "noul",
      instructions: `شکار: «${constraintFa}». با توجه به عنوان و توضیح آگهی، آیا این آگهی نشان می‌دهد که قید شکار نقض شده است؟`,
    };
  }

  // Choice on title only; Noul on title+description (split-input finding).
  // Description capped at 800 chars: full Divar descriptions can exceed
  // Mizan's 512-token batch (525-token error observed 2026-10-19 laptop run).
  const choiceRes = await callMizan(title, { item_kind: questions["item_kind"] });
  const noulRes = constraintFa
    ? await callMizan(`${title}\n${description.slice(0, 800)}`, { violates: questions["violates"] })
    : null;

  const itemAns = choiceRes?.answers["item_kind"];
  const itemKind = toItemKind(
    itemAns && "choice" in itemAns ? itemAns.choice ?? itemAns.value : undefined
  );
  const itemConfidence =
    itemAns && "confidence" in itemAns ? itemAns.confidence ?? 0 : 0;

  let violates: boolean | null = null;
  let violateProbability = 0;
  if (constraintFa && noulRes) {
    const vAns = noulRes.answers["violates"];
    if (vAns && "noul" in vAns) {
      violateProbability = vAns.noul ?? vAns.probability ?? 0;
      violates = violateProbability >= 0.5;
    }
  }

  // Actionable only on high confidence (pilot: all errors were < 0.6)
  // NOTE (design v2): "actionable" does NOT mean "reject" — Choice is advisory.
  // Only Noul with corroboration may reject (see mizanSaysReject).
  const actionable =
    itemConfidence >= MIZAN_ACT_THRESHOLD ||
    violateProbability >= MIZAN_ACT_THRESHOLD;

  return { itemKind, itemConfidence, violates, violateProbability, actionable, unavailable: false };
}

/**
 * Should this "near" ad be rejected based on Mizan's judgment?
 *
 * Design v2 (F6): Choice NEVER gates membership — it answers item-kind,
 * but the battery grades hunt-fit (different label spaces). The «ماشین تیبا»
 * case (0.90 correct kind, still wrong for hunt) proves this.
 *
 * ONLY Noul (constraint violation) may reject, and ONLY with corroboration:
 * - judgment.violates === true with violateProbability >= 0.80, AND
 * - hasDeterministicConflict === true (caller must provide: kindGateRejects
 *   fired, or a violation cue found in text by deterministic rules)
 *
 * Doubt = keep. The model alone must never remove a candidate.
 */
export function mizanSaysReject(
  judgment: MizanJudgment,
  hasDeterministicConflict: boolean
): { reject: boolean; reason: string | null } {
  if (!judgment.actionable) return { reject: false, reason: null };
  // Choice is advisory only — never rejects (design v2, F6).
  if (
    judgment.violates === true &&
    judgment.violateProbability >= MIZAN_ACT_THRESHOLD &&
    hasDeterministicConflict
  ) {
    return { reject: true, reason: "mizan:constraint-violated" };
  }
  return { reject: false, reason: null };
}

/** Hunt words that name a part/accessory as the hunt's own target
 *  («باطری ماشین» hunts batteries). Reads the HUNT's words, never the ad's. */
const PART_TARGET_WORDS = ["باطری", "باتری", "قاب", "کفی", "لاستیک", "فیلتر"];

/**
 * R12: the ItemKinds that are the hunt's OWN target. A Mizan judgment naming
 * one of these must NEVER reject — the R11 structural bug (33 wrong
 * rejections, 13 from this one hole): "service" judgments killed repair ads
 * on repair hunts («تعمیرکار یخچال»), "derived" judgments killed
 * peanut-butter ads on the «کره بادوم زمینی» hunt itself. The labels were
 * correct; the rejection rule never asked whether the judged kind IS what
 * the hunt is hunting. The old guard protected only part/accessory.
 *
 * Computed structurally from the hunt definition:
 * - service hunts (serviceIntent or kind "service") target "service";
 * - training hunts also protect "service": Mizan's label space has no
 *   "training" — it folds training into service/other, so a training ad on
 *   a training hunt can be judged "service" (deterministic layer already
 *   keeps cross-kind ads out of the queue, so this cannot resurrect them);
 * - derived hunts (kind "*-derived") target "derived";
 * - part hunts (kind "*-part") target "part"; accessory hunts
 *   (kind "*-accessory") target "accessory";
 * - a hunt whose own words name a part/accessory targets part+accessory
 *   (the R10/R11 word check, kept and generalized into the set).
 *
 * "whole" is never a rejection class; "other" is never a hunt target —
 * neither is ever protected.
 */
export function huntTargetKinds(
  huntKind: string,
  serviceIntent: boolean,
  includeTerms: readonly string[]
): ReadonlySet<ItemKind> {
  const targets = new Set<ItemKind>();
  if (serviceIntent || huntKind === "service") targets.add("service");
  if (huntKind === "training") targets.add("service");
  if (huntKind.endsWith("-derived")) targets.add("derived");
  if (huntKind.endsWith("-part")) targets.add("part");
  if (huntKind.endsWith("-accessory")) targets.add("accessory");
  const huntText = includeTerms.join(" ");
  if (PART_TARGET_WORDS.some((w) => huntText.includes(w))) {
    targets.add("part");
    targets.add("accessory");
  }
  return targets;
}

/** Confidence floor for the ACTIVE wrong-kind rejection (R10). Single
 *  source (double-check F5): the pipeline must not fork its own copy. */
export const MIZAN_WRONG_KIND_CONF = 0.9;

/** Kinds that may reject when they are NOT the hunt's target. "whole" is
 *  the hunted item itself — never a rejection class. */
const MIZAN_WRONG_KINDS: ReadonlySet<ItemKind> = new Set([
  "part",
  "accessory",
  "derived",
  "service",
  "other",
]);

/**
 * R12/R12b: may this Choice judgment reject the ad as a wrong item?
 * Pure predicate — the shipping decision, unit-tested directly
 * (double-check F4: the inline pipeline copy had no direct test).
 *
 * Guards (any one blocks rejection):
 * - transport failure (unavailable) or no kind opinion;
 * - confidence below MIZAN_WRONG_KIND_CONF;
 * - the judged kind IS the hunt's own target (huntTargetKinds — R12);
 * - the ad's TITLE itself evidences the hunt (titleEvidencesHunt,
 *   computed by the caller for multi-term hunts): the hunted item named
 *   in full in the title is stronger evidence than a model kind label —
 *   the R11 open-class hole (a «پیانو U3» ad judged "other" on its own
 *   hunt, where the lexicon is blind and targets are empty). Doubt = keep.
 */
export function mizanWrongKindRejects(
  judgment: MizanJudgment,
  targetKinds: ReadonlySet<ItemKind>,
  titleEvidencesHunt: boolean
): boolean {
  if (judgment.unavailable) return false;
  if (!judgment.itemKind || !MIZAN_WRONG_KINDS.has(judgment.itemKind))
    return false;
  if (judgment.itemConfidence < MIZAN_WRONG_KIND_CONF) return false;
  if (targetKinds.has(judgment.itemKind)) return false;
  if (titleEvidencesHunt) return false;
  return true;
}
