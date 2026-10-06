/**
 * hunt-copy — helpers for the hunt progress UI (docs/hunt-progress-copy.md).
 * Sentence variants rotate deterministically, seeded by runId: stable
 * within a hunt (re-renders never change the line), varied across hunts.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits → Persian digits. */
export function fa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Deterministic variant picker: hash(runId + stage) % variants.length. */
export function pickVariant(runId: string, stage: string, variants: string[]): string {
  if (variants.length === 0) return "";
  let h = 0;
  const s = `${runId}:${stage}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}
