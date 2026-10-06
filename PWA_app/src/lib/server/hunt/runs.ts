import "server-only";

import type { HuntDefinition, HuntEvent } from "./pipeline";
import type { QuotaKind, QuotaMode } from "../quota";

/**
 * In-memory hunt runs (M4a). POST /api/hunts creates the run and returns
 * the id immediately; GET /api/hunts/[id]/stream runs the pipeline.
 * Runs expire after 30 min. M4b persists runs to the Supabase hunts table.
 */
export interface QuotaReceipt {
  kind: QuotaKind;
  mode: QuotaMode;
  userId: string | null;
  deviceId: string;
  /**
   * False for the deep-history second phase: it's the SAME hunt continued,
   * no extra unit consumed — and therefore no refund on zero results.
   */
  charged: boolean;
}

/**
 * Run lifecycle (findings #3/#4, bug-bounty 2026-10-06):
 * created → running → done|failed. Exactly ONE execution per run — a second
 * GET on the stream attaches to the live broadcast (or replays the log),
 * never re-runs the pipeline or re-triggers the refund.
 */
export type RunStatus = "created" | "running" | "done" | "failed";

export interface HuntRun {
  id: string;
  def: HuntDefinition;
  createdAt: number;
  userId: string | null;
  quota: QuotaReceipt;
  /**
   * Set when the run was fired from a kamin («دیدن نتایج»). On successful
   * completion the stream route advances the kamin's seen baseline —
   * baseline moves only after the hunt is persisted, never on failure.
   */
  kaminId?: string;
  status: RunStatus;
  /** Every event emitted so far — replayed to late attachers. */
  eventLog: HuntEvent[];
  /** Live SSE subscribers (owner + re-attached clients). */
  listeners: Set<(e: HuntEvent) => void>;
  /** Cursor where the list walk stopped — the deepen phase resumes here. */
  endCursor?: unknown;
  /** Cursor to resume from (set by the deepen route). */
  startCursor?: unknown;
  /** The completion path (kamin baseline + refund) has run exactly once. */
  finalized: boolean;
  /** Resolved when the pipeline finishes, success or failure. */
  donePromise: Promise<void>;
  resolveDone: () => void;
}

const runs = new Map<string, HuntRun>();
const RUN_TTL_MS = 30 * 60 * 1000;

// Idempotency keys (client-generated per «شکار کن» tap): 24h window.
// Double-tap / retry with the same key returns the ORIGINAL run id —
// one tap can never consume two quota units.
const idemKeys = new Map<string, { runId: string; at: number }>();
const IDEM_TTL_MS = 24 * 3600 * 1000;

/**
 * Unguessable run ids (finding #3): guest runs have no session, so the id
 * itself is the capability — crypto.randomUUID, not a timestamp guess.
 */
function makeId(): string {
  return crypto.randomUUID();
}

export function claimIdempotency(key: string): { fresh: true } | { fresh: false; runId: string } {
  const hit = idemKeys.get(key);
  if (hit && Date.now() - hit.at < IDEM_TTL_MS) return { fresh: false, runId: hit.runId };
  return { fresh: true };
}

export function createRun(
  def: HuntDefinition,
  userId: string | null,
  quota: QuotaReceipt,
  idempotencyKey?: string,
  kaminId?: string
): HuntRun {
  // Opportunistic cleanup of expired runs and keys.
  const now = Date.now();
  for (const [id, r] of runs) {
    if (now - r.createdAt > RUN_TTL_MS) runs.delete(id);
  }
  for (const [k, v] of idemKeys) {
    if (now - v.at > IDEM_TTL_MS) idemKeys.delete(k);
  }
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((res) => {
    resolveDone = res;
  });
  const run: HuntRun = {
    id: makeId(),
    def,
    createdAt: now,
    userId,
    quota,
    kaminId,
    status: "created",
    eventLog: [],
    listeners: new Set(),
    finalized: false,
    donePromise,
    resolveDone,
  };
  runs.set(run.id, run);
  if (idempotencyKey) idemKeys.set(idempotencyKey, { runId: run.id, at: now });
  return run;
}

export function getRun(id: string): HuntRun | undefined {
  const run = runs.get(id);
  if (!run) return undefined;
  if (Date.now() - run.createdAt > RUN_TTL_MS) {
    runs.delete(id);
    return undefined;
  }
  return run;
}

/**
 * Atomically claim a run for execution (created → running). Call this
 * SYNCHRONOUSLY in the request handler (no awaits between getRun and this
 * call) — the event loop makes the check-and-set atomic, so two racing
 * GETs can never both become the owner.
 */
export function claimRunForExecution(run: HuntRun): boolean {
  if (run.status !== "created") return false;
  run.status = "running";
  return true;
}

/**
 * Ownership check for the stream/deepen routes (finding #3). Registered
 * users can only open their own runs; guest runs (userId null) are
 * protected by the unguessable UUID id.
 */
export function canOpenRun(run: HuntRun, requesterUserId: string | null): boolean {
  if (run.userId === null) return true;
  return run.userId === requesterUserId;
}
