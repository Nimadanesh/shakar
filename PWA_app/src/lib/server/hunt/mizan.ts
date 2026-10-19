/**
 * Mizan adjudication — the decision-model judge for uncertain ads.
 *
 * Design v2 (after DeepSeek red-team 2026-10-19):
 * - Hook at B: inside confirmCandidates, AFTER evaluateDescription (post-detail).
 *   Title-phase hooking would reintroduce flaw #12 (pipeline law).
 * - Choice (item-kind) is ADVISORY ONLY — it may influence ranking, never membership.
 *   Choice answers item-kind; the battery grades hunt-fit (different label spaces).
 * - Noul (violation) is the SOLE rejection channel, and only with corroboration:
 *   deterministic conflicting signal + conf >= 0.80.
 * - Shadow mode first: judge, log, apply nothing.
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
const MIZAN_IGNORE_THRESHOLD = 0.6;

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
      whole: "یک خودروی کامل و سالم برای فروش",
      part: "قطعه یا جزء خودرو، مثل کفی، دینام، باطری، لنت",
      accessory: "لوازم جانبی خودرو که ضروری نیست، مثل چادر، سیستم صوتی",
      other: "هر چیز دیگری",
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

/** Map Mizan's choice label to our ItemKind. */
function toItemKind(label: string | undefined): ItemKind | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes("whole") || l.includes("complete")) return "whole";
  if (l.includes("part")) return "part";
  if (l.includes("accessor")) return "accessory";
  if (l.includes("derived")) return "derived";
  if (l.includes("service")) return "service";
  return "other";
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
 * @deprecated Use adjudicateAd (design v2). Kept for backward compat.
 */
export async function adjudicateTitle(
  title: string,
  huntKind: string,
  constraintFa: string | null
): Promise<MizanJudgment> {
  return adjudicateAd(title, "", huntKind, constraintFa);
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
