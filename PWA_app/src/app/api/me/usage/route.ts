import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { activeTierHunts, activeTierKey } from "@/lib/server/quota";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { tierByKey } from "@/lib/tiers";
import type { UsageData } from "@/lib/usage";

const DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * GET /api/me/usage — cross-device profile numbers.
 *
 * The profile's consumption section must be identical on every device, so
 * the numbers come from the server (quota_counters / devices), not
 * localStorage. The 14-day chart comes from hunt_events
 * (supabase/m7-hunt-events.sql).
 *
 * Registered-but-unsubscribed users share the guest pool (same rule as
 * consumeHunt) → reported as kind "guest".
 *
 * Never 500s: any failure returns { ok: true, data: null } and the client
 * falls back to its local history. Loud warn in the server log instead.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, data: null });
  const sb = supabaseServer();
  if (!sb) return NextResponse.json({ ok: true, data: null });

  try {
    const userId = await getSessionUserId();
    const rawDevice = req.headers.get("x-device-id")?.trim() ?? "";
    const deviceId = isUuid(rawDevice) ? rawDevice : null;

    if (userId) {
      const tierHunts = await activeTierHunts(sb, userId);
      if (tierHunts !== null) {
        return NextResponse.json({ ok: true, data: await userUsage(sb, userId, tierHunts) });
      }
      // Registered but unsubscribed → guest pool.
    }
    if (deviceId) {
      return NextResponse.json({ ok: true, data: await guestUsage(sb, deviceId) });
    }
    return NextResponse.json({ ok: true, data: null });
  } catch (e) {
    console.warn("[usage]", (e as Error).message);
    return NextResponse.json({ ok: true, data: null });
  }
}

async function userUsage(
  sb: NonNullable<ReturnType<typeof supabaseServer>>,
  userId: string,
  tierHunts: number
): Promise<UsageData> {
  const q = encodeURIComponent(userId);
  const rows = await sb.rest<Array<{ hunts_used: number | null }>>(
    "GET",
    `quota_counters?user_id=eq.${q}&select=hunts_used&limit=1`
  );
  const used = Number(rows[0]?.hunts_used ?? 0);
  const tier = tierByKey(await activeTierKey(sb, userId));
  let kaminActive: number | null = null;
  try {
    const kamins = await sb.rest<Array<{ id: string }>>(
      "GET",
      `kamins?user_id=eq.${q}&status=eq.active&select=id`
    );
    kaminActive = kamins.length;
  } catch (e) {
    console.warn("[usage] kamins read failed:", (e as Error).message);
  }
  return {
    kind: "user",
    usedThisMonth: used,
    quotaTotal: tierHunts,
    remaining: Math.max(0, tierHunts - used),
    daily: await dailyCounts(sb, `user_id=eq.${q}`),
    kaminSlots: tier?.kaminSlots ?? null,
    kaminActive,
  };
}

async function guestUsage(
  sb: NonNullable<ReturnType<typeof supabaseServer>>,
  deviceId: string
): Promise<UsageData> {
  const q = encodeURIComponent(deviceId);
  const rows = await sb.rest<
    Array<{ free_hunts_used: number | null; free_hunts_granted: number | null }>
  >("GET", `devices?id=eq.${q}&select=free_hunts_used,free_hunts_granted&limit=1`);
  const used = Number(rows[0]?.free_hunts_used ?? 0);
  const granted = Number(rows[0]?.free_hunts_granted ?? 3);
  return {
    kind: "guest",
    usedThisMonth: used,
    quotaTotal: granted,
    remaining: Math.max(0, granted - used),
    daily: await dailyCounts(sb, `device_id=eq.${q}`),
    kaminSlots: null,
    kaminActive: null,
  };
}

/**
 * Per-day hunt counts for the last DAYS days. The hunt_events table may
 * not exist yet (migration m7 pending) → zeros, never a failure.
 */
async function dailyCounts(
  sb: NonNullable<ReturnType<typeof supabaseServer>>,
  filter: string
): Promise<number[]> {
  const days: number[] = Array(DAYS).fill(0);
  try {
    const since = new Date(Date.now() - DAYS * DAY_MS).toISOString();
    const rows = await sb.rest<Array<{ fired_at: string }>>(
      "GET",
      `hunt_events?${filter}&fired_at=gte.${encodeURIComponent(since)}&select=fired_at&limit=500`
    );
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    for (const r of rows) {
      const t = new Date(r.fired_at).getTime();
      if (Number.isNaN(t)) continue;
      const idx = Math.floor((t - (startOfToday.getTime() - (DAYS - 1) * DAY_MS)) / DAY_MS);
      if (idx >= 0 && idx < DAYS) days[idx] += 1;
    }
  } catch (e) {
    console.warn("[usage] hunt_events read failed:", (e as Error).message);
  }
  return days;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
