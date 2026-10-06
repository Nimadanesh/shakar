import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { consumeHunt, refundHunt } from "./quota";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);

/** Tiny in-memory PostgREST fake. */
function fakeDb(seed: Record<string, Array<Record<string, unknown>>> = {}) {
  const tables: Record<string, Array<Record<string, unknown>>> = JSON.parse(JSON.stringify(seed));
  const calls: Array<{ method: string; path: string }> = [];
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path });
    const [table] = path.split("?");
    if (!(table in tables)) {
      const e = new Error(`table ${table} missing`);
      (e as unknown as { status: number }).status = 404;
      throw e;
    }
    if (method === "GET") {
      const m = path.match(/(\w+)=eq\.([^&]+)/);
      if (!m) return tables[table];
      const [, col, val] = m;
      return tables[table].filter((r) => String(r[col]) === decodeURIComponent(val));
    }
    if (method === "POST") {
      tables[table].push(body as Record<string, unknown>);
      return body;
    }
    if (method === "PATCH") {
      const m = path.match(/(\w+)=eq\.([^&]+)/);
      const [, col, val] = m!;
      let n = 0;
      for (const r of tables[table]) {
        if (String(r[col]) === decodeURIComponent(val)) {
          Object.assign(r, body);
          n++;
        }
      }
      return { updated: n };
    }
    throw new Error("unsupported");
  });
  return { rest, calls, tables };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consumeHunt", () => {
  it("permissive-dev when Supabase is not configured", async () => {
    mockConfigured.mockReturnValue(false);
    const d = await consumeHunt({ userId: "u1", deviceId: "d1" });
    expect(d).toMatchObject({ allowed: true, mode: "permissive-dev" });
  });

  it("permissive-dev when M4b tables are missing", async () => {
    mockConfigured.mockReturnValue(true);
    mockServer.mockReturnValue({ rest: fakeDb({}).rest } as never);
    const d = await consumeHunt({ userId: "u1", deviceId: "d1" });
    expect(d).toMatchObject({ allowed: true, mode: "permissive-dev" });
  });

  it("guest: first hunt creates the device row, remaining counts down", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d1 = await consumeHunt({ userId: null, deviceId: "d9" });
    expect(d1).toMatchObject({ allowed: true, mode: "real", kind: "guest", remaining: 2 });
    const d2 = await consumeHunt({ userId: null, deviceId: "d9" });
    expect(d2).toMatchObject({ remaining: 1 });
  });

  it("guest: denied after 3 free hunts, honest Persian copy", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [{ device_id: "dx", free_hunts_used: 3 }] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: null, deviceId: "dx" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toBe("guest-exhausted");
      expect(d.message).not.toMatch(/تومان|قیمت|خرید/); // no pricing language
    }
  });

  it("standard: consumes from tier quota and fires the 85% notification once", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({
      quota_counters: [{ user_id: "u2", hunts_used: 16, notified_85: false }],
      devices: [],
      subscriptions: [{ user_id: "u2", tier: "paye", status: "active" }],
      notifications: [],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: "u2", deviceId: "d2" });
    // paye = 20 hunts; 17 used → remaining 3, and 17 >= ceil(0.85*20)=17 → notify.
    expect(d).toMatchObject({ allowed: true, kind: "standard", remaining: 3 });
    expect(db.tables.notifications).toHaveLength(1);
    expect(db.tables.notifications[0].title).toContain("سهمیه");
    // Second hunt: no duplicate notification.
    await consumeHunt({ userId: "u2", deviceId: "d2" });
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("standard: denied when the tier quota is exhausted", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({
      quota_counters: [{ user_id: "u3", hunts_used: 20, notified_85: true }],
      devices: [],
      subscriptions: [{ user_id: "u3", tier: "paye", status: "active" }],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: "u3", deviceId: "d3" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("no-quota");
  });

  it("registered-but-unsubscribed falls back to the guest pool", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: "u9", deviceId: "d9" });
    expect(d).toMatchObject({ allowed: true, kind: "guest", remaining: 2 });
  });
});

describe("refundHunt", () => {
  it("refunds within the 3/day innocent window", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({
      quota_counters: [
        {
          user_id: "u4",
          hunts_used: 5,
          refunds_today: 1,
          refund_day: new Date().toISOString().slice(0, 10),
          warnings: 0,
        },
      ],
      devices: [],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const r = await refundHunt({ userId: "u4", deviceId: "d4", kind: "standard", mode: "real" });
    expect(r).toMatchObject({ refunded: true, note: "refunded" });
    expect(db.tables.quota_counters[0].hunts_used).toBe(4);
  });

  it("suspends after 6+ zero-result hunts in a day", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({
      quota_counters: [
        {
          user_id: "u5",
          hunts_used: 9,
          refunds_today: 6,
          refund_day: new Date().toISOString().slice(0, 10),
          warnings: 2,
        },
      ],
      devices: [],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const r = await refundHunt({ userId: "u5", deviceId: "d5", kind: "standard", mode: "real" });
    expect(r).toMatchObject({ refunded: false, note: "suspended" });
    expect(db.tables.quota_counters[0].suspended_until).toBeTruthy();
  });

  it("guest refund decrements the device counter", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({
      quota_counters: [],
      devices: [{ device_id: "dg", free_hunts_used: 2 }],
    });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const r = await refundHunt({ userId: null, deviceId: "dg", kind: "guest", mode: "real" });
    expect(r.refunded).toBe(true);
    expect(db.tables.devices[0].free_hunts_used).toBe(1);
  });

  it("noop in permissive-dev mode", async () => {
    const r = await refundHunt({ userId: "u", deviceId: "d", kind: "standard", mode: "permissive-dev" });
    expect(r).toMatchObject({ refunded: false, note: "noop" });
  });
});
