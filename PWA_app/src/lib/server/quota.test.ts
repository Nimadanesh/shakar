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
function fakeDb(
  seed: Record<string, Array<Record<string, unknown>>> = {},
  opts: { rpc?: boolean } = {}
) {
  const tables: Record<string, Array<Record<string, unknown>>> = JSON.parse(JSON.stringify(seed));
  const calls: Array<{ method: string; path: string }> = [];

  const missing = (what: string): never => {
    const e = new Error(`${what} missing`);
    (e as unknown as { status: number }).status = 404;
    throw e;
  };

  /** Simulate the m6-quota-atomic.sql RPCs (single-statement, atomic). */
  const rpc = (path: string, body: Record<string, unknown>) => {
    if (path === "/rpc/consume_hunt_unit") {
      const { p_user_id: uid, p_limit: limit } = body as { p_user_id: string; p_limit: number };
      let row = tables.quota_counters.find((r) => r.user_id === uid);
      if (!row) {
        row = { user_id: uid, hunts_used: 0, notified_85: false, suspended_until: null };
        tables.quota_counters.push(row);
      }
      if (row.suspended_until && new Date(String(row.suspended_until)).getTime() > Date.now()) {
        return [{ allowed: false, reason: "suspended", hunts_used: row.hunts_used, notified_85: row.notified_85 }];
      }
      if ((row.hunts_used as number) >= limit) {
        return [{ allowed: false, reason: "no-quota", hunts_used: row.hunts_used, notified_85: row.notified_85 }];
      }
      row.hunts_used = (row.hunts_used as number) + 1;
      return [{ allowed: true, reason: "ok", hunts_used: row.hunts_used, notified_85: row.notified_85 }];
    }
    if (path === "/rpc/consume_guest_hunt") {
      const { p_device_id: did, p_limit: limit } = body as { p_device_id: string; p_limit: number };
      let row = tables.devices.find((r) => r.id === did);
      if (!row) {
        row = { id: did, fingerprint_hash: did, free_hunts_granted: limit, free_hunts_used: 0 };
        tables.devices.push(row);
      }
      const granted = (row.free_hunts_granted as number) ?? limit;
      if ((row.free_hunts_used as number) >= granted) {
        return [{ allowed: false, reason: "guest-exhausted", free_hunts_used: row.free_hunts_used, free_hunts_granted: granted }];
      }
      row.free_hunts_used = (row.free_hunts_used as number) + 1;
      return [{ allowed: true, reason: "ok", free_hunts_used: row.free_hunts_used, free_hunts_granted: granted }];
    }
    if (path === "/rpc/refund_hunt_unit") {
      const row = tables.quota_counters.find((r) => r.user_id === (body as { p_user_id: string }).p_user_id);
      if (row) row.hunts_used = Math.max(0, (row.hunts_used as number) - 1);
      return null;
    }
    if (path === "/rpc/refund_guest_hunt") {
      const row = tables.devices.find((r) => r.id === (body as { p_device_id: string }).p_device_id);
      if (row) row.free_hunts_used = Math.max(0, (row.free_hunts_used as number) - 1);
      return null;
    }
    if (path === "/rpc/check_guest_ip_limit") {
      // Models the fixed m14: pg_advisory_xact_lock serializes per-IP, so
      // in JS (single-threaded) this is inherently atomic. The count
      // includes the current hit; allowed iff count <= limit.
      const { p_ip: ip, p_limit: limit } = body as { p_ip: string; p_limit: number };
      (tables.guest_ip_hits ??= []).push({ ip, hit_at: new Date().toISOString() });
      const n = (tables.guest_ip_hits ?? []).filter((r) => r.ip === ip).length;
      return [{ allowed: n <= limit }];
    }
    return missing(`rpc ${path}`);
  };

  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path });
    if (path.startsWith("/rpc/")) {
      if (!opts.rpc) return missing(`rpc ${path}`);
      return rpc(path, (body ?? {}) as Record<string, unknown>);
    }
    const [table] = path.split("?");
    if (!(table in tables)) return missing(`table ${table}`);
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
      // Honor every eq. filter (PostgREST ANDs them), return the updated rows
      // like Prefer: return=representation does.
      const filters = [...path.matchAll(/(\w+)=eq\.([^&]+)/g)].map((m) => ({
        col: m[1],
        val: decodeURIComponent(m[2]),
      }));
      const updated: Array<Record<string, unknown>> = [];
      for (const r of tables[table]) {
        const match =
          filters.length === 0 ||
          filters.every((f) => {
            const v = r[f.col];
            // boolean eq.false/eq.true handling
            if (f.val === "false") return v === false;
            if (f.val === "true") return v === true;
            return String(v) === f.val;
          });
        if (match) {
          Object.assign(r, body);
          updated.push(r);
        }
      }
      return updated;
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
    const db = fakeDb({ quota_counters: [], devices: [{ id: "dx", free_hunts_used: 3, free_hunts_granted: 3 }] });
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

  it("standard: atomic RPC path denies exactly at the limit (finding #5)", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [{ user_id: "u3", hunts_used: 20, notified_85: true }],
        devices: [],
        subscriptions: [{ user_id: "u3", tier: "paye", status: "active" }],
        notifications: [],
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);
    // paye = 20: 20 used → denied, and the RPC (not read-check-PATCH) decided.
    const d = await consumeHunt({ userId: "u3", deviceId: "d3" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("no-quota");
    expect(db.calls.some((c) => c.path === "/rpc/consume_hunt_unit")).toBe(true);
    expect(db.tables.quota_counters[0].hunts_used).toBe(20); // not incremented
  });

  it("standard: atomic RPC path increments and fires 85% via conditional PATCH", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [{ user_id: "u4", hunts_used: 16, notified_85: false }],
        devices: [],
        subscriptions: [{ user_id: "u4", tier: "paye", status: "active" }],
        notifications: [],
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: "u4", deviceId: "d4" });
    // 17 used → remaining 3; 17 >= ceil(0.85*20)=17 → exactly one notification.
    expect(d).toMatchObject({ allowed: true, remaining: 3 });
    expect(db.tables.quota_counters[0].hunts_used).toBe(17);
    expect(db.tables.notifications).toHaveLength(1);
    await consumeHunt({ userId: "u4", deviceId: "d4" });
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("guest: atomic RPC path consumes and denies at 3 (finding #5)", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] }, { rpc: true });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d1 = await consumeHunt({ userId: null, deviceId: "dg" });
    expect(d1).toMatchObject({ allowed: true, remaining: 2 });
    expect(db.calls.some((c) => c.path === "/rpc/consume_guest_hunt")).toBe(true);
    await consumeHunt({ userId: null, deviceId: "dg" });
    await consumeHunt({ userId: null, deviceId: "dg" });
    const d4 = await consumeHunt({ userId: null, deviceId: "dg" });
    expect(d4.allowed).toBe(false);
    expect(db.tables.devices[0].free_hunts_used).toBe(3); // never exceeds
  });

  it("registered-but-unsubscribed falls back to the guest pool", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const d = await consumeHunt({ userId: "u9", deviceId: "d9" });
    expect(d).toMatchObject({ allowed: true, kind: "guest", remaining: 2 });
  });

  it("finding #15: registered-unsubscribed is keyed by user_id, not device_id", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] }, { rpc: true });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    // Same account, rotating device ids → still ONE guest pool.
    await consumeHunt({ userId: "u10", deviceId: "d-a" });
    await consumeHunt({ userId: "u10", deviceId: "d-b" });
    await consumeHunt({ userId: "u10", deviceId: "d-c" });
    const d4 = await consumeHunt({ userId: "u10", deviceId: "d-d" });
    expect(d4.allowed).toBe(false);
    if (!d4.allowed) expect(d4.reason).toBe("guest-exhausted");
    // The pool row is keyed by the account, not any device id.
    expect(db.tables.devices).toHaveLength(1);
    expect(db.tables.devices[0].id).toBe("u10");
  });

  it("finding #15: IP velocity cap stops device-id rotation", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] }, { rpc: true });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const ip = "203.0.113.7";
    // 20 fresh device ids from one IP → all allowed (generous cap).
    for (let i = 0; i < 20; i++) {
      const d = await consumeHunt({ userId: null, deviceId: `rot-${i}`, ip });
      expect(d.allowed).toBe(true);
    }
    // 21st → IP cap denies, even with a fresh device id.
    const denied = await consumeHunt({ userId: null, deviceId: "rot-20", ip });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.reason).toBe("guest-exhausted");
  });

  it("finding #15: IP cap fail-open when the RPC is missing", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb({ quota_counters: [], devices: [] }, { rpc: false });
    mockServer.mockReturnValue({ rest: db.rest } as never);
    // Legacy path: no IP RPC → still consumes via the device row.
    const d = await consumeHunt({ userId: null, deviceId: "dg2", ip: "203.0.113.8" });
    expect(d.allowed).toBe(true);
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
      devices: [{ id: "dg", free_hunts_used: 2, free_hunts_granted: 3 }],
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
