import "server-only";

/**
 * Phase-2 evaluation platform types (private MVP).
 *
 * Blinding contract: tester-facing payloads carry listing content and the
 * mission only. Reference labels, expected grades, engine verdicts, scores,
 * and shortlist information MUST NOT appear in tester payloads or logs.
 */

export type RelevanceGrade = 3 | 2 | 1 | 0 | "insufficient";

export type ListingRoleTag =
  | "seller"
  | "service"
  | "buyer"
  | "rental"
  | "exchange"
  | "unclear";

export type ConstraintStatus = "satisfied" | "contradicted" | "unknown";

export type EvidenceBasis = "title" | "description" | "both";

export interface ItemJudgment {
  /** Pseudonymous listing id as shown to the tester. */
  listingId: string;
  /** Displayed position (1-based) within the mission result set. */
  position: number;
  grade: RelevanceGrade;
  reason?: string;
  ambiguous?: boolean;
  evidenceBasis?: EvidenceBasis | null;
  roles?: ListingRoleTag[];
}

export interface MissionOutcome {
  foundWhatWasAsked?: "yes" | "partially" | "no" | null;
  missingUseful?: "yes" | "no" | null;
  irrelevantInTheWay?: "yes" | "no" | null;
  ease?: "easy" | "ok" | "hard" | null;
  note?: string;
}

export interface MissionDefinition {
  /** Stable id, e.g. "m-iphone13pro". Never reused for a different query. */
  id: string;
  version: number;
  enabled: boolean;
  /** Exact query/instructions shown to the tester. */
  query: string;
  /** Plain-language task description (Persian, non-technical). */
  taskFa: string;
  /** Max listings shown per mission run (evaluation limit, documented). */
  maxItems: number;
  /** Replay snapshot id, or null when the mission runs the live engine. */
  resultSetId: string | null;
  /** True only when an operator verified live execution for this mission. */
  liveAllowed: boolean;
}

export interface ResultSetRecord {
  listingId: string;
  title: string;
  description: string;
  price: number | null;
  city: string;
  district: string;
}

export interface ResultSet {
  id: string;
  version: number;
  createdAt: string;
  /** Query the snapshot was captured for (provenance, not a label). */
  query: string;
  records: ResultSetRecord[];
}

export interface Invitation {
  /** sha256 hex of the opaque code (the code itself is never stored). */
  id: string;
  cohort: string;
  missionIds: string[];
  missionSetVersion: number;
  maxUses: number;
  uses: number;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

export interface EvalSession {
  id: string;
  participantId: string;
  invitationId: string;
  cohort: string;
  missionIds: string[];
  missionSetVersion: number;
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface MissionRun {
  id: string;
  sessionId: string;
  missionId: string;
  missionSetVersion: number;
  /** Engine/build that produced the shown results. */
  engineBuildId: string;
  /** "replay" or "live" — always recorded, always shown honestly. */
  mode: "replay" | "live";
  resultSetId: string | null;
  /** Pseudonymous ids in displayed order. */
  listingOrder: string[];
  startedAt: string;
}

export interface MissionResponse {
  id: string;
  sessionId: string;
  missionId: string;
  missionSetVersion: number;
  runId: string;
  items: ItemJudgment[];
  outcome: MissionOutcome;
  status: "draft" | "submitted";
  submittedAt: string | null;
  /** Auditable correction history (explicit resubmits only). */
  revisions: Array<{ at: string; note?: string }>;
  createdAt: string;
  updatedAt: string;
}

/** Keys that must never reach tester-facing payloads or logs. */
export const FORBIDDEN_TESTER_KEYS = [
  "expectedGrade",
  "expectedLabel",
  "verdict",
  "matchKind",
  "score",
  "titleStrength",
  "missingInfo",
  "evidence_internal",
] as const;
