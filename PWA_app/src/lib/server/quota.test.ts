import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { consumeHunt, refundHunt, activeTierKey } from "./quota";

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
    if (path === "/rpc/claim_refund_slot") {
      // Models m17: pg_advisory_xact_lock serializes per-user, so in JS
      // (single-threaded) this is inherently atomic. Day rollover resets
      // refunds_today; ladder: <3 refund, <6 warning, else suspension.
      const { p_user_id: uid, p_today: today } = body as { p_user_id: string; p_today: string };
      const row = tables.quota_counters.find((r) => r.user_id === uid);
      if (!row) return [{ allowed: false, outcome: "noop" }];
      const refunds = row.refund_day === today ? (row.refunds_today as number) : 0;
      if (refunds < 3) {
        row.hunts_used = Math.max(0, (row.hunts_used as number) - 1);
        row.refunds_today = refunds + 1;
        row.refund_day = today;
        return [{ allowed: true, outcome: "refund" }];
      }
      if (refunds < 6) {
        row.refunds_today = refunds + 1;
        row.refund_day = today;
        row.warnings = ((row.warnings as number) ?? 0) + 1;
        return [{ allowed: false, outcome: "warning" }];
      }
      row.refunds_today = refunds + 1;
      row.refund_day = today;
      row.suspended_until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      return [{ allowed: false, outcome: "suspended" }];
    }
    if (path === "/rpc/refund_guest_hunt") {
      const row = tables.devices.find((r) => r.id === (body as { p_device_id: string }).p_device_id);
      if (row) row.free_hunts_used = Math.max(0, (row.free_hunts_used as number) - 1);
      return null;
    }
    if (path === "/rpc/claim_guest_refund_slot") {
      // Models m24: advisory lock serializes per-pool; day rollover resets
      // zero_refunds_today; ladder: <3 refund, else no-refund.
      const { p_device_id: did, p_today: today } = body as { p_device_id: string; p_today: string };
      const row = tables.devices.find((r) => r.id === did);
      if (!row) return [{ allowed: false, outcome: "noop" }];
      const refunds = row.refund_day === today ? ((row.zero_refunds_today as number) ?? 0) : 0;
      if (refunds < 3) {
        row.free_hunts_used = Math.max(0, (row.free_hunts_used as number) - 1);
        row.zero_refunds_today = refunds + 1;
        row.refund_day = today;
        return [{ allowed: true, outcome: "refund" }];
      }
      row.zero_refunds_today = refunds + 1;
      row.refund_day = today;
      return [{ allowed: false, outcome: "no-refund" }];
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

  it("finding #5: 5 concurrent refunds with 2 used → exactly 1 wins (total 3)", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [
          {
            user_id: "u6",
            hunts_used: 10,
            refunds_today: 2,
            refund_day: new Date().toISOString().slice(0, 10),
            warnings: 0,
          },
        ],
        devices: [],
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        refundHunt({ userId: "u6", deviceId: "d6", kind: "standard", mode: "real" })
      )
    );
    const refunded = results.filter((r) => r.refunded).length;
    const warned = results.filter((r) => r.note === "no-refund-warning").length;
    const suspended = results.filter((r) => r.note === "suspended").length;
    // Exactly 1 refund (2+1=3 hits the cap); next 3 get warnings (3,4,5);
    // the 5th hits 6 → suspension. The ladder is a strict state machine.
    expect(refunded).toBe(1);
    expect(warned).toBe(3);
    expect(suspended).toBe(1);
    expect(db.tables.quota_counters[0].refunds_today).toBe(7);
    expect(db.tables.quota_counters[0].hunts_used).toBe(9); // one decrement
    expect(db.tables.quota_counters[0].warnings).toBe(3);
  });

  it("finding #5: warning path via atomic RPC (3-5/day)", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [
          {
            user_id: "u7",
            hunts_used: 10,
            refunds_today: 4,
            refund_day: new Date().toISOString().slice(0, 10),
            warnings: 1,
          },
        ],
        devices: [],
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const r = await refundHunt({ userId: "u7", deviceId: "d7", kind: "standard", mode: "real" });
    expect(r).toMatchObject({ refunded: false, note: "no-refund-warning" });
    // No hunts_used decrement on the warning path.
    expect(db.tables.quota_counters[0].hunts_used).toBe(10);
    expect(db.tables.quota_counters[0].warnings).toBe(2);
  });

  // MONEY BUG (navid 2026-10-08 deep review): a registered-but-unsubscribed
  // user consumes from a pool keyed by user_id (finding #15), but the old
  // refundHunt always decremented the deviceId-keyed pool — the consumed
  // unit was never given back. poolKey threads the truth through.
  it("registered-unsubscribed: refund returns the unit to the userId pool, not the device pool", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [],
        devices: [],
        subscriptions: [], // no subscription → guest pool, keyed by user_id
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);

    const grant = await consumeHunt({ userId: "u8", deviceId: "d8" });
    expect(grant).toMatchObject({ allowed: true, kind: "guest", poolKey: "u8" });
    // The consume created a devices row keyed by the USER id.
    const userPool = db.tables.devices.find((r) => r.id === "u8");
    expect(userPool?.free_hunts_used).toBe(1);

    const r = await refundHunt({
      userId: "u8",
      deviceId: "d8",
      kind: "guest",
      mode: "real",
      poolKey: grant.allowed ? grant.poolKey : "d8",
    });
    expect(r).toMatchObject({ refunded: true, note: "refunded" });
    expect(userPool?.free_hunts_used).toBe(0);
    // No phantom row was created for the device id.
    expect(db.tables.devices.find((r) => r.id === "d8")).toBeUndefined();
  });

  // HONESTY (navid 2026-10-08 deep review): the old code returned
  // refunded:true even when the refund RPC failed with a real error —
  // claiming a refund that never happened. Now it says noop.
  it("guest refund: real RPC failure → noop, never a phantom refund", async () => {
    mockConfigured.mockReturnValue(true);
    const db = fakeDb(
      {
        quota_counters: [],
        devices: [{ id: "dg2", free_hunts_used: 2, free_hunts_granted: 3 }],
      },
      { rpc: true }
    );
    const failing = vi.fn(async (method: string, path: string, body?: unknown) => {
      if (path === "/rpc/claim_guest_refund_slot") {
        const e = new Error("db exploded");
        (e as unknown as { status: number }).status = 500;
        throw e;
      }
      return db.rest(method, path, body);
    });
    mockServer.mockReturnValue({ rest: failing } as never);
    const r = await refundHunt({ userId: null, deviceId: "dg2", kind: "guest", mode: "real", poolKey: "dg2" });
    expect(r).toMatchObject({ refunded: false, note: "noop" });
    // The counter is untouched — no phantom refund.
    expect(db.tables.devices[0].free_hunts_used).toBe(2);
  });

  // ABUSE (navid 2026-10-08 deep review): guest zero-result refunds were
  // unlimited — infinite free hunts at real API cost. m24 caps at 3/day.
  it("guest refund ladder: 3 refunds/day, then no-refund", async () => {
    mockConfigured.mockReturnValue(true);
    const today = new Date().toISOString().slice(0, 10);
    const db = fakeDb(
      {
        quota_counters: [],
        devices: [
          {
            id: "dg3",
            free_hunts_used: 3,
            free_hunts_granted: 3,
            zero_refunds_today: 2,
            refund_day: today,
          },
        ],
      },
      { rpc: true }
    );
    mockServer.mockReturnValue({ rest: db.rest } as never);
    const opts = { userId: null, deviceId: "dg3", kind: "guest" as const, mode: "real" as const, poolKey: "dg3" };

    const r1 = await refundHunt(opts);
    expect(r1).toMatchObject({ refunded: true, note: "refunded" });
    expect(db.tables.devices[0].free_hunts_used).toBe(2);

    const r2 = await refundHunt(opts);
    expect(r2).toMatchObject({ refunded: false, note: "no-refund-warning" });
    // Cap hit: the counter is NOT decremented.
    expect(db.tables.devices[0].free_hunts_used).toBe(2);
    expect(db.tables.devices[0].zero_refunds_today).toBe(4);
  });
});

describe("activeTierKey — lazy expiry inside quota decisions", () => {
  it("past-due active subscription: flips to expired, sleeps kamins, grants no tier", async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const db = fakeDb({
      subscriptions: [
        { id: "s1", user_id: "u9", tier: "herfei", status: "active", cycle_ends_at: past },
      ],
      kamins: [{ id: "k1", user_id: "u9", status: "active" }],
    });
    const tier = await activeTierKey({ rest: db.rest } as never, "u9");
    // No tier quota for a lapsed subscription — the money bug this guards.
    expect(tier).toBeNull();
    expect(db.tables.subscriptions[0].status).toBe("expired");
    expect(db.tables.kamins[0].status).toBe("sleeping");
  });

  it("valid active subscription: tier granted, nothing written", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const db = fakeDb({
      subscriptions: [
        { id: "s2", user_id: "u8", tier: "vizhe", status: "active", cycle_ends_at: future },
      ],
      kamins: [],
    });
    const tier = await activeTierKey({ rest: db.rest } as never, "u8");
    expect(tier).toBe("vizhe");
    expect(db.tables.subscriptions[0].status).toBe("active");
    expect(db.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("no subscription: null, no crash", async () => {
    const db = fakeDb({ subscriptions: [], kamins: [] });
    const tier = await activeTierKey({ rest: db.rest } as never, "u0");
    expect(tier).toBeNull();
  });
});
