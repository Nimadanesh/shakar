import "server-only";

import { supabaseServer, supabaseConfigured } from "@/lib/supabase-server";

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
const TIER_HUNTS: Record<string, number> = {
  paye: 20,
  herfei: 130,
  vizhe: 350,
  namayandegi: 1000,
  almas: 500,
};
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
function warnMissing(what: string) {
  if (!warnedMissing) {
    warnedMissing = true;
    console.warn(
      `[quota] permissive-dev mode: ${what}. Run PWA_app/supabase/m4b-quota.sql in the Supabase SQL Editor to enforce real quotas.`
    );
  }
}

async function tablesExist(sb: Sb): Promise<boolean> {
  try {
    await sb.rest("GET", "quota_counters?select=user_id&limit=0");
    // Live devices schema: id uuid PK (there is no device_id column —
    // checking for it silently disabled all quota enforcement in prod).
    await sb.rest("GET", "devices?select=id&limit=0");
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

/** Active subscription's tier key (paye/herfei/…), or null when unsubscribed. */
export async function activeTierKey(sb: Sb, userId: string): Promise<string | null> {
  try {
    const rows = await sb.rest<Array<{ tier: string; status: string }>>(
      "GET",
      `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=tier,status&limit=1`
    );
    const sub = rows[0];
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
}): Promise<QuotaDecision> {
  const sb = supabaseConfigured() ? supabaseServer() : null;
  if (!sb || !(await tablesExist(sb))) {
    warnMissing(!sb ? "Supabase not configured" : "M4b tables missing");
    return { allowed: true, mode: "permissive-dev", kind: "guest", remaining: null, userId: opts.userId };
  }

  // Authenticated with an active subscription → tier quota.
  if (opts.userId) {
    const tierHunts = await activeTierHunts(sb, opts.userId);
    if (tierHunts !== null) {
      return consumeStandard(sb, opts.userId, tierHunts);
    }
    // Registered but unsubscribed → guest pool (documented above).
  }
  return consumeGuest(sb, opts.deviceId);
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
    await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, { notified_85: true });
    await fire85Notification(sb, userId, tierHunts - newUsed);
  }
  return { allowed: true, mode: "real", kind: "standard", remaining: tierHunts - newUsed, userId };
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

async function consumeGuest(sb: Sb, deviceId: string): Promise<QuotaDecision> {
  const d = encodeURIComponent(deviceId);

  const atomic = await rpcConsumeGuest(sb, deviceId);
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
    };
  }

  console.warn(
    "[quota] consume_guest_hunt RPC missing — legacy racy read-check-PATCH. " +
      "Run supabase/m6-quota-atomic.sql."
  );
  // Live devices schema: id uuid PK (no device_id column).
  let rows = await sb.rest<Array<{ free_hunts_used: number; free_hunts_granted: number }>>(
    "GET",
    `devices?id=eq.${d}&select=free_hunts_used,free_hunts_granted`
  );
  if (rows.length === 0) {
    await sb.rest("POST", "devices", {
      id: deviceId,
      fingerprint_hash: deviceId,
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
}): Promise<RefundResult> {
  if (opts.mode !== "real") return { refunded: false, note: "noop" };
  const sb = supabaseServer();
  if (!sb) return { refunded: false, note: "noop" };

  if (opts.kind === "guest" || !opts.userId) {
    try {
      // Atomic decrement (never below zero); falls back to the legacy
      // read-modify-write when the RPC is not installed yet.
      await sb.rest("POST", "/rpc/refund_guest_hunt", {
        p_device_id: opts.deviceId,
      });
    } catch (e) {
      if (isMissingRpc(e)) {
        const d = encodeURIComponent(opts.deviceId);
        try {
          const rows = await sb.rest<Array<{ free_hunts_used: number }>>(
            "GET",
            `devices?id=eq.${d}&select=free_hunts_used`
          );
          const used = rows[0]?.free_hunts_used ?? 1;
          await sb.rest("PATCH", `devices?id=eq.${d}`, {
            free_hunts_used: Math.max(0, used - 1),
          });
        } catch (inner) {
          console.warn("[quota] guest refund failed:", (inner as Error).message);
        }
      } else {
        console.warn("[quota] guest refund failed:", (e as Error).message);
      }
    }
    return { refunded: true, note: "refunded" };
  }

  const q = encodeURIComponent(opts.userId);
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
