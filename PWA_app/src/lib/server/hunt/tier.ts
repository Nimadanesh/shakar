/**
 * HANDOFF-T (2026-11-02) — tier field, label only.
 *
 * Pure function: maps an already-decided verdict + its reason codes to a
 * tier. It never changes a verdict, a filter, a score, or an order — the
 * pipeline calls it only after the verdict is final, and only to label
 * the result (ScoredAd.tier / tierReasons) and the internal trace.
 *
 * Tier rule (owner's handoff):
 * - 1: verdict exact.
 * - 2: verdict near and EVERY reason is soft: a sibling-variant
 *   (listing-adds / sibling-variant) or a missing should.
 * - 3: verdict near with ANY other reason — including partial-evidence,
 *   style-prefix, bait, demand-goods, kind demote, semantic cap
 *   (incl. role-clash), detail-unknown, no-must-terms, and every
 *   unknown reason. A reason not in the tier-2 list is always tier 3.
 * - 4: any rejection. The rejection reason is kept verbatim.
 *
 * Precedence inside the soft check matters: a style-prefix reason
 * ("sibling-variant:style-prefix:…") contains "sibling-variant" but is
 * tier 3 by the rule above, so style-prefix is checked before the
 * sibling-variant substring.
 *
 * Hidden statuses are NOT tiers and are not produced here: the pipeline
 * records "hidden:dupe" (merged in collapseDupes) and
 * "hidden:detail-cap" (outside the detail-phase candidate cap) directly
 * in the trace, with no tier number.
 */

export type AdTier = 1 | 2 | 3 | 4;

export type ShownVerdict = "exact" | "near";

export interface TierAssignment {
  tier: AdTier;
  reasons: string[];
}

/**
 * Explicit tier-3 reasons (HANDOFF-K, 2026-11-02): a near verdict with
 * one of these is tier 3, never tier 2. transaction:mixed (a title with
 * both rent and sell words in a buy hunt) caps at tier 3 — it is not
 * soft, so it already fell through to tier 3; this names it explicitly
 * so the tier-3 list is checkable, not implicit.
 */
export const TIER3_REASONS = new Set(["transaction:mixed"]);

/** A reason is soft only if it is exactly a tier-2 reason. */
export function tierReasonIsSoft(reason: string): boolean {
  if (TIER3_REASONS.has(reason)) return false;
  if (reason === "missing-should") return true;
  // style-prefix first: it contains "sibling-variant" but is tier 3.
  if (reason.includes("style-prefix")) return false;
  // Sibling-variant only: a listing-adds of another kind (part, vehicle,
  // …) is not a sibling variant and stays tier 3.
  if (reason === "sibling-variant") return true;
  if (reason.startsWith("sibling-variant:listing-adds:")) return true;
  return false;
}

export function tierForVerdict(
  verdict: ShownVerdict | "rejected",
  reasons: readonly string[]
): TierAssignment {
  const kept = [...reasons];
  if (verdict === "exact") return { tier: 1, reasons: kept };
  if (verdict === "rejected") return { tier: 4, reasons: kept };
  // verdict "near": tier 2 only when there is at least one reason and
  // every reason is soft. Empty reasons are unknown, hence tier 3.
  const allSoft = kept.length > 0 && kept.every(tierReasonIsSoft);
  return { tier: allSoft ? 2 : 3, reasons: kept };
}
