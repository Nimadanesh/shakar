import { describe, expect, it, vi } from "vitest";

import {
  armKamin,
  cadenceMs,
  checkKamin,
  kaminCanonicalKey,
  pageBudgetForElapsed,
  tickDueKamins,
  KaminError,
  type EngineDeps,
  type KaminRow,
  type PushPayload,
} from "./engine";
import type {
  Candidate,
  HuntDefinition,
  ScoredAd,
} from "@/lib/server/hunt/pipeline";

/** Tiny in-memory PostgREST fake (eq filters, limit, POST/PATCH/DELETE). */
function fakeSb(seed: Record<string, Array<Record<string, unknown>>> = {}) {
  const tables: Record<string, Array<Record<string, unknown>>> = JSON.parse(
    JSON.stringify(seed)
  );
  const calls: Array<{ method: string; path: string }> = [];
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path });
    const qIdx = path.indexOf("?");
    const table = qIdx === -1 ? path : path.slice(0, qIdx);
    if (!(table in tables)) {
      const e = new Error(`table ${table} missing`);
      (e as unknown as { status: number }).status = 404;
      throw e;
    }
    const params = new URLSearchParams(qIdx === -1 ? "" : path.slice(qIdx + 1));
    const filters: Array<[string, string]> = [];
    let limit: number | null = null;
    for (const [k, v] of params) {
      if (k === "select" || k === "order") continue;
      if (k === "limit") {
        limit = parseInt(v, 10);
        continue;
      }
      if (v.startsWith("eq.")) filters.push([k, v.slice(3)]);
    }
    const match = (r: Record<string, unknown>) =>
      filters.every(([c, v]) => String(r[c]) === v);
    if (method === "GET") {
      let rows = tables[table].filter(match);
      if (limit !== null) rows = rows.slice(0, limit);
      return rows;
    }
    if (method === "POST") {
      const row = { ...(body as Record<string, unknown>) };
      tables[table].push(row);
      return [row];
    }
    if (method === "PATCH") {
      const updated: Array<Record<string, unknown>> = [];
      for (const r of tables[table]) {
        if (match(r)) {
          Object.assign(r, body);
          updated.push(r);
        }
      }
      return updated;
    }
    if (method === "DELETE") {
      tables[table] = tables[table].filter((r) => !match(r));
      return [];
    }
    throw new Error(`unsupported ${method}`);
  });
  return { rest, calls, tables };
}

const DEF: HuntDefinition = {
  query: "پیانو",
  include: ["یاماها"],
  exclude: [],
  city: "all",
  category: "music",
  priceMin: "",
  priceMax: "",
  transaction: "",
  condition: "",
};

function kaminRow(over: Partial<KaminRow> = {}): KaminRow {
  return {
    id: "k1",
    user_id: "u1",
    name: "پیانو یاماها",
    definition: DEF,
    canonical_key: kaminCanonicalKey(DEF),
    status: "active",
    cadence: "hourly",
    seen_ids: [],
    last_checked_at: null,
    last_success_at: null,
    new_match_count: 0,
    armed_at: "2026-10-06T10:00:00.000Z",
    ...over,
  };
}

function cand(id: string): Candidate {
  return {
    sourceAdId: id,
    title: "پیانو یاماها",
    price: null,
    city: "تهران",
    titleStrength: 1,
    needsDetailReview: false,
  };
}

function scored(id: string): ScoredAd {
  return {
    sourceAdId: id,
    title: "پیانو یاماها",
    price: null,
    city: "تهران",
    score: 1,
    breakdown: { title: 1, description: 1, priceKnown: 0 },
    evidence: [],
  };
}

const NOW = new Date("2026-10-06T12:00:00.000Z").getTime();

function testDeps(
  sb: ReturnType<typeof fakeSb> | null,
  opts: {
    candidates?: Candidate[];
    collectThrows?: boolean;
    confirmRejects?: Set<string>;
  } = {}
) {
  const pushed: PushPayload[] = [];
  const confirmedBatches: string[][] = [];
  let n = 0;
  const deps: EngineDeps = {
    sb: (sb?.rest ? { rest: sb.rest } : null) as EngineDeps["sb"],
    now: () => NOW,
    uuid: () => `run-${++n}`,
    collect: async () => {
      if (opts.collectThrows) throw new Error("provider cooldown");
      return { candidates: opts.candidates ?? [] };
    },
    confirm: async (cands) => {
      confirmedBatches.push(cands.map((c) => c.sourceAdId));
      const ids = cands
        .map((c) => c.sourceAdId)
        .filter((id) => !opts.confirmRejects?.has(id));
      return ids.map(scored);
    },
    sendPush: async (_u, p) => {
      pushed.push(p);
    },
  };
  return { deps, pushed, confirmedBatches };
}

describe("kaminCanonicalKey", () => {
  it("ignores term order and whitespace", () => {
    const a: HuntDefinition = { ...DEF, include: ["یاماها", "آکوستیک"] };
    const b: HuntDefinition = { ...DEF, include: ["  آکوستیک ", "یاماها"] };
    expect(kaminCanonicalKey(a)).toBe(kaminCanonicalKey(b));
  });

  it("distinguishes different meanings", () => {
    const other: HuntDefinition = { ...DEF, include: ["رولند"] };
    expect(kaminCanonicalKey(other)).not.toBe(kaminCanonicalKey(DEF));
  });
});

describe("cadence + page budget", () => {
  it("maps tier cadences to ms", () => {
    expect(cadenceMs("hourly")).toBe(3600 * 1000);
    expect(cadenceMs("bogus")).toBe(24 * 3600 * 1000);
  });

  it("budgets ~1 page per 30min since last success, clamped 2..20", () => {
    expect(pageBudgetForElapsed(0)).toBe(2);
    expect(pageBudgetForElapsed(29 * 60 * 1000)).toBe(2);
    expect(pageBudgetForElapsed(90 * 60 * 1000)).toBe(5);
    expect(pageBudgetForElapsed(48 * 3600 * 1000)).toBe(20);
  });
});

describe("armKamin", () => {
  it("dedupes by canonical key — same meaning returns the existing kamin", async () => {
    const sb = fakeSb({ kamins: [], notifications: [], kamin_runs: [] });
    const { deps } = testDeps(sb);
    const first = await armKamin(deps.sb!, {
      userId: "u1",
      name: "پیانو",
      definition: DEF,
      seenIds: ["a"],
      tier: "herfei",
    });
    expect(first.created).toBe(true);
    const again: HuntDefinition = { ...DEF, include: ["یاماها"] };
    const second = await armKamin(deps.sb!, {
      userId: "u1",
      name: "پیانو دوباره",
      definition: again,
      seenIds: [],
      tier: "herfei",
    });
    expect(second.created).toBe(false);
    expect(second.kamin.id).toBe(first.kamin.id);
    expect(sb.tables.kamins).toHaveLength(1);
  });

  it("enforces tier slots", async () => {
    const sb = fakeSb({ kamins: [kaminRow() as unknown as Record<string, unknown>], notifications: [], kamin_runs: [] });
    const { deps } = testDeps(sb);
    const other: HuntDefinition = { ...DEF, query: "گیتار" };
    await expect(
      armKamin(deps.sb!, {
        userId: "u1",
        name: "گیتار",
        definition: other,
        seenIds: [],
        tier: "paye", // 1 slot, already taken
      })
    ).rejects.toBeInstanceOf(KaminError);
  });

  it("arms SLEEPING without a subscription (guest funnel)", async () => {
    const sb = fakeSb({ kamins: [], notifications: [], kamin_runs: [] });
    const { deps } = testDeps(sb);
    const { kamin, created } = await armKamin(deps.sb!, {
      userId: "u1",
      name: "پیانو",
      definition: DEF,
      seenIds: [],
      tier: null,
    });
    expect(created).toBe(true);
    expect(kamin.status).toBe("sleeping");
  });
});

describe("checkKamin", () => {
  it("first successful check is a SILENT baseline — never push for old ads", async () => {
    const k = kaminRow(); // last_success_at null
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, { candidates: [cand("a"), cand("b")] });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("baseline");
    expect(r.newCount).toBe(0);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    expect(row.seen_ids).toEqual(expect.arrayContaining(["a", "b"]));
    expect(row.last_success_at).not.toBeNull();
  });

  it("diffs against seen_ids and confirms ONLY new ids", async () => {
    const k = kaminRow({
      seen_ids: ["a"],
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed, confirmedBatches } = testDeps(sb, {
      candidates: [cand("a"), cand("b"), cand("c")],
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(2);
    // details only for the new ids — never re-fetched for "a"
    expect(confirmedBatches).toEqual([["b", "c"]]);
    // notification: one per (kamin, check_run), locked copy
    expect(sb.tables.notifications).toHaveLength(1);
    const n = sb.tables.notifications[0] as unknown as Record<string, unknown>;
    expect(n.type).toBe("new_kamin_match");
    expect(n.title).toBe("۲ آگهی تازه");
    expect(n.body).toBe("کمین «پیانو یاماها» — بزن ببین.");
    expect(n.check_run_id).toBe("run-1");
    // push sent with deep link
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      title: "۲ آگهی تازه",
      url: "/saved?tab=fresh",
      tag: "kamin-k1",
    });
    // baseline advanced, success window moved
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    expect(row.seen_ids).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(row.last_success_at).toBe(new Date(NOW).toISOString());
    expect(row.new_match_count).toBe(2);
  });

  it("a failed check never moves the baseline (flaw #6)", async () => {
    const k = kaminRow({
      seen_ids: ["a"],
      last_success_at: "2026-10-06T09:00:00.000Z",
      last_checked_at: "2026-10-06T09:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, { collectThrows: true });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("failed");
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    // last_success_at untouched → next run catches up since last SUCCESS
    expect(row.last_success_at).toBe("2026-10-06T09:00:00.000Z");
    expect(row.seen_ids).toEqual(["a"]);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
    const run = sb.tables.kamin_runs[0] as unknown as Record<string, unknown>;
    expect(run.status).toBe("failed");
  });

  it("no new matches → silent, baseline still advances the window", async () => {
    const k = kaminRow({
      seen_ids: ["a", "b"],
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, { candidates: [cand("a"), cand("b")] });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(0);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
  });
});

describe("tickDueKamins", () => {
  it("only runs due kamins", async () => {
    const due = kaminRow({
      id: "k1",
      last_checked_at: "2026-10-06T10:00:00.000Z", // 2h ago, hourly → due
      last_success_at: "2026-10-06T10:00:00.000Z",
    });
    const fresh = kaminRow({
      id: "k2",
      last_checked_at: "2026-10-06T11:55:00.000Z", // 5 min ago → not due
      last_success_at: "2026-10-06T11:55:00.000Z",
    });
    const sleeping = kaminRow({ id: "k3", status: "sleeping" });
    const sb = fakeSb({
      kamins: [
        due as unknown as Record<string, unknown>,
        fresh as unknown as Record<string, unknown>,
        sleeping as unknown as Record<string, unknown>,
      ],
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [cand("z")] });
    const summary = await tickDueKamins(deps);
    expect(summary).toMatchObject({ mode: "real", due: 1 });
    // k1's second check: last_success_at was set → diff path, "z" is new
    const n = sb.tables.notifications[0] as unknown as Record<string, unknown>;
    expect(n.related_kamin_id).toBe("k1");
  });

  it("permissive-dev without Supabase", async () => {
    const { deps } = testDeps(null);
    const summary = await tickDueKamins(deps);
    expect(summary.mode).toBe("permissive-dev");
  });
});
