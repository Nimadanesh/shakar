// Canonical Search Workspace types.
// The SearchContext is the single source of truth shared by query input,
// interpretation, precision controls, summary, results, and (later) Radar.

export interface SearchContext {
  query: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  category: string;
  city: string;
  /**
   * How the (M3) backend must treat `city`. Computed from the category, not
   * stored — the mapping lives in one place (buildEffectiveContext).
   * - "hard": location-bound category (real estate, vehicles). The city is a
   *   filter; out-of-city results are excluded.
   * - "soft": shippable / remote-friendly. The city is a ranking boost only —
   *   out-of-city results stay, ranked lower. Never silently dropped, or the
   *   best ad in Karaj dies for a Tehrani user.
   * - null: city is "all" — no geo signal at all.
   */
  cityScope: "hard" | "soft" | null;
  priceMin: number | null;
  priceMax: number | null;
  hasImage: boolean;
  /** Real-estate transaction type. "" = unknown / not applicable. */
  transaction: "" | "rent" | "buy";
}

export const EMPTY_SEARCH_CONTEXT: SearchContext = {
  query: "",
  includeKeywords: [],
  excludeKeywords: [],
  category: "all",
  city: "all",
  cityScope: null,
  priceMin: null,
  priceMax: null,
  hasImage: false,
  transaction: "",
};

export type ConstraintKind =
  | "include"
  | "exclude"
  | "city"
  | "priceMin"
  | "priceMax"
  | "category"
  | "transaction"
  | "preference";

export interface InterpretedConstraint {
  id: string;
  kind: ConstraintKind;
  /** Normalized machine value (term text or numeric string). */
  value: string;
  /** Persian display text. */
  display: string;
  source: "explicit" | "inferred";
  /** False for display-only notes (preferences) that never filter. */
  applied: boolean;
}

export interface Interpretation {
  /** Interpretation engine version that produced this reading. A Hunt pins
   *  this version: an old hunt must never be re-read by a newer engine. */
  version: "v1";
  applied: InterpretedConstraint[];
  preferences: InterpretedConstraint[];
}

/**
 * Backend search contract (frozen 2026-10-06, pre-backend stage).
 *
 * Four distinct semantic roles — the backend must preserve this split,
 * never collapse them into one bag of keywords:
 *
 * - Query: the user's raw need. Feeds interpretation + provider query
 *   construction. NOT a mandatory filter by itself.
 * - Include: mandatory. Every include term must match (title rules first,
 *   then text). Missing include ⇒ not a result.
 * - Preference: ranking signal only. Never filters. Absence is reported as
 *   ؟ (unknown) evidence, never as a miss.
 * - Exclude: hard negative. Any hit suppresses the ad with a factual reason.
 *
 * Local note: runSearch's queryTerms `some()` gate is a retrieval stand-in
 * for the provider (fixtures today, Divar later) — it approximates "the
 * provider returned this ad for the query". The backend implements the
 * roles above instead of porting the gate.
 */
export type QueryRole = "query" | "include" | "preference" | "exclude";

export type EvidenceStatus = "detected" | "unknown";

export interface AdEvidence {
  term: string;
  status: EvidenceStatus;
}

export interface MatchReason {
  tone: "signal" | "warning";
  text: string;
}

/**
 * Price verifiability of one ad against the ACTIVE price filter.
 * - known: the ad carries a price and it was checked against the filter
 *   (or no price filter was active, so there is nothing to be unknown about).
 * - unknown: a price filter is active but the ad has no price — the
 *   constraint could not be verified. Unknown ≠ false: the ad is NOT
 *   rejected, but it must be visibly marked (warning tone) and must never
 *   receive the «قیمت در محدوده» signal.
 */
export type PriceState = "known" | "unknown";

export type ScoreConfidence = "high" | "medium" | "low";

/** Backend-internal score signals. UI surfaces only the appropriate parts. */
export interface ScoreSignals {
  queryMatch: number;
  includeMatch: number;
  excludeClean: number;
  priceMatch: number;
  freshness: number;
}

/**
 * Backend-internal score breakdown. The local matcher does not compute
 * scores — the backend fills this. UI must never render `score` as a bare
 * magic number; surface signals/confidence, never "87" and done.
 */
export interface ScoreBreakdown {
  score: number;
  confidence: ScoreConfidence;
  signals: ScoreSignals;
}

export interface MatchResult {
  adId: string;
  reasons: MatchReason[];
  evidence: AdEvidence[];
  /** True only when every requirement resolved against real signals. */
  strongMatch: boolean;
  priceState: PriceState;
  /** Backend-reserved. Absent until the backend scoring lands. */
  score?: ScoreBreakdown;
}

export interface SuppressedAd {
  adId: string;
  reason: string;
}

export interface SearchOutcome {
  results: MatchResult[];
  suppressed: SuppressedAd[];
}
