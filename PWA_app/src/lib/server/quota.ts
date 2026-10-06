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
 * Race note: read-check-PATCH is not a true transaction (no row lock via
 * PostgREST). The window is tiny at our volumes; a Postgres RPC with a real
 * transaction is the M5 hardening. Documented, not hidden.
 */

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
    await sb.rest("GET", "devices?select=device_id&limit=0");
    return true;
  } catch {
    return false;
  }
}

async function activeTierHunts(sb: Sb, userId: string): Promise<number | null> {
  try {
    const rows = await sb.rest<Array<{ tier: string; status: string }>>(
      "GET",
      `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=tier,status&limit=1`
    );
    const sub = rows[0];
    if (!sub || sub.status !== "active") return null;
    return TIER_HUNTS[sub.tier] ?? null;
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

async function consumeStandard(sb: Sb, userId: string, tierHunts: number): Promise<QuotaDecision> {
  const q = encodeURIComponent(userId);
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

async function consumeGuest(sb: Sb, deviceId: string): Promise<QuotaDecision> {
  const d = encodeURIComponent(deviceId);
  let rows = await sb.rest<Array<{ free_hunts_used: number }>>(
    "GET",
    `devices?device_id=eq.${d}&select=free_hunts_used`
  );
  if (rows.length === 0) {
    await sb.rest("POST", "devices", { device_id: deviceId, free_hunts_used: 0 });
    rows = [{ free_hunts_used: 0 }];
  }
  const used = rows[0].free_hunts_used;
  if (used >= GUEST_FREE_HUNTS) {
    return {
      allowed: false,
      reason: "guest-exhausted",
      message: "شکارهای رایگان این دستگاه تموم شد.",
    };
  }
  await sb.rest("PATCH", `devices?device_id=eq.${d}`, { free_hunts_used: used + 1 });
  return {
    allowed: true,
    mode: "real",
    kind: "guest",
    remaining: GUEST_FREE_HUNTS - used - 1,
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
    const d = encodeURIComponent(opts.deviceId);
    try {
      const rows = await sb.rest<Array<{ free_hunts_used: number }>>(
        "GET",
        `devices?device_id=eq.${d}&select=free_hunts_used`
      );
      const used = rows[0]?.free_hunts_used ?? 1;
      await sb.rest("PATCH", `devices?device_id=eq.${d}`, {
        free_hunts_used: Math.max(0, used - 1),
      });
    } catch (e) {
      console.warn("[quota] guest refund failed:", (e as Error).message);
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
      await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
        hunts_used: Math.max(0, row.hunts_used - 1),
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
