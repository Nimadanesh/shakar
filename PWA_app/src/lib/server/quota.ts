import "server-only";

import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";
import { expireCheck } from "@/lib/server/subscription/lifecycle";
import { TIERS } from "@/lib/tiers";

/**
 * M4b quota engine (blueprint §2 — transactional intent, §9 — guest hunts).
 *
 * Modes:
 *  - "real": Supabase is configured AND the M4b tables exist → quotas
 *    enforced, 85% notification fired, zero-result refunds with the abuse
 *    ladder.
 *  - "permissive-dev": anything missing → hunts allowed, loudly logged.
 *    Never silently burns quota, never silently blocks.
 *
 * Authenticated users WITHOUT an active subscription share the guest pool
 * (3 free hunts/device) — the conversion funnel wants tasters, and it keeps
 * the demo working before real subscriptions exist.
 *
 * Concurrency (finding #5, bug-bounty 2026-10-06): consume is an ATOMIC
 * check-and-increment via the consume_hunt_unit / consume_guest_hunt RPCs
 * (supabase/m6-quota-atomic.sql) — a single statement with a row lock, so
 * two racing requests can never both slip past the limit. If the RPCs are
 * not installed yet, the code falls back to the legacy read-check-PATCH
 * with a loud warning (racy — run the migration).
 */


/**
 * The RPC functions may not be installed yet (navid runs the migration
 * manually). A 404 from PostgREST means "function missing" → fall back.
 * Duck-typed on status: the test mock replaces supabase-server without
 * exporting the SupabaseError class.
 */
function isMissingRpc(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: unknown }).status === 404
  );
}

// Locked tier quotas — shakar-lock-list.md / blueprint §1.3 (hunts/mo).
// Derived from @/lib/tiers (the client-safe single source of truth) so
// server enforcement can never drift from the plans UI.
export const TIER_HUNTS: Record<string, number> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.huntsPerMonth])
);
const GUEST_FREE_HUNTS = 3;

export type QuotaMode = "real" | "permissive-dev";
export type QuotaKind = "standard" | "guest";

export interface QuotaGrant {
  allowed: true;
  mode: QuotaMode;
  kind: QuotaKind;
  /** Null in permissive mode. */
  remaining: number | null;
  userId: string | null;
  /**
   * The pool the unit was consumed from — userId for subscribers AND for
   * registered-but-unsubscribed (finding #15), deviceId for true guests.
   * MUST be threaded to refundHunt: the kind field alone ("guest" for both
   * unsubscribed cases) cannot distinguish them, and refunding the wrong
   * pool burns the user's unit forever (money bug, navid 2026-10-08).
   */
  poolKey: string;
}

export interface QuotaDeny {
  allowed: false;
  reason: "no-quota" | "suspended" | "guest-exhausted";
  message: string;
}

export type QuotaDecision = QuotaGrant | QuotaDeny;

interface Sb {
  rest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T>;
}

let warnedMissing = false;
let tablesKnownGood = false;
function warnMissing(what: string) {
  if (!warnedMissing) {
    warnedMissing = true;
    console.warn(
      `[quota] permissive-dev mode: ${what}. Run PWA_app/supabase/m4b-quota.sql in the Supabase SQL Editor to enforce real quotas.`
    );
  }
}

async function tablesExist(sb: Sb): Promise<boolean> {
  // Positive-only cache: the migrations don't un-run, so two probe
  // round-trips per hunt fire is pure waste. A transient failure simply
  // retries next time (never cached negative → never stuck fail-open).
  if (tablesKnownGood) return true;
  try {
    await sb.rest("GET", "quota_counters?select=user_id&limit=0");
    // Live devices schema: id uuid PK (there is no device_id column —
    // checking for it silently disabled all quota enforcement in prod).
    await sb.rest("GET", "devices?select=id&limit=0");
    tablesKnownGood = true;
    return true;
  } catch {
    return false;
  }
}

/** Active subscription's monthly hunt quota, or null when unsubscribed. */
export async function activeTierHunts(sb: Sb, userId: string): Promise<number | null> {
  const tier = await activeTierKey(sb, userId);
  if (!tier) return null;
  return TIER_HUNTS[tier] ?? null;
}

/** Active subscription's tier key (paye/herfei/…), or null when unsubscribed.
 *
 * Expiry-aware (M6 gap fix, navid 2026-10-08): a past-due cycle flips
 * active → expired — and sleeps the kamins — right here, inside the quota
 * decision. The old code only read `status`, so a lapsed subscription kept
 * granting tier quota (and its kamins kept checking) until GET
 * /api/subscription happened to run expireCheck. When the cycle is still
 * valid this is a single read, same as before.
 */
export async function activeTierKey(sb: Sb, userId: string): Promise<string | null> {
  try {
    const sub = await expireCheck(sb, userId);
    if (!sub || sub.status !== "active") return null;
    return sub.tier;
  } catch {
    return null;
  }
}

async function fire85Notification(sb: Sb, userId: string, remaining: number): Promise<void> {
  try {
    await sb.rest("POST", "notifications", {
      user_id: userId,
      type: "quota",
      title: "سهمیه‌ی شکار داره تموم می‌شه",
      body: `۸۵٪ سهمیه‌ی ماهت مصرف شده — ${remaining} شکار دیگه مونده.`,
    });
  } catch (e) {
    console.warn("[quota] 85% notification failed:", (e as Error).message);
  }
}

export async function consumeHunt(opts: {
  userId: string | null;
  deviceId: string;
  /** Client IP for the guest velocity cap (finding #15). Null when unknown. */
  ip?: string | null;
}): Promise<QuotaDecision> {
  const sb = supabaseConfigured() ? supabaseServer() : null;
  if (!sb || !(await tablesExist(sb))) {
    warnMissing(!sb ? "Supabase not configured" : "M4b tables missing");
    return {
      allowed: true,
      mode: "permissive-dev",
      kind: "guest",
      remaining: null,
      userId: opts.userId,
      poolKey: opts.userId ?? opts.deviceId,
    };
  }

  // Authenticated with an active subscription → tier quota.
  if (opts.userId) {
    const tierHunts = await activeTierHunts(sb, opts.userId);
    if (tierHunts !== null) {
      return consumeStandard(sb, opts.userId, tierHunts);
    }
    // Registered but unsubscribed → guest pool, but keyed by user_id
    // (finding #15): x-device-id is a client claim and trivially
    // rotated; the account id is not.
    return consumeGuest(sb, opts.userId, opts.ip ?? null);
  }
  return consumeGuest(sb, opts.deviceId, opts.ip ?? null);
}

/**
 * Atomic consume via the consume_hunt_unit RPC. Returns null when the RPC
 * is not installed (404) — the caller falls back to the legacy path.
 */
async function rpcConsumeStandard(
  sb: Sb,
  userId: string,
  tierHunts: number
): Promise<{
  allowed: boolean;
  reason: string;
  hunts_used: number;
  notified_85: boolean;
} | null> {
  try {
    const rows = await sb.rest<
      Array<{ allowed: boolean; reason: string; hunts_used: number; notified_85: boolean }>
    >("POST", "/rpc/consume_hunt_unit", { p_user_id: userId, p_limit: tierHunts });
    return rows[0] ?? null;
  } catch (e) {
    if (isMissingRpc(e)) return null;
    throw e;
  }
}

async function consumeStandard(sb: Sb, userId: string, tierHunts: number): Promise<QuotaDecision> {
  const q = encodeURIComponent(userId);

  const atomic = await rpcConsumeStandard(sb, userId, tierHunts);
  if (atomic) {
    if (!atomic.allowed) {
      return atomic.reason === "suspended"
        ? {
            allowed: false,
            reason: "suspended",
            message: "فعالیت غیرعادی شناسایی شد — شکار فعلاً متوقفه.",
          }
        : {
            allowed: false,
            reason: "no-quota",
            message: "سهمیه‌ی شکار این ماهت تموم شد.",
          };
    }
    // 85% notification — the PATCH is conditional (notified_85=eq.false) so
    // racing requests can't double-fire; only the winner notifies.
    if (!atomic.notified_85 && atomic.hunts_used >= Math.ceil(0.85 * tierHunts)) {
      const updated = await sb.rest<Array<unknown>>(
        "PATCH",
        `quota_counters?user_id=eq.${q}&notified_85=eq.false`,
        { notified_85: true }
      );
      if (Array.isArray(updated) && updated.length > 0) {
        await fire85Notification(sb, userId, tierHunts - atomic.hunts_used);
      }
    }
    return {
      allowed: true,
      mode: "real",
      kind: "standard",
      remaining: tierHunts - atomic.hunts_used,
      userId,
      poolKey: userId,
    };
  }

  console.warn(
    "[quota] consume_hunt_unit RPC missing — legacy racy read-check-PATCH. " +
      "Run supabase/m6-quota-atomic.sql."
  );
  let rows = await sb.rest<Array<Record<string, unknown>>>(
    "GET",
    `quota_counters?user_id=eq.${q}&select=hunts_used,suspended_until,notified_85`
  );
  if (rows.length === 0) {
    await sb.rest("POST", "quota_counters", { user_id: userId });
    rows = [{ hunts_used: 0, suspended_until: null, notified_85: false }];
  }
  const row = rows[0];
  const used = Number(row.hunts_used ?? 0);

  const suspendedUntil = row.suspended_until ? new Date(String(row.suspended_until)) : null;
  if (suspendedUntil && suspendedUntil.getTime() > Date.now()) {
    return {
      allowed: false,
      reason: "suspended",
      message: "فعالیت غیرعادی شناسایی شد — شکار فعلاً متوقفه.",
    };
  }
  if (used >= tierHunts) {
    return {
      allowed: false,
      reason: "no-quota",
      message: "سهمیه‌ی شکار این ماهت تموم شد.",
    };
  }

  const newUsed = used + 1;
  await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, { hunts_used: newUsed });

  if (!row.notified_85 && newUsed >= Math.ceil(0.85 * tierHunts)) {
    // Conditional PATCH (notified_85=eq.false) — racing legacy requests
    // can't double-fire; only the winner notifies. Same as the atomic path.
    const updated = await sb.rest<Array<unknown>>(
      "PATCH",
      `quota_counters?user_id=eq.${q}&notified_85=eq.false`,
      { notified_85: true }
    );
    if (Array.isArray(updated) && updated.length > 0) {
      await fire85Notification(sb, userId, tierHunts - newUsed);
    }
  }
  return { allowed: true, mode: "real", kind: "standard", remaining: tierHunts - newUsed, userId, poolKey: userId };
}

async function rpcConsumeGuest(
  sb: Sb,
  deviceId: string
): Promise<{
  allowed: boolean;
  reason: string;
  free_hunts_used: number;
  free_hunts_granted: number;
} | null> {
  try {
    const rows = await sb.rest<
      Array<{
        allowed: boolean;
        reason: string;
        free_hunts_used: number;
        free_hunts_granted: number;
      }>
    >("POST", "/rpc/consume_guest_hunt", {
      p_device_id: deviceId,
      p_limit: GUEST_FREE_HUNTS,
    });
    return rows[0] ?? null;
  } catch (e) {
    if (isMissingRpc(e)) return null;
    throw e;
  }
}

/** Best-effort client IP for the guest velocity cap (finding #15).
 *  Behind Railway/Vercel the real IP is the first x-forwarded-for entry. */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || null;
}

/** Free-hunt IP velocity cap (finding #15): even rotating device ids,
 *  one IP can't mint unlimited free hunts. Generous by design. */
const GUEST_IP_DAILY_LIMIT = 20;
const GUEST_IP_WINDOW_SECS = 24 * 60 * 60;

async function checkGuestIpLimit(sb: Sb, ip: string): Promise<boolean> {
  try {
    const rows = await sb.rest<Array<{ allowed: boolean }>>(
      "POST",
      "/rpc/check_guest_ip_limit",
      { p_ip: ip, p_limit: GUEST_IP_DAILY_LIMIT, p_window_secs: GUEST_IP_WINDOW_SECS }
    );
    return rows[0]?.allowed !== false;
  } catch (e) {
    if (isMissingRpc(e)) {
      console.warn(
        "[quota] check_guest_ip_limit RPC missing — IP velocity cap off. " +
          "Run supabase/m14-guest-ip-limit.sql."
      );
      return true; // fail-open: the device quota still applies
    }
    throw e;
  }
}

async function consumeGuest(
  sb: Sb,
  key: string,
  ip: string | null
): Promise<QuotaDecision> {
  const d = encodeURIComponent(key);

  // IP velocity cap first (finding #15): rotating device ids from one
  // IP still hits this. Checked before consuming so denied requests
  // don't burn the device grant.
  if (ip) {
    const ipAllowed = await checkGuestIpLimit(sb, ip);
    if (!ipAllowed) {
      return {
        allowed: false,
        reason: "guest-exhausted",
        message: "شکارهای رایگان امروز تموم شد — فردا دوباره امتحان کن.",
      };
    }
  }

  const atomic = await rpcConsumeGuest(sb, key);
  if (atomic) {
    if (!atomic.allowed) {
      return {
        allowed: false,
        reason: "guest-exhausted",
        message: "شکارهای رایگان این دستگاه تموم شد.",
      };
    }
    const granted = atomic.free_hunts_granted ?? GUEST_FREE_HUNTS;
    return {
      allowed: true,
      mode: "real",
      kind: "guest",
      remaining: granted - atomic.free_hunts_used,
      userId: null,
      poolKey: key,
    };
  }

  console.warn(
    "[quota] consume_guest_hunt RPC missing — legacy racy read-check-PATCH. " +
      "Run supabase/m6-quota-atomic.sql."
  );
  // Live devices schema: id uuid PK (no device_id column). `key` is the
  // device id for true guests, or the account id for registered-but-
  // unsubscribed users (finding #15) — both are uuids.
  let rows = await sb.rest<Array<{ free_hunts_used: number; free_hunts_granted: number }>>(
    "GET",
    `devices?id=eq.${d}&select=free_hunts_used,free_hunts_granted`
  );
  if (rows.length === 0) {
    await sb.rest("POST", "devices", {
      id: key,
      fingerprint_hash: key,
      free_hunts_used: 0,
      free_hunts_granted: GUEST_FREE_HUNTS,
    });
    rows = [{ free_hunts_used: 0, free_hunts_granted: GUEST_FREE_HUNTS }];
  }
  const used = rows[0].free_hunts_used ?? 0;
  const granted = rows[0].free_hunts_granted ?? GUEST_FREE_HUNTS;
  if (used >= granted) {
    return {
      allowed: false,
      reason: "guest-exhausted",
      message: "شکارهای رایگان این دستگاه تموم شد.",
    };
  }
  await sb.rest("PATCH", `devices?id=eq.${d}`, { free_hunts_used: used + 1 });
  return {
    allowed: true,
    mode: "real",
    kind: "guest",
    remaining: granted - used - 1,
    userId: null,
    poolKey: key,
  };
}

export interface RefundResult {
  refunded: boolean;
  note: "refunded" | "no-refund-warning" | "suspended" | "noop";
}

/**
 * Zero-result / pipeline-failure refund with the blueprint §2 abuse ladder:
 *  1–3/day → refund, assume innocence;
 *  4–6/day → no refund + warning;
 *  >6/day → 24h suspension.
 */
export async function refundHunt(opts: {
  userId: string | null;
  deviceId: string;
  kind: QuotaKind;
  mode: QuotaMode;
  /**
   * The pool the unit was consumed from (threaded from consumeHunt).
   * Falls back to deviceId for runs recorded before poolKey existed —
   * those predate the registered-unsubscribed keying anyway.
   */
  poolKey?: string | null;
}): Promise<RefundResult> {
  if (opts.mode !== "real") return { refunded: false, note: "noop" };
  const sb = supabaseServer();
  if (!sb) return { refunded: false, note: "noop" };

  if (opts.kind === "guest" || !opts.userId) {
    // THE pool key, not the device id: registered-but-unsubscribed users
    // consume from a userId-keyed pool (finding #15) — refunding the
    // deviceId pool instead burned their unit forever (money bug).
    const poolKey = opts.poolKey ?? opts.deviceId;
    try {
      const rows = await sb.rest<Array<{ allowed: boolean; outcome: string }>>(
        "POST",
        "/rpc/claim_guest_refund_slot",
        { p_device_id: poolKey, p_today: new Date().toISOString().slice(0, 10) }
      );
      const r = rows[0];
      if (!r) return { refunded: false, note: "noop" };
      if (r.outcome === "refund") return { refunded: true, note: "refunded" };
      // 3+ zero-result refunds today: no refund (lock-list guest cap).
      return { refunded: false, note: "no-refund-warning" };
    } catch (e) {
      if (!isMissingRpc(e)) {
        // Honest: the refund did NOT happen — never claim it did.
        console.warn("[quota] guest refund failed:", (e as Error).message);
        return { refunded: false, note: "noop" };
      }
      console.warn(
        "[quota] claim_guest_refund_slot RPC missing — legacy plain decrement. " +
          "Run supabase/m24-guest-refund-ladder.sql."
      );
    }
    try {
      // Atomic decrement (never below zero); falls back to the legacy
      // read-modify-write when the RPC is not installed yet.
      await sb.rest("POST", "/rpc/refund_guest_hunt", {
        p_device_id: poolKey,
      });
      return { refunded: true, note: "refunded" };
    } catch (e) {
      if (isMissingRpc(e)) {
        const d = encodeURIComponent(poolKey);
        try {
          const rows = await sb.rest<Array<{ free_hunts_used: number }>>(
            "GET",
            `devices?id=eq.${d}&select=free_hunts_used`
          );
          const used = rows[0]?.free_hunts_used ?? 1;
          await sb.rest("PATCH", `devices?id=eq.${d}`, {
            free_hunts_used: Math.max(0, used - 1),
          });
          return { refunded: true, note: "refunded" };
        } catch (inner) {
          console.warn("[quota] guest refund failed:", (inner as Error).message);
          return { refunded: false, note: "noop" };
        }
      }
      console.warn("[quota] guest refund failed:", (e as Error).message);
      return { refunded: false, note: "noop" };
    }
  }

  const q = encodeURIComponent(opts.userId);
  // Finding #5 (final round): the abuse ladder is now claimed atomically
  // via claim_refund_slot (m17) — the old GET+PATCH read-modify-write let
  // concurrent refunds bypass the 3/day cap. Falls back to the legacy
  // racy path with a loud warning when the RPC is not installed yet.
  try {
    const rows = await sb.rest<Array<{ allowed: boolean; outcome: string }>>(
      "POST",
      "/rpc/claim_refund_slot",
      { p_user_id: opts.userId, p_today: new Date().toISOString().slice(0, 10) }
    );
    const r = rows[0];
    if (!r) return { refunded: false, note: "noop" };
    if (r.outcome === "refund") return { refunded: true, note: "refunded" };
    if (r.outcome === "warning") return { refunded: false, note: "no-refund-warning" };
    if (r.outcome === "suspended") return { refunded: false, note: "suspended" };
    return { refunded: false, note: "noop" };
  } catch (e) {
    if (!isMissingRpc(e)) {
      console.warn("[quota] refund failed:", (e as Error).message);
      return { refunded: false, note: "noop" };
    }
    console.warn(
      "[quota] claim_refund_slot RPC missing — legacy racy refund ladder. " +
        "Run supabase/m17-refund-ladder-atomic.sql."
    );
  }
  try {
    const rows = await sb.rest<
      Array<{
        hunts_used: number;
        refunds_today: number;
        refund_day: string;
        warnings: number;
      }>
    >("GET", `quota_counters?user_id=eq.${q}&select=hunts_used,refunds_today,refund_day,warnings`);
    const row = rows[0];
    if (!row) return { refunded: false, note: "noop" };
    const today = new Date().toISOString().slice(0, 10);
    const refundsToday = row.refund_day === today ? row.refunds_today : 0;

    if (refundsToday < 3) {
      // Atomic decrement (finding #5); the ladder counters stay here.
      try {
        await sb.rest("POST", "/rpc/refund_hunt_unit", { p_user_id: opts.userId });
      } catch (e) {
        if (!isMissingRpc(e)) throw e;
        await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
          hunts_used: Math.max(0, row.hunts_used - 1),
        });
      }
      await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
        refunds_today: refundsToday + 1,
        refund_day: today,
      });
      return { refunded: true, note: "refunded" };
    }
    if (refundsToday < 6) {
      await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
        refunds_today: refundsToday + 1,
        refund_day: today,
        warnings: row.warnings + 1,
      });
      return { refunded: false, note: "no-refund-warning" };
    }
    await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
      refunds_today: refundsToday + 1,
      refund_day: today,
      suspended_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    return { refunded: false, note: "suspended" };
  } catch (e) {
    console.warn("[quota] refund failed:", (e as Error).message);
    return { refunded: false, note: "noop" };
  }
}
