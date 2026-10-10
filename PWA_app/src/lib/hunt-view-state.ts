import type { HuntEvent, ScoredAd } from "@/lib/server/hunt/pipeline";

/**
 * View state for the hunt waiting experience.
 *
 * Core UX invariant: real result cards are NEVER shown while the run is
 * active. `details-batch` events advance honest progress (`checked/total`)
 * only — the visible `results` list is replaced exactly once from the
 * terminal `done` event, in the server's final order.
 */
export interface HuntViewState {
  results: ScoredAd[];
  done: boolean;
  /** Ads discovered during list collection (honest count, not reviewed). */
  discovered: number;
  /** Selected candidates whose details are being checked. */
  shortlisted: number;
  /** Detail-review progress from the real `details-batch` event. */
  checked: number;
  total: number;
}

export function createHuntViewState(cached: { results: ScoredAd[] } | null): HuntViewState {
  return {
    results: cached ? [...cached.results] : [],
    done: cached !== null,
    discovered: 0,
    shortlisted: 0,
    checked: 0,
    total: 0,
  };
}

/**
 * Fold one pipeline event into view state. Pure and idempotent:
 * - `details-batch` never appends `confirmed` cards (progress only).
 * - `done` replaces the list wholesale in server order (repeat-safe).
 */
export function applyHuntViewEvent(state: HuntViewState, event: HuntEvent): HuntViewState {
  switch (event.type) {
    case "lists-progress":
      return { ...state, discovered: event.adsSeen };
    case "lists-done":
      return { ...state, discovered: event.adsSeen };
    case "ranked":
      return { ...state, discovered: event.scored, shortlisted: event.shortlisted };
    case "candidates":
      return { ...state, shortlisted: event.count };
    case "details-batch":
      return { ...state, checked: event.checked, total: event.total };
    case "done":
      return { ...state, results: [...event.results], done: true };
    default:
      return state;
  }
}

export type MatchLabel = "بررسی ناقص" | "تطابق متنی کامل" | "تطابق متنی نسبی";

/**
 * Honest result-status label from verified result fields. Never implies
 * authenticity, seller intent, or product-vs-service proof.
 */
export function matchLabel(ad: Pick<ScoredAd, "detailUnknown" | "matchKind">): MatchLabel {
  if (ad.detailUnknown === true) return "بررسی ناقص";
  if (ad.matchKind === "exact") return "تطابق متنی کامل";
  return "تطابق متنی نسبی";
}
