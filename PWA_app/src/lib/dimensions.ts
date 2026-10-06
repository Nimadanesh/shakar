/**
 * dimensions.ts — the required-dimensions engine.
 *
 * Some searches are undecidable without one critical answer, and guessing
 * on a paid hunt wastes quota. Each dimension in the registry declares:
 * which categories it is required for, how to detect its answer already
 * given in the user's own words, and its one-tap options.
 *
 * Rules (product-level, do not weaken without navid):
 * 1. Text always wins: if ANY input («چی؟», «باید», «نباید») already states
 *    the answer («خرید خونه»), the dimension is answered — never ask again.
 * 2. At most ONE blocking dimension per hunt. A form that interrogates is
 *    a form abandoned; one conscious tap is the budget.
 * 3. A neutral option («فرقی نداره») is a real answer the engine respects
 *    (no filter), never a dark pattern to force a pick. Binary dimensions
 *    (rent/buy) have no neutral — both would double the search cost.
 * 4. When the category is unknown (no picker pick, no text hint), the
 *    engine stays silent. Never guess the category to ask a question.
 */

import {
  detectCategoryFromText,
  detectCondition,
  detectTransaction,
} from "@/lib/interpret";

export type DimensionId = "transaction" | "condition";

export interface DimensionOption {
  value: string;
  label: string;
}

export interface DimensionDef {
  id: DimensionId;
  /** «نوع معامله» */
  label: string;
  /** One-line helper under the label. */
  hint: string;
  options: DimensionOption[];
  /**
   * e.g. «فرقی نداره». Absent for binary dimensions where "both" would
   * double the search cost.
   */
  neutral?: DimensionOption;
  /** Answer already present in free text (any input), or null. */
  detectInText: (text: string) => string | null;
  /** Effective-category ids this dimension is required for. */
  categories: string[];
}

const transactionDef: DimensionDef = {
  id: "transaction",
  label: "نوع معامله",
  hint: "این ملک برای اجاره‌ست یا خرید؟ بدون این، شکار دقیق نمی‌شه.",
  options: [
    { value: "rent", label: "اجاره" },
    { value: "buy", label: "خرید" },
  ],
  detectInText: (text) => detectTransaction(text),
  categories: ["real-estate"],
};

const conditionDef: DimensionDef = {
  id: "condition",
  label: "نو یا کارکرده؟",
  hint: "برای خروجی دقیق‌تر، وضعیتش رو مشخص کن.",
  options: [
    { value: "new", label: "نو" },
    { value: "used", label: "کارکرده" },
  ],
  neutral: { value: "any", label: "فرقی نداره" },
  detectInText: (text) => detectCondition(text),
  categories: ["vehicles", "mobile", "home", "music", "personal"],
};

export const DIMENSION_DEFS: DimensionDef[] = [transactionDef, conditionDef];

export interface DimensionQuery {
  query: string;
  include: string[];
  exclude: string[];
  /** Explicit category picker value ("all" = untouched). */
  category: string;
  /** Current chip selections, "" = unresolved. */
  values: Record<DimensionId, string>;
}

export interface DimensionStatus {
  def: DimensionDef;
  /** Chip selection ("" = unresolved). Stays visible after picking so the
   *  user can change their mind without editing the text. */
  value: string;
}

/**
 * Dimensions that apply to this hunt and were NOT already answered in the
 * user's own words. Text is checked across «چی؟» + «باید» + «نباید»: if the
 * user wrote «خرید خونه» anywhere, we never ask again.
 *
 * Effective category: the explicit picker wins; otherwise the text's
 * category hint decides. Unknown category → no dimensions (rule 4).
 */
export function getDimensionStatuses(q: DimensionQuery): DimensionStatus[] {
  const text = [q.query, ...q.include, ...q.exclude].join(" ").trim();
  if (text === "") return [];
  const effectiveCategory =
    q.category !== "all" ? q.category : (detectCategoryFromText(text) ?? "all");
  return DIMENSION_DEFS.filter((def) => def.categories.includes(effectiveCategory))
    .filter((def) => def.detectInText(text) === null)
    .map((def) => ({ def, value: q.values[def.id] ?? "" }));
}

/** The hunt may not fire while any visible dimension is unresolved. */
export function isDimensionsBlocking(statuses: DimensionStatus[]): boolean {
  return statuses.some((s) => s.value === "");
}
