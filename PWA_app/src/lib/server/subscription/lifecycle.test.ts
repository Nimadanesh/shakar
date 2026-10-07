import { describe, expect, it, vi } from "vitest";

import {
  tomanFromUsd,
  DOLLAR_PEG_TOMAN,
  TIER_USD,
  currentPrices,
} from "./prices";
import {
  createIntent,
  activateSubscription,
  expireCheck,
  renewSubscription,
  reindexPrices,
  SubscriptionError,
  type SubscriptionRow,
} from "./lifecycle";

/**
 * PAPER TESTS — in-memory Sb fake. They prove the lifecycle logic
 * (idempotency, sleep/wake wiring, price math); the REAL proof is the
 * live run against Supabase with navid's test key.
 */

type Row = Record<string, unknown>;

function makeSb() {
  const tables: Record<string, Row[]> = {
    subscriptions: [],
    quota_counters: [],
    app_settings: [{ key: "dollar_rate_toman", value: "270000" }],
    tier_prices: [],
    kamins: [],
  };
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];

  function pick(path: string): { table: string; filters: Array<[string, string, string]> } {
    const [table, qs = ""] = path.split("?");
    const filters: Array<[string, string, string]> = [];
    for (const part of qs.split("&")) {
      if (!part || part.startsWith("select=") || part.startsWith("order=") || part.startsWith("limit=")) continue;
      const m = part.match(/^([^=]+)=eq\.(.*)$/);
      if (m) filters.push([m[1], "eq", decodeURIComponent(m[2])]);
      const mi = part.match(/^([^=]+)=in\.\((.*)\)$/);
      if (mi) filters.push([mi[1], "in", mi[2]]);
    }
    return { table, filters };
  }

  const sb = {
    calls,
    tables,
    async rest<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
      calls.push({ method, path, body });
      const { table, filters } = pick(path);
      const rows = tables[table] ?? [];
      const match = (r: Row) =>
        filters.every(([col, op, val]) => {
          const v = r[col];
          if (op === "eq") return String(v) === val;
          if (op === "in") return val.split(",").includes(String(v));
          return true;
        });
      if (method === "GET") {
        const limit = Number(path.match(/limit=(\d+)/)?.[1] ?? "1000");
        return rows.filter(match).slice(0, limit) as T;
      }
      if (method === "POST") {
        const row = { ...(body as Row) };
        if (!row.id) row.id = `id-${rows.length + 1}`;
        rows.push(row);
        return [row] as T;
      }
      if (method === "PATCH") {
        const matched = rows.filter(match);
        for (const r of matched) Object.assign(r, body);
        return matched as T;
      }
      throw new Error(`unsupported ${method}`);
    },
  };
  return sb;
}

function sub(over: Partial<Row> = {}): Row {
  return {
    id: "sub-1",
    user_id: "user-1",
    tier: "herfei",
    status: "pending",
    billing: "monthly",
    price_usd: 4.4444,
    price_toman: 1200000,
    annual_locked_toman: null,
    seats_total: 1,
    seats_used: 0,
    cycle_started_at: null,
    cycle_ends_at: null,
    last_renewal_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe("tomanFromUsd", () => {
  it("reproduces the lock-list prices exactly at the 270k peg", () => {
    const cases: Array<[number, number]> = [
      [0.7407, 200000],
      [7.4074, 2000000],
      [4.4444, 1200000],
      [44.4444, 12000000],
      [11.1111, 3000000],
      [111.1111, 30000000],
      [29.6296, 8000000],
      [296.2963, 80000000],
      [111.1111, 30000000],
      [1111.1111, 300000000],
    ];
    for (const [usd, toman] of cases) {
      expect(tomanFromUsd(usd, DOLLAR_PEG_TOMAN)).toBe(toman);
    }
  });

  it("rounds to the nearest 10k (199,989 → 200,000)", () => {
    expect(tomanFromUsd(0.7407, DOLLAR_PEG_TOMAN)).toBe(200000);
  });
});

describe("currentPrices", () => {
  it("derives from USD × rate when no tier_prices rows exist", async () => {
    const sb = makeSb();
    const prices = await currentPrices(sb as never);
    expect(prices).toHaveLength(10);
    const paye = prices.find((p) => p.tier === "paye" && p.billing === "monthly");
    expect(paye?.toman).toBe(200000);
    expect(paye?.usd).toBe(TIER_USD.paye.monthly);
  });
});

describe("createIntent", () => {
  it("is idempotent per user — second call returns the existing row", async () => {
    const sb = makeSb();
    const first = await createIntent(sb as never, "user-1", "vizhe", "annual");
    expect(first.created).toBe(true);
    expect(first.subscription.status).toBe("pending");
    expect(first.subscription.billing).toBe("annual");
    // annual locks its Toman price at purchase
    expect(first.subscription.annual_locked_toman).toBe(30000000);

    const second = await createIntent(sb as never, "user-1", "paye", "monthly");
    expect(second.created).toBe(false);
    expect(second.subscription.id).toBe(first.subscription.id);
    expect(sb.tables.subscriptions).toHaveLength(1);
  });

  it("rejects unknown tiers", async () => {
    const sb = makeSb();
    await expect(createIntent(sb as never, "user-1", "diamond", "monthly")).rejects.toThrow(
      SubscriptionError
    );
  });
});

describe("activateSubscription", () => {
  it("pending → active: cycle set, quotas reset, kamins wake with tier slots", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(sub({ status: "pending", tier: "herfei" }));
    // two sleeping kamins + one already active
    sb.tables.kamins.push(
      { id: "k1", user_id: "user-1", status: "sleeping" },
      { id: "k2", user_id: "user-1", status: "sleeping" },
      { id: "k3", user_id: "user-1", status: "active" }
    );

    const active = await activateSubscription(sb as never, "user-1", "sub-1");
    expect(active.status).toBe("active");
    expect(active.cycle_started_at).not.toBeNull();
    expect(active.cycle_ends_at).not.toBeNull();
    // ~1 month cycle
    const ms =
      new Date(active.cycle_ends_at!).getTime() - new Date(active.cycle_started_at!).getTime();
    expect(ms).toBeGreaterThan(27 * 24 * 3600 * 1000);
    expect(ms).toBeLessThan(32 * 24 * 3600 * 1000);

    // quota cycle reset
    const qc = sb.tables.quota_counters[0];
    expect(qc?.user_id).toBe("user-1");
    expect(qc?.hunts_used).toBe(0);

    // herfei has 3 slots, 1 already active → both sleeping kamins wake
    const statuses = sb.tables.kamins.map((k) => k.status);
    expect(statuses).toEqual(["active", "active", "active"]);
  });

  it("refuses to activate someone else's intent", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(sub({ status: "pending" }));
    await expect(
      activateSubscription(sb as never, "user-2", "sub-1")
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("enforces the 20-seat almas cap", async () => {
    const sb = makeSb();
    for (let i = 0; i < 20; i++) {
      sb.tables.subscriptions.push(
        sub({ id: `almas-${i}`, user_id: `u-${i}`, tier: "almas", status: "active" })
      );
    }
    sb.tables.subscriptions.push(
      sub({ id: "sub-1", user_id: "user-1", tier: "almas", status: "pending" })
    );
    await expect(
      activateSubscription(sb as never, "user-1", "sub-1")
    ).rejects.toMatchObject({ code: "seats-full" });
  });
});

describe("expireCheck", () => {
  it("flips a past-due cycle to expired and sleeps active kamins", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(
      sub({
        status: "active",
        cycle_ends_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    sb.tables.kamins.push(
      { id: "k1", user_id: "user-1", status: "active" },
      { id: "k2", user_id: "user-1", status: "active" }
    );

    const result = await expireCheck(sb as never, "user-1");
    expect(result?.status).toBe("expired");
    expect(sb.tables.kamins.map((k) => k.status)).toEqual(["sleeping", "sleeping"]);
  });

  it("leaves a live cycle untouched", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(
      sub({
        status: "active",
        cycle_ends_at: new Date(Date.now() + 86400000).toISOString(),
      })
    );
    const result = await expireCheck(sb as never, "user-1");
    expect(result?.status).toBe("active");
    expect(sb.calls.some((c) => c.method === "PATCH" && c.path.includes("kamins"))).toBe(false);
  });
});

describe("renewSubscription", () => {
  it("extends the cycle from the later of now/end, resets quotas, wakes kamins", async () => {
    const sb = makeSb();
    const ended = new Date(Date.now() - 5000).toISOString();
    sb.tables.subscriptions.push(
      sub({ status: "expired", billing: "monthly", cycle_ends_at: ended })
    );
    sb.tables.kamins.push({ id: "k1", user_id: "user-1", status: "sleeping" });

    const { subscription, renewed } = await renewSubscription(
      sb as never,
      "user-1",
      "sub-1",
      "key-1"
    );
    expect(renewed).toBe(true);
    expect(subscription.status).toBe("active");
    expect(new Date(subscription.cycle_ends_at!).getTime()).toBeGreaterThan(Date.now());
    expect(subscription.last_renewal_key).toBe("key-1");
    expect(sb.tables.kamins[0].status).toBe("active");
  });

  it("is idempotent per idempotency key — a double call is a no-op", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(
      sub({ status: "active", billing: "monthly", last_renewal_key: "key-1" })
    );
    const first = await renewSubscription(sb as never, "user-1", "sub-1", "key-1");
    expect(first.renewed).toBe(false);
    const second = await renewSubscription(sb as never, "user-1", "sub-1", "key-2");
    expect(second.renewed).toBe(true);
  });
});

describe("reindexPrices", () => {
  it("records the new rate and inserts 10 fresh price rows", async () => {
    const sb = makeSb();
    const result = await reindexPrices(sb as never, 300000);
    expect(result.dollarRate).toBe(300000);
    expect(result.dollarClause).toBe(false);
    expect(result.prices).toHaveLength(10);
    expect(sb.tables.tier_prices).toHaveLength(10);
    const paye = result.prices.find((p) => p.tier === "paye" && p.billing === "monthly");
    expect(paye?.toman).toBe(tomanFromUsd(0.7407, 300000));
    const setting = sb.tables.app_settings.find((s) => s.key === "dollar_rate_toman");
    expect(setting?.value).toBe("300000");
  });

  it("flags the 350k dollar clause", async () => {
    const sb = makeSb();
    const result = await reindexPrices(sb as never, 360000);
    expect(result.dollarClause).toBe(true);
  });

  it("rejects invalid rates", async () => {
    const sb = makeSb();
    await expect(reindexPrices(sb as never, -5)).rejects.toMatchObject({
      code: "invalid-rate",
    });
  });

  it("never rewrites existing subscription rows (annuals grandfathered)", async () => {
    const sb = makeSb();
    sb.tables.subscriptions.push(
      sub({ status: "active", billing: "annual", price_toman: 30000000, annual_locked_toman: 30000000 })
    );
    await reindexPrices(sb as never, 400000);
    const kept = sb.tables.subscriptions[0];
    expect(kept.price_toman).toBe(30000000);
    expect(kept.annual_locked_toman).toBe(30000000);
  });
});

describe("wake-slot integration", () => {
  it("wakeKaminsForUser is the function the lifecycle calls (import sanity)", async () => {
    const mod = await import("../kamin/engine");
    expect(typeof mod.wakeKaminsForUser).toBe("function");
    expect(typeof mod.sleepKaminsForUser).toBe("function");
    void vi;
  });
});
