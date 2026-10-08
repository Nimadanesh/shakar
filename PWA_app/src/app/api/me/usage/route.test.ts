/**
 * GET /api/me/usage — cross-device profile numbers.
 * Mocks auth, quota tier lookup, and PostgREST; exercises the REAL handler:
 * real user/guest branching, real 14-day bucketing, real graceful fallback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/server/quota", () => ({
  activeTierHunts: vi.fn(),
  activeTierKey: vi.fn(),
  TIER_HUNTS: { paye: 20, herfei: 130, vizhe: 350, namayandegi: 1000, almas: 500 },
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { getSessionUserId } from "@/lib/server/auth";
import { activeTierHunts, activeTierKey } from "@/lib/server/quota";
import { GET } from "@/app/api/me/usage/route";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);
const mockSession = vi.mocked(getSessionUserId);
const mockTier = vi.mocked(activeTierHunts);
const mockTierKey = vi.mocked(activeTierKey);

const UID = "11111111-1111-4111-8111-111111111111";
const DID = "22222222-2222-4222-8222-222222222222";

function event(hoursAgo: number): { fired_at: string } {
  return { fired_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() };
}

/**
 * An event timestamped in the MIDDLE of the oldest daily bucket (index 0),
 * robust to the time of day the test runs: bucket 0 spans
 * [startOfToday - 13d, startOfToday - 12d), so its midpoint is
 * startOfToday - 12.5d regardless of the current hour.
 */
function eventInOldestBucket(): { fired_at: string } {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const mid = startOfToday.getTime() - 12.5 * 24 * 3_600_000;
  return { fired_at: new Date(mid).toISOString() };
}

/** Minimal PostgREST fake: table reads keyed by path prefix. */
function fakeSb(tables: Record<string, unknown[]>, failEvents = false) {
  return {
    rest: vi.fn(async (method: string, path: string) => {
      if (path.startsWith("quota_counters")) return tables.quota_counters ?? [];
      if (path.startsWith("devices")) return tables.devices ?? [];
      if (path.startsWith("hunt_events")) {
        if (failEvents) {
          const e = new Error("relation hunt_events does not exist");
          (e as { status?: number }).status = 404;
          throw e;
        }
        return tables.hunt_events ?? [];
      }
      if (path.startsWith("subscriptions")) return tables.subscriptions ?? [];
      if (path.startsWith("kamins")) return tables.kamins ?? [];
      throw new Error(`unexpected path ${path}`);
    }),
  };
}

function get(headers: Record<string, string> = {}) {
  return GET(new Request("http://x/api/me/usage", { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  mockSession.mockResolvedValue(null);
  mockTier.mockResolvedValue(null);
  mockTierKey.mockResolvedValue(null);
});

describe("subscribed user", () => {
  it("returns tier quota truth with 14-day buckets", async () => {
    mockSession.mockResolvedValue(UID);
    mockTier.mockResolvedValue(130);
    mockTierKey.mockResolvedValue("herfei");
    mockServer.mockReturnValue(fakeSb({
      quota_counters: [{ hunts_used: 5 }],
      // 3 hunts today, 1 yesterday, 1 in the oldest bucket (edge of window).
      hunt_events: [event(1), event(2), event(3), event(26), eventInOldestBucket()],
      kamins: [{ id: "k1" }, { id: "k2" }],
    }) as never);

    const res = await get();
    const json = await res.json();
    expect(json.ok).toBe(true);
    const d = json.data;
    expect(d.kind).toBe("user");
    expect(d.usedThisMonth).toBe(5);
    expect(d.quotaTotal).toBe(130);
    expect(d.remaining).toBe(125);
    expect(d.daily).toHaveLength(14);
    // Oldest → newest: index 13 = today.
    expect(d.daily[13]).toBe(3);
    expect(d.daily[12]).toBe(1);
    expect(d.daily[0]).toBe(1);
    expect(d.daily.reduce((a: number, b: number) => a + b, 0)).toBe(5);
    // Kamin quota: herfei → 3 slots, 2 active.
    expect(d.kaminSlots).toBe(3);
    expect(d.kaminActive).toBe(2);
  });

  it("clamps remaining at zero when over quota", async () => {
    mockSession.mockResolvedValue(UID);
    mockTier.mockResolvedValue(20);
    mockTierKey.mockResolvedValue("paye");
    mockServer.mockReturnValue(fakeSb({
      quota_counters: [{ hunts_used: 25 }],
      hunt_events: [],
      kamins: [{ id: "k1" }],
    }) as never);

    const json = await (await get()).json();
    expect(json.data.usedThisMonth).toBe(25);
    expect(json.data.remaining).toBe(0);
    expect(json.data.kaminSlots).toBe(1);
    expect(json.data.kaminActive).toBe(1);
  });

  it("reports null kamin fields when the kamins table is missing", async () => {
    mockSession.mockResolvedValue(UID);
    mockTier.mockResolvedValue(130);
    mockTierKey.mockResolvedValue("herfei");
    const sb = fakeSb({
      quota_counters: [{ hunts_used: 5 }],
      hunt_events: [],
    });
    sb.rest = vi.fn(async (method: string, path: string) => {
      if (path.startsWith("kamins")) {
        const e = new Error("table missing");
        (e as { status?: number }).status = 404;
        throw e;
      }
      if (path.startsWith("quota_counters")) return [{ hunts_used: 5 }];
      if (path.startsWith("hunt_events")) return [];
      throw new Error(`unexpected path ${path}`);
    });
    mockServer.mockReturnValue(sb as never);

    const json = await (await get()).json();
    expect(json.data.usedThisMonth).toBe(5);
    expect(json.data.kaminSlots).toBe(3);
    expect(json.data.kaminActive).toBeNull();
  });
});

describe("guest", () => {
  it("returns device grant truth", async () => {
    mockServer.mockReturnValue(fakeSb({
      devices: [{ free_hunts_used: 2, free_hunts_granted: 3 }],
      hunt_events: [event(1), event(50)],
    }) as never);

    const json = await (await get({ "x-device-id": DID })).json();
    const d = json.data;
    expect(d.kind).toBe("guest");
    expect(d.usedThisMonth).toBe(2);
    expect(d.quotaTotal).toBe(3);
    expect(d.remaining).toBe(1);
    expect(d.daily[13]).toBe(1);
    expect(d.daily[11]).toBe(1);
    expect(d.kaminSlots).toBeNull();
    expect(d.kaminActive).toBeNull();
  });

  it("registered-but-unsubscribed falls back to the guest pool", async () => {
    mockSession.mockResolvedValue(UID);
    mockTier.mockResolvedValue(null); // no active subscription
    mockServer.mockReturnValue(fakeSb({
      devices: [{ free_hunts_used: 0, free_hunts_granted: 3 }],
      hunt_events: [],
    }) as never);

    const json = await (await get({ "x-device-id": DID })).json();
    expect(json.data.kind).toBe("guest");
  });
});

describe("graceful degradation", () => {
  it("returns data null when supabase is not configured", async () => {
    mockConfigured.mockReturnValue(false);
    const json = await (await get({ "x-device-id": DID })).json();
    expect(json.ok).toBe(true);
    expect(json.data).toBeNull();
  });

  it("returns data null with no identity at all", async () => {
    mockServer.mockReturnValue(fakeSb({}) as never);
    const json = await (await get()).json();
    expect(json.data).toBeNull();
  });

  it("serves numbers with zeroed chart when hunt_events is missing (m7 pending)", async () => {
    mockSession.mockResolvedValue(UID);
    mockTierKey.mockResolvedValue("herfei");
    mockServer.mockReturnValue(fakeSb(
      { quota_counters: [{ hunts_used: 7 }] },
      true // hunt_events 404s
    ) as never);

    const json = await (await get()).json();
    expect(json.data.usedThisMonth).toBe(7);
    expect(json.data.daily).toEqual(Array(14).fill(0));
  });
});
