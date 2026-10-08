import "server-only";

import { normalizePersian } from "@/lib/normalizePersian";
import { TIERS } from "@/lib/tiers";
import {
  collectCandidates,
  confirmCandidates,
  type Candidate,
  type HuntDefinition,
  type HuntStats,
  type ScoredAd,
} from "@/lib/server/hunt/pipeline";
import { kaminPushBody, kaminPushTitle } from "./copy";

/**
 * M5 kamin engine (blueprint §1.8, §1.9).
 *
 * A kamin is the hunt pipeline on a tier cadence, with:
 *  - canonical_key dedupe (one kamin per search meaning, per user);
 *  - kamin_seen_ads baseline — only genuinely-new ids are confirmed.
 *    The baseline is UNBOUNDED (one row per (kamin, ad)): the old
 *    500-id cap on kamins.seen_ids caused long-lived kamins to forget
 *    old ads, which resurfaced as false "new" matches (round-2 #8);
 *  - details fetched ONLY for new ids (never re-fetched for known ads);
 *  - since-LAST-SUCCESS windows (output-quality.md flaw #6): a failed or
 *    cooldown-interrupted check never moves last_success_at, so the next
 *    run catches the missed window up instead of skipping it;
 *  - first successful check after arming is a SILENT baseline — we never
 *    push-notify for ads that predate the kamin.
 *
 * Arming is atomic via the try_arm_kamin RPC (round-2 #7): the slot
 * check + insert happen in one transaction, serialized per user — two
 * concurrent arms on a 1-slot tier can no longer both slip through.
 *
 * Invariants (never weaken):
 *  - failed detail fetch = "unknown", never a silent drop (pipeline);
 *  - baseline moves only after a successful check — a failed search never
 *    swallows "new" matches;
 *  - one notification per (kamin_id, check_run_id): one push per genuinely
 *    new match set, never duplicates.
 */

export interface Sb {
  rest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    prefer?: string
  ): Promise<T>;
}

export interface KaminRow {
  id: string;
  user_id: string;
  name: string;
  definition: HuntDefinition;
  canonical_key: string;
  status: "active" | "sleeping";
  cadence: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  /** Scheduler claim lease (m12, round 3). Null = unclaimed. */
  claimed_at?: string | null;
  new_match_count: number;
  armed_at: string;
}

export interface KaminPublic {
  id: string;
  name: string;
  status: "active" | "sleeping";
  cadence: string;
  new_match_count: number;
  last_checked_at: string | null;
  armed_at: string;
  definition: HuntDefinition;
}

/** Tier cadence at arm time (blueprint §1.3). Canonical data lives in
 *  @/lib/tiers so the plans UI can never drift from enforcement. */
export const TIER_CADENCE: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.cadence])
);

/** Kamin slots per tier (blueprint §1.3). Hard limit — navid 2026-10-06. */
export const TIER_KAMIN_SLOTS: Record<string, number> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.kaminSlots])
);

const CADENCE_MS: Record<string, number> = {
  "5min": 5 * 60 * 1000,
  "15min": 15 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export function cadenceMs(cadence: string): number {
  return CADENCE_MS[cadence] ?? CADENCE_MS.daily;
}

/**
 * Recency-window page budget: ~1 page per 30 min since the last SUCCESS,
 * clamped to 2..20. Cheap for frequent kamins, catch-up after a cooldown
 * gap — the window is time-derived, never a quality cut.
 */
export function pageBudgetForElapsed(elapsedMs: number): number {
  const pages = 2 + Math.floor(Math.max(0, elapsedMs) / (30 * 60 * 1000));
  return Math.min(20, Math.max(2, pages));
}

/**
 * Server-side canonical key — same semantics as radar.ts canonicalKey
 * (term order / whitespace must not change identity), recomputed from the
 * validated definition. Never trusted from the client.
 */
export function kaminCanonicalKey(def: HuntDefinition): string {
  const sorted = (terms: string[]) =>
    [...terms].map((t) => normalizePersian(t)).sort();
  return JSON.stringify({
    q: normalizePersian(def.query),
    inc: sorted(def.include),
    exc: sorted(def.exclude),
    cat: def.category,
    city: def.city,
    min: def.priceMin,
    max: def.priceMax,
    tx: def.transaction,
    cond: def.condition,
  });
}

export class KaminError extends Error {
  constructor(
    readonly code: "slots-full" | "bad-definition",
    message: string
  ) {
    super(message);
    this.name = "KaminError";
  }
}

const enc = encodeURIComponent;

function toPublic(k: KaminRow): KaminPublic {
  return {
    id: k.id,
    name: k.name,
    status: k.status,
    cadence: k.cadence,
    new_match_count: k.new_match_count,
    last_checked_at: k.last_checked_at,
    armed_at: k.armed_at,
    definition: k.definition,
  };
}

export async function listKamins(sb: Sb, userId: string): Promise<KaminPublic[]> {
  const rows = await sb.rest<KaminRow[]>(
    "GET",
    `kamins?user_id=eq.${enc(userId)}&select=*&order=armed_at.desc`
  );
  return rows.map(toPublic);
}

export async function armKamin(
  sb: Sb,
  opts: {
    userId: string;
    name: string;
    definition: HuntDefinition;
    seenIds: string[];
    /** Active tier, or null when the user has no subscription. */
    tier: string | null;
  }
): Promise<{ kamin: KaminPublic; created: boolean }> {
  const key = kaminCanonicalKey(opts.definition);
  const cadence = opts.tier ? (TIER_CADENCE[opts.tier] ?? "daily") : "daily";
  // No subscription → armed SLEEPING (guest-conversion funnel: «کمینت
  // آماده‌ست — با اشتراک بیدار می‌شه»). Never consumes a slot it has no tier for.
  const status = opts.tier ? "active" : "sleeping";
  const slots = opts.tier ? (TIER_KAMIN_SLOTS[opts.tier] ?? 1) : 0;

  // Fast path: an ACTIVE kamin with this canonical key is returned as-is.
  // (Also enforced by the DB unique constraint — the RPC re-checks, so the
  // GET→RPC gap can't double-arm.)
  const existing = await sb.rest<KaminRow[]>(
    "GET",
    `kamins?user_id=eq.${enc(opts.userId)}&canonical_key=eq.${enc(key)}&select=*&limit=1`
  );
  if (existing[0]?.status === "active") {
    return { kamin: toPublic(existing[0]), created: false };
  }

  // Atomic path (finding #7): slot check + insert (or slot-checked wake of
  // a sleeping kamin with the same key) in one transaction, serialized
  // per user. Two concurrent arms on a 1-slot tier can no longer both
  // slip through.
  const armed = await rpcTryArmKamin(sb, {
    userId: opts.userId,
    name: opts.name.slice(0, 60),
    definition: opts.definition,
    canonicalKey: key,
    status,
    cadence,
    slots,
    seenIds: opts.seenIds,
  });
  if (armed) {
    if (armed.kaminId) {
      const rows = await sb.rest<KaminRow[]>(
        "GET",
        `kamins?id=eq.${enc(armed.kaminId)}&select=*&limit=1`
      );
      return { kamin: toPublic(rows[0]), created: armed.created };
    }
    throw new KaminError(
      "slots-full",
      "به سقف کمین‌هات رسیدی — کمین بیشتر می‌خوای؟ پلن بالاتر"
    );
  }

  // Legacy path (m9 not run yet): racy GET→POST, loud warn (round-1 pattern).
  console.warn(
    "[kamin] try_arm_kamin RPC missing — legacy racy arm. Run supabase/m9-kamin-atomic.sql."
  );
  return legacyArmKamin(sb, { ...opts, key, status, cadence, slots });
}

interface ArmAttempt {
  kaminId: string | null;
  created: boolean;
}

/**
 * Atomic arm via try_arm_kamin (finding #7). Returns null when the RPC is
 * not installed (404) — the caller falls back to the legacy path.
 * Zero rows (kaminId null) = the tier's slots are full.
 */
async function rpcTryArmKamin(
  sb: Sb,
  args: {
    userId: string;
    name: string;
    definition: HuntDefinition;
    canonicalKey: string;
    status: "active" | "sleeping";
    cadence: string;
    slots: number;
    seenIds: string[];
  }
): Promise<ArmAttempt | null> {
  try {
    // NOTE (m11): prod kamins.user_id is UUID — the RPC's p_user_id is
    // uuid. PostgREST casts the session-uuid string. Never pass a
    // non-uuid here (guests can't arm kamins; the route requires auth).
    const rows = await sb.rest<Array<{ kamin_id: string | null; created: boolean }>>(
      "POST",
      "/rpc/try_arm_kamin",
      {
        p_user_id: args.userId,
        p_name: args.name,
        p_definition: args.definition,
        p_canonical_key: args.canonicalKey,
        p_status: args.status,
        p_cadence: args.cadence,
        p_slots: args.slots,
        p_seen_ids: args.seenIds,
      }
    );
    const row = rows[0];
    if (!row || !row.kamin_id) return { kaminId: null, created: false };
    return { kaminId: row.kamin_id, created: row.created };
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** 404 from PostgREST = missing table/function (migration not run yet). */
function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 404
  );
}

function isBadRequest(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 400
  );
}

/**
 * Pre-m9 arm path: GET count → POST. Racy by construction (finding #7) —
 * kept only until the migration runs, then never taken.
 */
async function legacyArmKamin(
  sb: Sb,
  opts: {
    userId: string;
    name: string;
    definition: HuntDefinition;
    seenIds: string[];
    tier: string | null;
    key: string;
    status: "active" | "sleeping";
    cadence: string;
    slots: number;
  }
): Promise<{ kamin: KaminPublic; created: boolean }> {
  const existing = await sb.rest<KaminRow[]>(
    "GET",
    `kamins?user_id=eq.${enc(opts.userId)}&canonical_key=eq.${enc(opts.key)}&select=*&limit=1`
  );
  if (existing[0]) {
    const k = existing[0];
    if (k.status === "sleeping") {
      // Waking consumes a slot — same rule as the RPC path (finding #7,
      // #11). Without this check, re-arming a sleeping kamin on a full
      // tier would bypass the entitlement entirely.
      const active = await sb.rest<Array<{ id: string }>>(
        "GET",
        `kamins?user_id=eq.${enc(opts.userId)}&status=eq.active&select=id`
      );
      if (active.length >= opts.slots) {
        throw new KaminError(
          "slots-full",
          "به سقف کمین‌هات رسیدی — کمین بیشتر می‌خوای؟ پلن بالاتر"
        );
      }
      // Re-arming a sleeping kamin wakes it (definition refresh included).
      const rows = await sb.rest<KaminRow[]>("PATCH", `kamins?id=eq.${enc(k.id)}`, {
        status: "active",
        name: opts.name,
        definition: opts.definition,
      });
      return { kamin: toPublic(rows[0] ?? k), created: false };
    }
    return { kamin: toPublic(k), created: false };
  }

  if (opts.status === "active") {
    const active = await sb.rest<Array<{ id: string }>>(
      "GET",
      `kamins?user_id=eq.${enc(opts.userId)}&status=eq.active&select=id`
    );
    if (active.length >= opts.slots) {
      throw new KaminError(
        "slots-full",
        "به سقف کمین‌هات رسیدی — کمین بیشتر می‌خوای؟ پلن بالاتر"
      );
    }
  }

  const rows = await sb.rest<KaminRow[]>("POST", "kamins", {
    user_id: opts.userId,
    name: opts.name.slice(0, 60),
    definition: opts.definition,
    canonical_key: opts.key,
    status: opts.status,
    cadence: opts.cadence,
    // Uncapped: the 500-id cap was the bug (#8). Pre-m9 the column still
    // exists, so the legacy write keeps working until the migration drops it.
    seen_ids: opts.seenIds,
  });
  return { kamin: toPublic(rows[0]), created: true };
}

export async function removeKamin(sb: Sb, userId: string, kaminId: string): Promise<void> {
  await sb.rest(
    "DELETE",
    `kamins?id=eq.${enc(kaminId)}&user_id=eq.${enc(userId)}`
  );
}

/** Subscription expiry → kamins SLEEP (definitions + history kept). Renewal wakes. */
export async function sleepKaminsForUser(sb: Sb, userId: string): Promise<void> {
  await sb.rest("PATCH", `kamins?user_id=eq.${enc(userId)}&status=eq.active`, {
    status: "sleeping",
  });
}

/**
 * Wakes sleeping kamins after (re)subscribe — but NEVER past the tier's
 * slot limit (navid 2026-10-06: hard limit, same as arm). The newest
 * sleeping kamins wake first (freshest intent); the rest stay sleeping.
 * Called from the subscription lifecycle (activate/renew) with the tier's
 * TIER_KAMIN_SLOTS — never more than the slot limit may wake.
 */
export async function wakeKaminsForUser(
  sb: Sb,
  userId: string,
  slots: number
): Promise<number> {
  const active = await sb.rest<Array<{ id: string }>>(
    "GET",
    `kamins?user_id=eq.${enc(userId)}&status=eq.active&select=id`
  );
  const free = slots - active.length;
  if (free <= 0) return 0;
  const sleeping = await sb.rest<Array<{ id: string }>>(
    "GET",
    `kamins?user_id=eq.${enc(userId)}&status=eq.sleeping` +
      `&order=created_at.desc&limit=${free}&select=id`
  );
  for (const k of sleeping) {
    await sb.rest("PATCH", `kamins?id=eq.${enc(k.id)}`, { status: "active" });
  }
  return sleeping.length;
}

/**
 * Seen baseline (finding #8). The kamin_seen_ads table is UNBOUNDED — an
 * ad is "new" iff it has no row, forever. Pre-m9 (table missing → 404),
 * falls back to the kamins.seen_ids column with a loud warn.
 */
async function readSeenSet(
  sb: Sb,
  kaminId: string
): Promise<{ seen: Set<string>; legacy: boolean }> {
  try {
    const rows = await sb.rest<Array<{ source_ad_id: string }>>(
      "GET",
      `kamin_seen_ads?kamin_id=eq.${enc(kaminId)}&select=source_ad_id`
    );
    return { seen: new Set(rows.map((r) => r.source_ad_id)), legacy: false };
  } catch (e) {
    if (!isNotFound(e)) throw e;
    console.warn(
      "[kamin] kamin_seen_ads missing — legacy seen_ids column. Run supabase/m9-kamin-atomic.sql."
    );
    const rows = await sb.rest<Array<{ seen_ids: string[] }>>(
      "GET",
      `kamins?id=eq.${enc(kaminId)}&select=seen_ids&limit=1`
    );
    return { seen: new Set(rows[0]?.seen_ids ?? []), legacy: true };
  }
}

/**
 * PATCH a kamin_runs row, tolerating a missing m16 `stale` column.
 * If the migration hasn't been run yet, PostgREST 400s on the unknown
 * column — retry without it and warn loudly (round-1 pattern). The
 * staleness signal is bookkeeping; the correctness fix (frozen
 * last_success_at) lives in the kamins PATCH, which needs no migration.
 */
async function patchKaminRun(
  sb: Sb,
  checkRunId: string,
  patch: Record<string, unknown>
): Promise<void> {
  try {
    await sb.rest("PATCH", `kamin_runs?id=eq.${enc(checkRunId)}`, patch);
  } catch (e) {
    if (isBadRequest(e) && "stale" in patch) {
      console.warn(
        "[kamin] kamin_runs.stale column missing — run supabase/m16-kamin-runs-stale.sql"
      );
      const { stale: _dropped, ...rest } = patch;
      await sb.rest("PATCH", `kamin_runs?id=eq.${enc(checkRunId)}`, rest);
      return;
    }
    throw e;
  }
}

/**
 * Record ids as seen. Union-only: the baseline never shrinks. Pre-m9,
 * unions into the seen_ids column (uncapped — the cap was the bug).
 */
async function writeSeenIds(
  sb: Sb,
  kaminId: string,
  ids: string[],
  legacy: boolean
): Promise<void> {
  if (ids.length === 0) return;
  if (!legacy) {
    try {
      await sb.rest("POST", "/rpc/kamin_mark_seen", {
        p_kamin_id: kaminId,
        p_source_ad_ids: ids,
      });
      return;
    } catch (e) {
      if (!isNotFound(e)) throw e;
      console.warn(
        "[kamin] kamin_mark_seen RPC missing — legacy seen_ids PATCH. Run supabase/m9-kamin-atomic.sql."
      );
    }
  }
  const rows = await sb.rest<Array<{ seen_ids: string[] }>>(
    "GET",
    `kamins?id=eq.${enc(kaminId)}&select=seen_ids&limit=1`
  );
  const seen = new Set(rows[0]?.seen_ids ?? []);
  for (const id of ids) seen.add(id);
  await sb.rest("PATCH", `kamins?id=eq.${enc(kaminId)}`, {
    seen_ids: [...seen],
  });
}

/**
 * Advance the seen baseline with ids the user was actually shown (explicit
 * «دیدن نتایج» run). Union-only: the baseline never shrinks, and a failed
 * search never swallows "new" matches.
 */
export async function advanceKaminBaseline(
  sb: Sb | null,
  kaminId: string,
  userId: string,
  ids: string[]
): Promise<void> {
  if (!sb || ids.length === 0) return;
  try {
    // Ownership check (as before): only the kamin's owner moves its baseline.
    const own = await sb.rest<Array<{ id: string }>>(
      "GET",
      `kamins?id=eq.${enc(kaminId)}&user_id=eq.${enc(userId)}&select=id&limit=1`
    );
    if (own.length === 0) {
      console.warn("[kamin] baseline advance: kamin not owned by user, skipping");
      return;
    }
    const { legacy } = await readSeenSet(sb, kaminId);
    await writeSeenIds(sb, kaminId, ids, legacy);
  } catch (e) {
    console.warn("[kamin] baseline advance failed:", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Check engine
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface EngineDeps {
  sb: Sb | null;
  now: () => number;
  uuid: () => string;
  collect: (
    def: HuntDefinition,
    maxPages: number
  ) => Promise<{ candidates: Candidate[]; stale: boolean }>;
  confirm: (candidates: Candidate[], def: HuntDefinition) => Promise<ScoredAd[]>;
  sendPush: (userId: string, payload: PushPayload) => Promise<void>;
}

/** Real (non-test) pipeline wiring for the engine. */
export function realEnginePipeline(): Pick<EngineDeps, "collect" | "confirm"> {
  return {
    collect: (def, maxPages) =>
      collectCandidates(def, { maxPages }).then((r) => ({
        candidates: r.candidates,
        // Finding #17: the stale flag must reach checkKamin — a stale
        // collect is NOT a success and must not advance last_success_at.
        stale: r.stats.stale,
      })),
    confirm: (candidates, def) => {
      const stats: HuntStats = {
        adsSeen: 0,
        titleRejected: 0,
        dupsCollapsed: 0,
        candidates: candidates.length,
        detailsChecked: 0,
        confirmed: 0,
        stale: false,
        nearMiss: 0,
      };
      return confirmCandidates(candidates, def, stats);
    },
  };
}

export type CheckStatus = "completed" | "failed" | "baseline";

export interface KaminCheckResult {
  kaminId: string;
  status: CheckStatus;
  newCount: number;
  checkRunId: string;
}

/**
 * One kamin check: collect recent candidates → diff against the seen
 * baseline → confirm ONLY the new ids → notify + push on genuinely-new
 * matches.
 */
export async function checkKamin(
  deps: EngineDeps,
  kamin: KaminRow
): Promise<KaminCheckResult> {
  const sb = deps.sb;
  const checkRunId = deps.uuid();
  const nowIso = new Date(deps.now()).toISOString();
  if (!sb) {
    console.warn("[kamin] permissive-dev: no Supabase, skipping check");
    return { kaminId: kamin.id, status: "failed", newCount: 0, checkRunId };
  }

  await sb.rest("POST", "kamin_runs", {
    id: checkRunId,
    kamin_id: kamin.id,
    user_id: kamin.user_id,
    status: "running",
    window_from: kamin.last_success_at,
    window_to: nowIso,
  });

  // Finding #1/#2 (round 5): the scheduler claim's lease must not act as
  // a minimum check interval, and a slow check must not lose its claim.
  // Heartbeat refreshes claimed_at every 5 min while the check runs (so a
  // >10 min check isn't stolen); the finally block releases the claim
  // (claimed_at = null) so the next tick's due-calculation uses only
  // last_checked_at. If this instance crashes, the heartbeat stops and
  // the 600s lease lets another tick recover the kamin.
  const heartbeat = setInterval(() => {
    sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
      claimed_at: new Date(deps.now()).toISOString(),
    }).catch((e) =>
      console.warn("[kamin] heartbeat failed:", (e as Error).message)
    );
  }, 5 * 60 * 1000);

  try {
    const elapsed = kamin.last_success_at
      ? deps.now() - Date.parse(kamin.last_success_at)
      : 0;
    const maxPages = pageBudgetForElapsed(elapsed);
    const { candidates, stale } = await deps.collect(kamin.definition, maxPages);

    // The baseline lives in kamin_seen_ads (unbounded) — or the legacy
    // seen_ids column pre-m9. Read once per check; writes union into it.
    const { seen, legacy } = await readSeenSet(sb, kamin.id);

    // First successful check after arming = SILENT baseline. We never
    // push-notify for ads that predate the kamin.
    if (!kamin.last_success_at) {
      if (stale) {
        // Finding #17: a stale collect is not a real baseline — the data
        // may be incomplete. Advance last_checked_at only; the next check
        // retries the silent baseline with fresh data.
        await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
          last_checked_at: nowIso,
        });
        await patchKaminRun(sb, checkRunId, {
          status: "completed",
          stale: true,
          completed_at: nowIso,
          pages_fetched: maxPages,
          candidates: candidates.length,
          new_count: 0,
        });
        return { kaminId: kamin.id, status: "completed", newCount: 0, checkRunId };
      }
      const baselineNew = candidates
        .map((c) => c.sourceAdId)
        .filter((id) => !seen.has(id));
      await writeSeenIds(sb, kamin.id, baselineNew, legacy);
      await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
        last_checked_at: nowIso,
        last_success_at: nowIso,
        new_match_count: 0,
      });
      await sb.rest("PATCH", `kamin_runs?id=eq.${enc(checkRunId)}`, {
        status: "baseline",
        completed_at: nowIso,
        pages_fetched: maxPages,
        candidates: candidates.length,
        new_count: 0,
      });
      return { kaminId: kamin.id, status: "baseline", newCount: 0, checkRunId };
    }

    const fresh = candidates.filter((c) => !seen.has(c.sourceAdId));
    const results = await deps.confirm(fresh, kamin.definition);
    // Finding #21: detailUnknown ads were never verified — they must not
    // advance the baseline (stay unseen for a later successful check) and
    // must not trigger notifications.
    const verified = results.filter((r) => !r.detailUnknown);
    const newIds = verified.map((r) => r.sourceAdId);
    const newCount = newIds.length;
    // Finding #1 (bug-bounty round 6): if the detail layer was completely
    // degraded — every result is detailUnknown (failed fetches) or stale
    // (served from old cache, now flagged by the pipeline) — this check
    // verified nothing. Advancing last_success_at would fake a success:
    // the timestamp feeds pageBudgetForElapsed, so a fake success shrinks
    // the next check's crawl budget and missed ads become unrecoverable.
    // Same treatment as a stale list collect (finding #17).
    const detailDegraded = results.length > 0 && verified.length === 0;

    await writeSeenIds(sb, kamin.id, newIds, legacy);
    if (stale || detailDegraded) {
      // Findings #17 / #1-round-6: neither a stale list collect nor a fully
      // degraded detail layer is a success. last_checked_at moves (the check
      // ran), but last_success_at stays — the next check's since-LAST-SUCCESS
      // window still covers this period, so ads missed during the outage are
      // caught up, never skipped.
      await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
        last_checked_at: nowIso,
        new_match_count: newCount,
      });
    } else {
      await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
        last_checked_at: nowIso,
        last_success_at: nowIso,
        new_match_count: newCount,
      });
    }

    if (newCount > 0) {
      // Dedupe guard: one notification per (kamin_id, check_run_id), ATOMIC.
      // The m19 unique index makes the INSERT the gate: ON CONFLICT DO
      // NOTHING returns zero rows for the loser. Only the winner sends the
      // push — Web Push has no idempotency, so sendPush must live inside
      // the atomic gate (finding #4, final round).
      let notified = false;
      try {
        const inserted = await sb.rest<Array<{ id: string }>>(
          "POST",
          "notifications?on_conflict=related_kamin_id,check_run_id",
          {
            user_id: kamin.user_id,
            type: "new_kamin_match",
            title: kaminPushTitle(newCount),
            body: kaminPushBody(kamin.name),
            related_kamin_id: kamin.id,
            check_run_id: checkRunId,
          },
          // ignore-duplicates: the loser gets [] instead of a 409, so the
          // atomic gate works without a try/catch on constraint violation.
          "return=representation,resolution=ignore-duplicates"
        );
        notified = inserted.length > 0;
      } catch (e) {
        // Pre-m19 (no unique index): fall back to the old GET-then-INSERT
        // with a loud warning. Still racy, but better than crashing.
        console.warn(
          "[kamin] notification upsert failed, falling back — run supabase/m19-notification-dedupe.sql:",
          (e as Error).message
        );
        const dup = await sb.rest<Array<{ id: string }>>(
          "GET",
          `notifications?related_kamin_id=eq.${enc(kamin.id)}&check_run_id=eq.${enc(checkRunId)}&select=id&limit=1`
        );
        if (dup.length === 0) {
          await sb.rest("POST", "notifications", {
            user_id: kamin.user_id,
            type: "new_kamin_match",
            title: kaminPushTitle(newCount),
            body: kaminPushBody(kamin.name),
            related_kamin_id: kamin.id,
            check_run_id: checkRunId,
          });
          notified = true;
        }
      }
      if (notified) {
        try {
          await deps.sendPush(kamin.user_id, {
            title: kaminPushTitle(newCount),
            body: kaminPushBody(kamin.name),
            url: "/saved?tab=fresh",
            tag: `kamin-${kamin.id}`,
          });
        } catch (e) {
          // Push is best-effort; the in-app notification already exists.
          console.warn("[kamin] push failed:", (e as Error).message);
        }
      }
    }

    await patchKaminRun(sb, checkRunId, {
      status: "completed",
      // Finding #1 (round 6): a fully degraded detail layer is as much
      // "not a real success" as a stale list — flag it for observability.
      stale: stale || detailDegraded,
      completed_at: nowIso,
      pages_fetched: maxPages,
      candidates: candidates.length,
      new_count: newCount,
    });
    return { kaminId: kamin.id, status: "completed", newCount, checkRunId };
  } catch (e) {
    // Failure (incl. provider cooldown): last_success_at does NOT move, so
    // the next run uses the since-LAST-SUCCESS window — the missed window
    // is caught up, never skipped (output-quality.md flaw #6).
    try {
      await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
        last_checked_at: nowIso,
      });
      await sb.rest("PATCH", `kamin_runs?id=eq.${enc(checkRunId)}`, {
        status: "failed",
        completed_at: nowIso,
        error: (e as Error).message?.slice(0, 500) ?? "unknown",
      });
    } catch {
      /* bookkeeping must never break the tick */
    }
    return { kaminId: kamin.id, status: "failed", newCount: 0, checkRunId };
  } finally {
    // Finding #1: release the scheduler claim. The lease exists only for
    // crash recovery — a completed check must not block the next due tick.
    clearInterval(heartbeat);
    try {
      await sb.rest("PATCH", `kamins?id=eq.${enc(kamin.id)}`, {
        claimed_at: null,
      });
    } catch {
      /* claim release is best-effort; the lease expires on its own */
    }
  }
}

export interface TickSummary {
  mode: "real" | "permissive-dev";
  due: number;
  completed: number;
  failed: number;
  newMatches: number;
}

/** Run every due active kamin, sequentially (the provider throttle is global). */
export async function tickDueKamins(deps: EngineDeps): Promise<TickSummary> {
  if (!deps.sb) {
    console.warn("[kamin] tick: permissive-dev (no Supabase)");
    return { mode: "permissive-dev", due: 0, completed: 0, failed: 0, newMatches: 0 };
  }
  const due = await claimDueKamins(deps.sb);
  if (due === null) {
    // m12 not run yet: legacy racy GET+filter path, loud warn (round-1 pattern).
    console.warn(
      "[kamin] claim_due_kamins RPC missing — legacy racy tick. Run supabase/m12-kamin-claim.sql."
    );
    return legacyTickDue(deps.sb, deps);
  }
  let completed = 0;
  let failed = 0;
  let newMatches = 0;
  for (const k of due) {
    const r = await checkKamin(deps, k);
    if (r.status === "failed") failed++;
    else {
      completed++;
      newMatches += r.newCount;
    }
  }
  return { mode: "real", due: due.length, completed, failed, newMatches };
}

/** Scheduler lease: a crashed tick's kamins become claimable again after this. */
const CLAIM_LEASE_SECS = 600;

/**
 * Atomic scheduler claim (finding #13, m12). One statement claims every
 * due kamin and stamps claimed_at — a concurrent tick's claim sees zero
 * rows for the same kamin (FOR UPDATE SKIP LOCKED). Returns null when the
 * RPC is not installed (404) — the caller falls back to the legacy path.
 */
async function claimDueKamins(sb: Sb): Promise<KaminRow[] | null> {
  try {
    const rows = await sb.rest<KaminRow[]>("POST", "/rpc/claim_due_kamins", {
      p_lease_secs: CLAIM_LEASE_SECS,
    });
    return rows;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/**
 * Pre-m12 tick path: GET all active + JS due-filter. Racy by construction
 * (finding #13: overlapping ticks double-execute) — kept only until the
 * migration runs, then never taken.
 */
async function legacyTickDue(sb: Sb, deps: EngineDeps): Promise<TickSummary> {
  const rows = await sb.rest<KaminRow[]>(
    "GET",
    "kamins?status=eq.active&select=*"
  );
  const now = deps.now();
  const due = rows.filter(
    (k) =>
      !k.last_checked_at ||
      now - Date.parse(k.last_checked_at) >= cadenceMs(k.cadence)
  );
  let completed = 0;
  let failed = 0;
  let newMatches = 0;
  for (const k of due) {
    const r = await checkKamin(deps, k);
    if (r.status === "failed") failed++;
    else {
      completed++;
      newMatches += r.newCount;
    }
  }
  return { mode: "real", due: due.length, completed, failed, newMatches };
}
