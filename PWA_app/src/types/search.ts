// Canonical Search Workspace types.
// The SearchContext is the single source of truth shared by query input,
// interpretation, precision controls, summary, results, and (later) Radar.

export interface SearchContext {
  query: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  category: string;
  city: string;
  priceMin: number | null;
  priceMax: number | null;
  hasImage: boolean;
}

export const EMPTY_SEARCH_CONTEXT: SearchContext = {
  query: "",
  includeKeywords: [],
  excludeKeywords: [],
  category: "all",
  city: "all",
  priceMin: null,
  priceMax: null,
  hasImage: false,
};

export type ConstraintKind =
  | "include"
  | "exclude"
  | "city"
  | "priceMin"
  | "priceMax"
  | "category"
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
  applied: InterpretedConstraint[];
  preferences: InterpretedConstraint[];
}

export type EvidenceStatus = "detected" | "unknown";

export interface AdEvidence {
  term: string;
  status: EvidenceStatus;
}

export interface MatchReason {
  tone: "signal" | "warning";
  text: string;
}

export interface MatchResult {
  adId: string;
  reasons: MatchReason[];
  evidence: AdEvidence[];
  /** True only when every requirement resolved against real signals. */
  strongMatch: boolean;
}

export interface SuppressedAd {
  adId: string;
  reason: string;
}

export interface SearchOutcome {
  results: MatchResult[];
  suppressed: SuppressedAd[];
}
