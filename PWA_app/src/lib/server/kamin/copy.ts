/**
 * M5 Web Push copy — LOCKED 2026-10-06.
 *
 * navid chose «شفاف و مستقیم»: the title carries the real new-match count,
 * the body names the kamin. Hand-written templates + real data slots, never
 * LLM (per-hunt dollar cost breaks the locked economics). Anti-brag: the
 * work is shown (the count), never praised.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function faDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** «۳ آگهی تازه» — count is real, from this check run. */
export function kaminPushTitle(newCount: number): string {
  return `${faDigits(newCount)} آگهی تازه`;
}

/** «کمین «پیانو یاماها» — بزن ببین.» */
export function kaminPushBody(kaminName: string): string {
  return `کمین «${kaminName}» — بزن ببین.`;
}
