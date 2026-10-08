import "server-only";

import type { HuntDefinition, HuntEvent } from "./pipeline";
import type { QuotaKind, QuotaMode } from "../quota";
import {
  supabaseConfigured,
  supabaseServer,
  type SupabaseServer,
} from "@/lib/supabase-server";
import { advanceKaminBaseline } from "../kamin/engine";
import { refundHunt } from "../quota";

/**
 * Hunt runs with a persistent backend (finding #9, bug-bounty 2026-10-06).
 *
 * The in-memory Maps could not survive a Railway restart and broke
 * idempotency + SSE across instances. Runs, idempotency keys and the event
 * log now live in Supabase (supabase/m10-hunt-runs.sql):
 *  - claimIdempotency: atomic INSERT wins for exactly one request; losers
 *    poll for the winner's run row (bounded — never infinite).
 *  - Execution/finalization: conditional UPDATEs (WHERE status = ...) so
 *    exactly one instance runs the pipeline and exactly one finalizes.
 *  - SSE: the owner persists every event; other instances replay the event
 *    table in id order and poll for new rows until a terminal state.
 *
 * Fallback: when Supabase is unconfigured OR the m10 tables are missing
 * (migration window — navid applies SQL manually), the original in-memory
 * Maps are used behind the same functions, with a loud warning. Tests run
 * this path (no SUPABASE_URL in the test env).
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
 * created → running → done|failed. Exactly ONE execution per run.
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
  /** Live SSE subscribers (owner + re-attached clients). Memory backend only. */
  listeners: Set<(e: HuntEvent) => void>;
  /** Cursor where the list walk stopped — the deepen phase resumes here. */
  endCursor?: unknown;
  /** Cursor to resume from (set by the deepen route). */
  startCursor?: unknown;
  /**
   * Parent run id when this run is a deep-history second phase
   * (finding #12: one deepen per hunt — the deepened_from unique index
   * makes a second deepen fail atomically).
   */
  deepenedFrom?: string;
  /** The completion path (kamin baseline + refund) has run exactly once. */
  finalized: boolean;
  /** Resolved when the pipeline finishes, success or failure. Memory backend only. */
  donePromise: Promise<void>;
  resolveDone: () => void;
}

// ---------------------------------------------------------------------------
// Backend resolution
// ---------------------------------------------------------------------------

type Backend = { kind: "memory" } | { kind: "db"; sb: SupabaseServer };

let warnedMissing = false;

function warnMissingTables(): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(
    "[runs] in-memory fallback: Supabase unconfigured or m10 hunt_runs tables missing. " +
      "Run PWA_app/supabase/m10-hunt-runs.sql in the Supabase SQL Editor for cross-instance runs."
  );
}

async function tablesExist(sb: SupabaseServer): Promise<boolean> {
  try {
    await sb.rest("GET", "hunt_runs?select=id&limit=0");
    return true;
  } catch {
    return false;
  }
}

// The ?limit=0 probe costs one Supabase round trip per backend() call, and
// backend() sits on every hunt operation (fire, stream events, deepen,
// polls) — ~9-10 serial round trips before POST /api/hunts even returns
// its 202. Cache the answer: a positive answer is stable (tables don't
// disappear), a negative one is re-checked quickly so applying the
// migration heals within seconds instead of pinning to memory until
// the next process restart (the original no-cache concern).
let probeCache: { ok: boolean; at: number } | null = null;
const PROBE_TTL_OK_MS = 5 * 60 * 1000;
const PROBE_TTL_MISS_MS = 15 * 1000;

async function tablesExistCached(sb: SupabaseServer): Promise<boolean> {
  const now = Date.now();
  if (probeCache) {
    const ttl = probeCache.ok ? PROBE_TTL_OK_MS : PROBE_TTL_MISS_MS;
    if (now - probeCache.at < ttl) return probeCache.ok;
  }
  const ok = await tablesExist(sb);
  probeCache = { ok, at: now };
  return ok;
}

async function backend(): Promise<Backend> {
  const sb = supabaseConfigured() ? supabaseServer() : null;
  if (!sb) {
    return { kind: "memory" };
  }
  if (!(await tablesExistCached(sb))) {
    warnMissingTables();
    return { kind: "memory" };
  }
  return { kind: "db", sb };
}

/** Which backend the routes should use (stream/deepen branch on this). */
export async function getBackendKind(): Promise<"db" | "memory"> {
  return (await backend()).kind;
}

// ---------------------------------------------------------------------------
// In-memory backend (fallback; identical to the pre-#9 behavior)
// ---------------------------------------------------------------------------

const runs = new Map<string, HuntRun>();
const RUN_TTL_MS = 30 * 60 * 1000;
/**
 * DB-backed runs live much longer than memory ones. The 30-minute memory
 * TTL exists to bound process memory; persisted runs cost ~100–200KB of
 * Supabase storage each (revenue-proportional, since hunts are
 * quota-limited), so 30 days is generous without unbounded growth.
 * navid 2026-10-08: results must not vanish after minutes — that kills
 * acquisition. 30 days >> his 5–7 day minimum.
 */
const RUN_TTL_MS_DB = 30 * 24 * 60 * 60 * 1000;

/**
 * Execution lease for hunt_runs (finding #7, final round). If the owning
 * instance crashes mid-pipeline, the heartbeat stops and another opener
 * may claim the run after this long instead of waiting forever.
 * 15 min is generous: a hunt's pipeline is bounded (≤20 list pages +
 * ≤100 details, ~1–1.8s throttled each ≈ under 5 min worst case), and
 * the owner heartbeats every 5 min while running.
 */
export const RUN_LEASE_MS = 15 * 60 * 1000;
/** Heartbeat cadence while a run is executing (must be < RUN_LEASE_MS). */
export const RUN_HEARTBEAT_MS = 5 * 60 * 1000;

/** True for done/failed — the only states the TTL may reap. */
function isTerminalStatus(s: RunStatus): boolean {
  return s === "done" || s === "failed";
}

const idemKeys = new Map<string, { runId: string; at: number }>();
const IDEM_TTL_MS = 24 * 3600 * 1000;

/**
 * Parents already deepened (finding #12). Memory-backend check-and-set
 * for the one-deepen-per-hunt rule — the DB backend enforces the same
 * via the deepened_from partial unique index (23505 on race).
 */
const deepenedParents = new Set<string>();

/**
 * Unguessable run ids (finding #3): guest runs have no session, so the id
 * itself is the capability — crypto.randomUUID, not a timestamp guess.
 */
function makeId(): string {
  return crypto.randomUUID();
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function freshRunShell(): Pick<HuntRun, "eventLog" | "listeners" | "donePromise" | "resolveDone"> {
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((res) => {
    resolveDone = res;
  });
  return { eventLog: [], listeners: new Set(), donePromise, resolveDone };
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export interface IdemClaim {
  fresh: boolean;
  runId: string;
}

/** Tunables for the loser-poll loop (tests shrink them; prod keeps these). */
export const claimTuning = {
  /** ms between winner checks. */
  pollMs: 200,
  /** max checks before giving up on the winner (~4s total). */
  rounds: 20,
  /** a claim older than this with no run row is dead (winner crashed). */
  staleMs: 60_000,
  /**
   * INVARIANT: pollMs * rounds < staleMs. A loser must never declare a
   * live winner stale inside its own initial poll window — the stale path
   * is only for losers arriving long after the claim (crashed winner).
   * Keep this ordering when tuning (a test once broke it and saw a
   * spurious second "fresh" winner).
   */
  _invariant: "pollMs * rounds < staleMs" as const,
};

/**
 * Claim an idempotency key. Contract: call BEFORE createRun; pass the
 * returned runId into createRun. On quota denial the caller MUST call
 * releaseIdempotency — otherwise a later tap with the same key would
 * attach to a run that will never exist.
 */
export async function claimIdempotency(key: string): Promise<IdemClaim> {
  const b = await backend();
  if (b.kind === "memory") return claimIdemMemory(key);
  return claimIdemDb(b.sb, key);
}

/** Release a claimed key without creating a run (quota denied). */
export async function releaseIdempotency(key: string): Promise<void> {
  const b = await backend();
  if (b.kind === "memory") {
    idemKeys.delete(key);
    return;
  }
  try {
    await b.sb.rest("DELETE", `hunt_idem_keys?key=eq.${encodeURIComponent(key)}`);
  } catch (e) {
    console.warn("[runs] releaseIdempotency failed:", (e as Error).message);
  }
}

function claimIdemMemory(key: string): IdemClaim {
  const hit = idemKeys.get(key);
  if (hit && Date.now() - hit.at < IDEM_TTL_MS) {
    return { fresh: false, runId: hit.runId };
  }
  // Claim eagerly (before quota): a concurrent same-key tap must see us.
  // Quota denial releases the key via releaseIdempotency.
  const runId = makeId();
  idemKeys.set(key, { runId, at: Date.now() });
  return { fresh: true, runId };
}

function isConflict(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 409
  );
}

interface IdemWinner {
  runId: string;
  atIso: string;
}

async function getIdemWinner(sb: SupabaseServer, key: string): Promise<IdemWinner | null> {
  const rows = await sb.rest<Array<{ run_id: string; at: string }>>(
    "GET",
    `hunt_idem_keys?key=eq.${encodeURIComponent(key)}&select=run_id,at&limit=1`
  );
  const w = rows[0];
  return w ? { runId: w.run_id, atIso: w.at } : null;
}

async function runRowExists(sb: SupabaseServer, runId: string): Promise<boolean> {
  const rows = await sb.rest<Array<{ id: string }>>(
    "GET",
    `hunt_runs?id=eq.${encodeURIComponent(runId)}&select=id&limit=1`
  );
  return rows.length > 0;
}

async function claimIdemDb(sb: SupabaseServer, key: string): Promise<IdemClaim> {
  const encKey = encodeURIComponent(key);
  // At most two cycles: initial claim + one re-claim after the key vanished
  // (quota-denied winner cleaned up) or a stale claim was removed.
  for (let cycle = 0; cycle < 2; cycle++) {
    const runId = makeId();
    try {
      // Atomic: the PK guarantees exactly one inserter wins.
      await sb.rest("POST", "hunt_idem_keys", { key, run_id: runId });
      return { fresh: true, runId };
    } catch (e) {
      if (!isConflict(e)) throw e;
      // Lost the race — fall through to the winner watch below.
    }

    const deadline = Date.now() + claimTuning.pollMs * claimTuning.rounds;
    let winner: IdemWinner | null = null;
    let recheck = false;
    while (Date.now() < deadline) {
      winner = await getIdemWinner(sb, key);
      if (!winner) {
        // Key is gone: the winner was quota-denied and released it.
        // Re-claim once as fresh.
        recheck = true;
        break;
      }
      if (await runRowExists(sb, winner.runId)) {
        return { fresh: false, runId: winner.runId };
      }
      if (Date.now() - new Date(winner.atIso).getTime() > claimTuning.staleMs) {
        // Winner crashed between claim and createRun. Remove claims older
        // than the stale threshold (lt, not exact-at: immune to timestamp
        // precision round-trips, and it can never touch a fresher claim
        // that landed between our read and this DELETE), then re-claim.
        const staleBefore = new Date(Date.now() - claimTuning.staleMs).toISOString();
        await sb.rest(
          "DELETE",
          `hunt_idem_keys?key=eq.${encKey}&at=lt.${encodeURIComponent(staleBefore)}`
        );
        recheck = true;
        break;
      }
      await sleep(claimTuning.pollMs);
    }
    if (recheck) continue;
    // Bounded wait exhausted with a live-but-runless winner: return its id.
    // The stream 404s honestly if the run never materializes.
    if (winner) return { fresh: false, runId: winner.runId };
  }
  throw new Error("[runs] idempotency claim failed after retry");
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

/**
 * Thrown by createRun's memory backend when deepenedFrom was already
 * claimed (finding #12: one deepen per hunt). The DB backend surfaces
 * the same condition as the deepened_from partial unique violation
 * (23505); isDeepenConflict() matches both shapes.
 */
export class DeepenConflictError extends Error {
  constructor(parentId: string) {
    super(`[runs] already deepened: ${parentId}`);
    this.name = "DeepenConflictError";
  }
}

/**
 * True when the error is a double-deepen conflict: the memory backend's
 * DeepenConflictError, or the DB backend's deepened_from unique
 * violation (PostgREST 409 carrying code 23505).
 */
export function isDeepenConflict(e: unknown): boolean {
  if (e instanceof DeepenConflictError) return true;
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 409 &&
    String((e as { message?: unknown }).message ?? "").includes("23505")
  );
}

interface HuntRunRow {
  id: string;
  owner_user_id: string | null;
  owner_device_id: string | null;
  definition: unknown;
  quota: unknown;
  kamin_id: string | null;
  status: string;
  start_cursor: unknown;
  end_cursor: unknown;
  deepened_from: string | null;
  created_at: string;
}

const RUN_COLUMNS =
  "id,owner_user_id,owner_device_id,definition,quota,kamin_id,status,start_cursor,end_cursor,deepened_from,created_at";

function rowToRun(row: HuntRunRow): HuntRun {
  const q = (row.quota ?? {}) as Record<string, unknown>;
  const terminal = row.status === "done" || row.status === "failed";
  return {
    id: row.id,
    def: row.definition as HuntDefinition,
    createdAt: new Date(row.created_at).getTime(),
    userId: row.owner_user_id,
    quota: {
      kind: (q.kind ?? "guest") as QuotaKind,
      mode: (q.mode ?? "permissive-dev") as QuotaMode,
      userId: (q.userId ?? null) as string | null,
      deviceId: typeof q.deviceId === "string" ? q.deviceId : "unknown",
      charged: q.charged !== false,
    },
    kaminId: row.kamin_id ?? undefined,
    status: row.status as RunStatus,
    ...freshRunShell(),
    endCursor: (row.end_cursor ?? undefined) as unknown,
    startCursor: (row.start_cursor ?? undefined) as unknown,
    deepenedFrom: row.deepened_from ?? undefined,
    finalized: terminal,
  };
}

export async function createRun(
  def: HuntDefinition,
  userId: string | null,
  quota: QuotaReceipt,
  idempotencyKey?: string,
  kaminId?: string,
  runId?: string,
  deepenedFrom?: string,
  /** Persisted at creation so callers don't need a second PATCH round trip. */
  startCursor?: unknown
): Promise<HuntRun> {
  const b = await backend();
  const id = runId ?? makeId();
  if (b.kind === "memory") {
    // Opportunistic cleanup of expired runs and keys. Finding #8: the TTL
    // reaps only terminal runs — a still-running run stays addressable
    // until it finishes (or its lease expires and another owner claims it).
    const now = Date.now();
    for (const [rid, r] of runs) {
      if (isTerminalStatus(r.status) && now - r.createdAt > RUN_TTL_MS) runs.delete(rid);
    }
    for (const [k, v] of idemKeys) {
      if (now - v.at > IDEM_TTL_MS) idemKeys.delete(k);
    }
    // One deepen per hunt: check-and-set is atomic here — JS runs this
    // synchronously, so two racing deepens in one process can never both
    // pass. (Cross-instance is the DB backend's unique index.)
    if (deepenedFrom) {
      if (deepenedParents.has(deepenedFrom)) throw new DeepenConflictError(deepenedFrom);
      deepenedParents.add(deepenedFrom);
    }
    const run: HuntRun = {
      id,
      def,
      createdAt: now,
      userId,
      quota,
      kaminId,
      status: "created",
      ...freshRunShell(),
      deepenedFrom,
      finalized: false,
    };
    if (startCursor !== undefined) run.startCursor = startCursor;
    runs.set(run.id, run);
    if (idempotencyKey) idemKeys.set(idempotencyKey, { runId: run.id, at: now });
    return run;
  }
  // DB path: the idempotency key was already claimed by claimIdempotency
  // (key → this exact run id). A crash between claim and this INSERT is
  // recovered by the loser's stale-claim path.
  // deepened_from's partial unique index makes a second deepen of the
  // same parent fail atomically (23505) — the route maps it to 400.
  await b.sb.rest("POST", "hunt_runs", {
    id,
    owner_user_id: userId,
    owner_device_id: isUuid(quota.deviceId) ? quota.deviceId : null,
    definition: def,
    quota: {
      kind: quota.kind,
      mode: quota.mode,
      userId: quota.userId,
      deviceId: quota.deviceId,
      charged: quota.charged,
    },
    kamin_id: kaminId ?? null,
    status: "created",
    deepened_from: deepenedFrom ?? null,
    start_cursor: startCursor ?? null,
  });
  const rows = await b.sb.rest<HuntRunRow[]>(
    "GET",
    `hunt_runs?id=eq.${encodeURIComponent(id)}&select=${RUN_COLUMNS}&limit=1`
  );
  const row = rows[0];
  if (!row) throw new Error("[runs] createRun: row missing after insert");
  return rowToRun(row);
}

export async function getRun(id: string): Promise<HuntRun | undefined> {
  const b = await backend();
  if (b.kind === "memory") {
    const run = runs.get(id);
    if (!run) return undefined;
    // Finding #8: the 30 min TTL applies only to terminal runs. A
    // still-running run (legit long hunt, or a stuck one awaiting lease
    // recovery) must stay reachable — otherwise it reads as "not found".
    if (isTerminalStatus(run.status) && Date.now() - run.createdAt > RUN_TTL_MS) {
      runs.delete(id);
      return undefined;
    }
    return run;
  }
  const rows = await b.sb.rest<HuntRunRow[]>(
    "GET",
    `hunt_runs?id=eq.${encodeURIComponent(id)}&select=${RUN_COLUMNS}&limit=1`
  );
  const row = rows[0];
  if (!row) return undefined;
  const run = rowToRun(row);
  // DB runs: 30-day retention (see RUN_TTL_MS_DB). Memory runs: 30 min.
  if (isTerminalStatus(run.status) && Date.now() - run.createdAt > RUN_TTL_MS_DB) return undefined;
  return run;
}

/**
 * Has this run already been deepened? Friendly pre-check for the deepen
 * route — the atomic backstop is the deepened_from partial unique index
 * (DB) / the deepenedParents check-and-set (memory).
 */
export async function hasDeepChild(parentId: string): Promise<boolean> {
  const b = await backend();
  if (b.kind === "memory") return deepenedParents.has(parentId);
  const rows = await b.sb.rest<Array<{ id: string }>>(
    "GET",
    `hunt_runs?deepened_from=eq.${encodeURIComponent(parentId)}&select=id&limit=1`
  );
  return rows.length > 0;
}

/**
 * Atomically claim a run for execution. Memory path: the check-and-set
 * runs synchronously inside this call, so two racing GETs in one process
 * can never both become the owner. (No lease needed — a crashed process
 * loses its memory with it.)
 *
 * DB path, finding #7: two sequential conditional UPDATEs, each atomic —
 * 1. created → running (the normal claim), stamping claimed_at = now();
 * 2. running with an expired lease → running (crash recovery: the previous
 *    owner died mid-pipeline, its heartbeat stopped). Exactly one instance
 *    wins each race, so execution stays single-owner.
 */
export async function claimRunForExecution(run: HuntRun): Promise<boolean> {
  const b = await backend();
  if (b.kind === "memory") {
    if (run.status !== "created") return false;
    run.status = "running";
    return true;
  }
  const nowIso = new Date().toISOString();
  const fresh = await b.sb.rest<Array<{ id: string }>>(
    "PATCH",
    `hunt_runs?id=eq.${encodeURIComponent(run.id)}&status=eq.created&select=id`,
    { status: "running", claimed_at: nowIso, updated_at: nowIso }
  );
  if (fresh.length > 0) return true;
  // Crash recovery: steal the lease only when the owner is demonstrably
  // gone (claimed_at older than the lease, or never stamped pre-m18).
  const leaseCutoff = new Date(Date.now() - RUN_LEASE_MS).toISOString();
  const recovered = await b.sb.rest<Array<{ id: string }>>(
    "PATCH",
    `hunt_runs?id=eq.${encodeURIComponent(run.id)}` +
      `&status=eq.running&or=(claimed_at.is.null,claimed_at.lt.${encodeURIComponent(leaseCutoff)})` +
      `&select=id`,
    { claimed_at: nowIso, updated_at: nowIso }
  );
  return recovered.length > 0;
}

/**
 * Refresh the execution lease while the pipeline runs (finding #7).
 * The owner calls this every RUN_HEARTBEAT_MS; a crashed owner's lease
 * goes stale and becomes claimable after RUN_LEASE_MS. Best-effort:
 * heartbeat failure must never break the hunt.
 */
export async function heartbeatRunClaim(runId: string): Promise<void> {
  const b = await backend();
  if (b.kind !== "db") return;
  try {
    const nowIso = new Date().toISOString();
    await b.sb.rest(
      "PATCH",
      `hunt_runs?id=eq.${encodeURIComponent(runId)}&status=eq.running&select=id`,
      { claimed_at: nowIso, updated_at: nowIso }
    );
  } catch (e) {
    console.warn("[runs] heartbeat failed:", (e as Error).message);
  }
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

// ---------------------------------------------------------------------------
// Event log (the SSE replay source)
// ---------------------------------------------------------------------------

/**
 * Persist one emitted event. The caller tracks the promise and awaits it
 * before finalizing — never fire-and-forget: the event table IS the replay
 * source for other instances.
 */
export async function appendRunEvent(runId: string, event: HuntEvent): Promise<void> {
  const b = await backend();
  if (b.kind === "memory") return; // memory path replays from run.eventLog
  try {
    await b.sb.rest("POST", "hunt_run_events", {
      run_id: runId,
      type: event.type,
      payload: event,
    });
  } catch (e) {
    // Loud, never silent: a gap here degrades replay (the poller also
    // watches run status, so the stream still terminates honestly).
    console.warn("[runs] event persist failed:", (e as Error).message);
  }
}

export interface StoredEvent {
  id: number;
  event: HuntEvent;
}

/** Events for a run after a given log id, in emission order. */
export async function readRunEvents(
  runId: string,
  afterId = 0
): Promise<StoredEvent[]> {
  const b = await backend();
  if (b.kind !== "db") return [];
  const rows = await b.sb.rest<Array<{ id: number; type: string; payload: HuntEvent }>>(
    "GET",
    `hunt_run_events?run_id=eq.${encodeURIComponent(runId)}&id=gt.${afterId}&order=id&select=id,type,payload`
  );
  return rows.map((r) => ({ id: r.id, event: r.payload }));
}

export async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const b = await backend();
  if (b.kind !== "db") return null;
  const rows = await b.sb.rest<Array<{ status: string }>>(
    "GET",
    `hunt_runs?id=eq.${encodeURIComponent(runId)}&select=status&limit=1`
  );
  return (rows[0]?.status as RunStatus) ?? null;
}

/**
 * Finalize a run (running → done|failed), persisting the end cursor.
 * Conditional: exactly one closer wins per run. Also releases the
 * execution lease (claimed_at = null, finding #7) in the same atomic
 * PATCH — after this the run is terminal, so no tick may claim it again.
 */
export async function finalizeRun(
  runId: string,
  status: "done" | "failed",
  endCursor?: unknown
): Promise<boolean> {
  const b = await backend();
  if (b.kind !== "db") return true;
  const rows = await b.sb.rest<Array<{ id: string }>>(
    "PATCH",
    `hunt_runs?id=eq.${encodeURIComponent(runId)}&status=eq.running&select=id`,
    {
      status,
      end_cursor: endCursor ?? null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    }
  );
  return rows.length > 0;
}

/** Persist the deepen phase's resume cursor on the deep run. */
export async function setRunStartCursor(run: HuntRun, cursor: unknown): Promise<void> {
  const b = await backend();
  if (b.kind === "memory") {
    run.startCursor = cursor;
    return;
  }
  await b.sb.rest(
    "PATCH",
    `hunt_runs?id=eq.${encodeURIComponent(run.id)}&select=id`,
    { start_cursor: cursor ?? null, updated_at: new Date().toISOString() }
  );
}

// ---------------------------------------------------------------------------
// Completion side effects (kamin baseline + fairness refund, exactly once)
// ---------------------------------------------------------------------------

/**
 * Runs after a run is finalized (guarded by the caller's exactly-once
 * mechanism: run.finalized in memory, conditional UPDATE in DB).
 */
export async function runCompletionSideEffects(
  run: HuntRun,
  opts: { sawResults: boolean; errored: boolean; finalIds: string[] }
): Promise<void> {
  const { sawResults, errored, finalIds } = opts;
  // Kamin baseline: a run fired from «دیدن نتایج» moves the seen
  // baseline ONLY after a successful hunt — a failed search never
  // swallows "new" matches (blueprint §1.8).
  if (run.kaminId && !errored && run.userId) {
    try {
      const sb = supabaseConfigured() ? supabaseServer() : null;
      if (sb) await advanceKaminBaseline(sb, run.kaminId, run.userId, finalIds);
    } catch {
      /* baseline advance is best-effort; the hunt result matters more */
    }
  }
  // Fairness refund: zero results or our failure → give the unit back.
  // Deep-history runs were never charged, so there's nothing to refund.
  if (run.quota.charged && (!sawResults || errored)) {
    try {
      await refundHunt({
        userId: run.quota.userId,
        deviceId: run.quota.deviceId,
        kind: run.quota.kind,
        mode: run.quota.mode,
      });
    } catch {
      /* refund is best-effort; the hunt result matters more */
    }
  }
}
