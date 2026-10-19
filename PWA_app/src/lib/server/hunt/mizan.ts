/**
 * Mizan adjudication — the decision-model judge for uncertain ads.
 *
 * The deterministic engine decides fast on clear cases. When it produces
 * a "near" verdict (uncertain), Mizan adjudicates BEFORE the expensive
 * detail fetch:
 *   - Choice: "What is this ad?" → wrong-item → REJECT (skip getDetail)
 *   - Noul: "Does this violate the hunt's constraint?" → violates → REJECT
 *   - Low confidence → deterministic stands (current behavior)
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
 * Adjudicate an uncertain ad title.
 * @param title ad title (Persian)
 * @param huntKind kind of the hunt (e.g. "vehicle", from queryKindForDef)
 * @param constraintFa Persian description of the hunt's constraint, if any
 *        (e.g. "ماشین نباید تصادف کرده باشد"). Null = no Noul question.
 */
export async function adjudicateTitle(
  title: string,
  huntKind: string,
  constraintFa: string | null
): Promise<MizanJudgment> {
  const nope: MizanJudgment = {
    itemKind: null,
    itemConfidence: 0,
    violates: null,
    violateProbability: 0,
    actionable: false,
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
    questions["violates"] = {
      type: "noul",
      instructions: `شکار: «${constraintFa}». آیا این آگهی نشان می‌دهد که قید شکار نقض شده است؟`,
    };
  }

  const res = await callMizan(title, questions);
  if (!res) return nope;

  const itemAns = res.answers["item_kind"];
  const itemKind = toItemKind(
    itemAns && "choice" in itemAns ? itemAns.choice ?? itemAns.value : undefined
  );
  const itemConfidence =
    itemAns && "confidence" in itemAns ? itemAns.confidence ?? 0 : 0;

  let violates: boolean | null = null;
  let violateProbability = 0;
  if (constraintFa) {
    const vAns = res.answers["violates"];
    if (vAns && "noul" in vAns) {
      violateProbability = vAns.noul ?? vAns.probability ?? 0;
      violates = violateProbability >= 0.5;
    }
  }

  // Actionable only on high confidence (pilot: all errors were < 0.6)
  const actionable =
    itemConfidence >= MIZAN_ACT_THRESHOLD ||
    violateProbability >= MIZAN_ACT_THRESHOLD;

  return { itemKind, itemConfidence, violates, violateProbability, actionable };
}

/**
 * Should this "near" ad be rejected based on Mizan's judgment?
 * Wrong-item (part/accessory/derived/service when hunting whole) → reject.
 * Constraint violation → reject.
 */
export function mizanSaysReject(
  judgment: MizanJudgment,
  huntingWhole: boolean
): { reject: boolean; reason: string | null } {
  if (!judgment.actionable) return { reject: false, reason: null };
  if (
    huntingWhole &&
    judgment.itemKind &&
    ["part", "accessory", "derived", "service"].includes(judgment.itemKind) &&
    judgment.itemConfidence >= MIZAN_ACT_THRESHOLD
  ) {
    return {
      reject: true,
      reason: `mizan:wrong-item:${judgment.itemKind}`,
    };
  }
  if (
    judgment.violates === true &&
    judgment.violateProbability >= MIZAN_ACT_THRESHOLD
  ) {
    return { reject: true, reason: "mizan:constraint-violated" };
  }
  return { reject: false, reason: null };
}
