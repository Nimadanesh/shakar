/**
 * Tester-facing questionnaire copy (Persian, non-technical).
 * Pure module shared by the evaluation UI and its tests: grades, outcome
 * questions, and consent text live here so tests can assert the exact
 * contracted labels without rendering React components.
 */

export type TesterGrade = 3 | 2 | 1 | 0 | "insufficient";

export const GRADE_OPTIONS: ReadonlyArray<{ value: TesterGrade; fa: string }> = [
  { value: 3, fa: "۳ — دقیقاً همان چیزی که می‌خواستم" },
  { value: 2, fa: "۲ — مرتبط و به کار می‌آید" },
  { value: 1, fa: "۱ — ارتباط ضعیف" },
  { value: 0, fa: "۰ — نامرتبط" },
  { value: "insufficient", fa: "متن برای قضاوت کافی نیست" },
];

export const OUTCOME_FOUND: ReadonlyArray<{ value: string; fa: string }> = [
  { value: "yes", fa: "بله" },
  { value: "partially", fa: "نسبتاً" },
  { value: "no", fa: "نه" },
];

export const OUTCOME_EASE: ReadonlyArray<{ value: string; fa: string }> = [
  { value: "easy", fa: "راحت" },
  { value: "ok", fa: "معمولی" },
  { value: "hard", fa: "سخت" },
];

/** Words that must never appear in tester-facing copy. */
export const FORBIDDEN_TESTER_WORDS = [
  "semantic cap",
  "verdict",
  "MUST-missing",
  "titleStrength",
  "shortlist",
] as const;

export function copyIsTesterSafe(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_TESTER_WORDS.some((w) => lower.includes(w.toLowerCase()));
}
