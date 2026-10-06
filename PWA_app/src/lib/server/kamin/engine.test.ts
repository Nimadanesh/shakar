import { describe, expect, it, vi } from "vitest";

import {
  advanceKaminBaseline,
  armKamin,
  cadenceMs,
  checkKamin,
  kaminCanonicalKey,
  pageBudgetForElapsed,
  tickDueKamins,
  wakeKaminsForUser,
  KaminError,
  type EngineDeps,
  type KaminRow,
  type PushPayload,
  type Sb,
} from "./engine";
import type {
  Candidate,
  HuntDefinition,
  ScoredAd,
} from "@/lib/server/hunt/pipeline";

/** 404 shaped like the real SupabaseError (round-1 pattern). */
function notFound(what: string): never {
  const e = new Error(`${what} missing`);
  (e as unknown as { status: number }).status = 404;
  throw e;
}

/**
 * Models try_arm_kamin's SQL semantics: ONE synchronous block = the
 * advisory-lock-serialized transaction. True DB concurrency cannot run
 * in a JS fake (the event loop serializes synchronous blocks); the
 * single-transaction atomicity itself is verified on PGlite. What this
 * DOES prove: the app delegates check+insert to one RPC call, and honors
 * zero-rows → slots-full.
 */
function rpcTryArmKamin(
  tables: Record<string, Array<Record<string, unknown>>>,
  body: Record<string, unknown>,
  idSeq: { n: number }
): Array<{ kamin_id: string; created: boolean }> {
  const p = body as {
    p_user_id: string;
    p_name: string;
    p_definition: unknown;
    p_canonical_key: string;
    p_status: string;
    p_cadence: string;
    p_slots: number;
    p_seen_ids: string[];
  };
  const kamins = tables.kamins;
  const seen = (tables.kamin_seen_ads ??= []);
  const existing = kamins.find(
    (r) => r.user_id === p.p_user_id && r.canonical_key === p.p_canonical_key
  );
  if (existing) {
    if (existing.status === "active") return [{ kamin_id: existing.id as string, created: false }];
    const active = kamins.filter(
      (r) => r.user_id === p.p_user_id && r.status === "active"
    ).length;
    if (active >= p.p_slots) return [];
    existing.status = "active";
    existing.name = p.p_name;
    existing.definition = p.p_definition;
    return [{ kamin_id: existing.id as string, created: false }];
  }
  if (p.p_status === "active") {
    const active = kamins.filter(
      (r) => r.user_id === p.p_user_id && r.status === "active"
    ).length;
    if (active >= p.p_slots) return [];
  }
  const id = `k-rpc-${++idSeq.n}`;
  kamins.push({
    id,
    user_id: p.p_user_id,
    name: p.p_name,
    definition: p.p_definition,
    canonical_key: p.p_canonical_key,
    status: p.p_status,
    cadence: p.p_cadence,
    new_match_count: 0,
    armed_at: new Date().toISOString(),
    last_checked_at: null,
    last_success_at: null,
  });
  for (const sid of p.p_seen_ids ?? []) {
    if (!seen.some((r) => r.kamin_id === id && r.source_ad_id === sid)) {
      seen.push({ kamin_id: id, source_ad_id: sid, seen_at: new Date().toISOString() });
    }
  }
  return [{ kamin_id: id, created: true }];
}

/** Models kamin_mark_seen: single-statement insert, duplicates ignored. */
function rpcKaminMarkSeen(
  tables: Record<string, Array<Record<string, unknown>>>,
  body: Record<string, unknown>
): null {
  const p = body as { p_kamin_id: string; p_source_ad_ids: string[] };
  const seen = (tables.kamin_seen_ads ??= []);
  for (const sid of p.p_source_ad_ids ?? []) {
    if (!seen.some((r) => r.kamin_id === p.p_kamin_id && r.source_ad_id === sid)) {
      seen.push({ kamin_id: p.p_kamin_id, source_ad_id: sid, seen_at: new Date().toISOString() });
    }
  }
  return null;
}

/**
 * Models claim_due_kamins' SQL semantics: ONE synchronous block = the
 * single-statement atomic claim (FOR UPDATE SKIP LOCKED). True DB
 * concurrency cannot run in a JS fake (the event loop serializes
 * synchronous blocks); the statement-level atomicity itself is verified
 * live. What this DOES prove: the app delegates due-selection to one RPC
 * call, a second overlapping claim sees zero rows, and the lease lets a
 * stale claim become claimable again. Cadence intervals mirror the
 * migration's CASE (which mirrors the engine's CADENCE_MS).
 */
const CLAIM_CADENCE_MS: Record<string, number> = {
  "5min": 5 * 60 * 1000,
  "15min": 15 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function rpcClaimDueKamins(
  tables: Record<string, Array<Record<string, unknown>>>,
  body: Record<string, unknown>
): Array<Record<string, unknown>> {
  const leaseMs = (body as { p_lease_secs: number }).p_lease_secs * 1000;
  const nowMs = NOW;
  const claimed: Array<Record<string, unknown>> = [];
  for (const r of tables.kamins) {
    if (r.status !== "active") continue;
    const interval =
      CLAIM_CADENCE_MS[r.cadence as string] ?? CLAIM_CADENCE_MS.daily;
    const lastChecked = r.last_checked_at
      ? Date.parse(r.last_checked_at as string)
      : null;
    if (lastChecked !== null && nowMs - lastChecked < interval) continue;
    const claimedAt = r.claimed_at ? Date.parse(r.claimed_at as string) : null;
    if (claimedAt !== null && nowMs - claimedAt < leaseMs) continue;
    // Atomic claim: stamp inside the same synchronous block.
    r.claimed_at = new Date(nowMs).toISOString();
    claimed.push({ ...r });
  }
  claimed.sort((a, b) => {
    const x = a.last_checked_at ? Date.parse(a.last_checked_at as string) : -Infinity;
    const y = b.last_checked_at ? Date.parse(b.last_checked_at as string) : -Infinity;
    return x - y;
  });
  return claimed;
}

/** Tiny in-memory PostgREST fake (eq filters, limit, POST/PATCH/DELETE). */
function fakeSb(
  seed: Record<string, Array<Record<string, unknown>>> = {},
  opts: { rpc?: boolean; claimRpc?: boolean } = {}
) {
  const { rpc = true, claimRpc = true } = opts;
  const tables: Record<string, Array<Record<string, unknown>>> = JSON.parse(
    JSON.stringify(seed)
  );
  const calls: Array<{ method: string; path: string }> = [];
  const idSeq = { n: 0 };
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path });
    const qIdx = path.indexOf("?");
    const table = qIdx === -1 ? path : path.slice(0, qIdx);
    if (table === "/rpc/try_arm_kamin") {
      if (!rpc) return notFound("rpc try_arm_kamin");
      return rpcTryArmKamin(tables, body as Record<string, unknown>, idSeq);
    }
    if (table === "/rpc/kamin_mark_seen") {
      if (!rpc) return notFound("rpc kamin_mark_seen");
      return rpcKaminMarkSeen(tables, body as Record<string, unknown>);
    }
    if (table === "/rpc/claim_due_kamins") {
      if (!claimRpc) return notFound("rpc claim_due_kamins");
      return rpcClaimDueKamins(tables, body as Record<string, unknown>);
    }
    if (!(table in tables)) {
      return notFound(`table ${table}`);
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
    last_checked_at: null,
    last_success_at: null,
    new_match_count: 0,
    armed_at: "2026-10-06T10:00:00.000Z",
    ...over,
  };
}

/** Seed the unbounded seen baseline (kamin_seen_ads) for kamin k1. */
function seenSeed(ids: string[]): Array<Record<string, unknown>> {
  return ids.map((source_ad_id, i) => ({
    kamin_id: "k1",
    source_ad_id,
    seen_at: new Date(NOW - (ids.length - i) * 1000).toISOString(),
  }));
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
    collectStale?: boolean;
    confirmRejects?: Set<string>;
    confirmUnknown?: Set<string>;
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
      return { candidates: opts.candidates ?? [], stale: opts.collectStale ?? false };
    },
    confirm: async (cands) => {
      confirmedBatches.push(cands.map((c) => c.sourceAdId));
      const ids = cands
        .map((c) => c.sourceAdId)
        .filter((id) => !opts.confirmRejects?.has(id));
      return ids.map((id) => ({
        ...scored(id),
        detailUnknown: opts.confirmUnknown?.has(id) ?? false,
      }));
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
    const sb = fakeSb({
      kamins: [kaminRow() as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
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

  it("seeds the seen baseline into kamin_seen_ads (unbounded)", async () => {
    const sb = fakeSb({ kamins: [], kamin_seen_ads: [], notifications: [], kamin_runs: [] });
    const { deps } = testDeps(sb);
    const { kamin } = await armKamin(deps.sb!, {
      userId: "u1",
      name: "پیانو",
      definition: DEF,
      seenIds: ["s1", "s2", "s3"],
      tier: "herfei",
    });
    const rows = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).filter((r) => r.kamin_id === kamin.id);
    expect(rows.map((r) => r.source_ad_id).sort()).toEqual(["s1", "s2", "s3"]);
  });
});

describe("armKamin — slot race (finding #7)", () => {
  const guitarDef: HuntDefinition = { ...DEF, query: "گیتار" };
  const drumDef: HuntDefinition = { ...DEF, query: "درامز" };

  function arm(sb: ReturnType<typeof fakeSb>, def: HuntDefinition) {
    return armKamin({ rest: sb.rest } as Sb, {
      userId: "u1",
      name: def.query,
      definition: def,
      seenIds: [],
      tier: "paye", // 1 slot
    });
  }

  it("two concurrent arms on a 1-slot tier → exactly one kamin, other gets slots-full", async () => {
    const sb = fakeSb({ kamins: [], kamin_seen_ads: [], notifications: [], kamin_runs: [] });
    // Different definitions: the canonical dedupe must NOT save this —
    // only the atomic slot check can.
    const results = await Promise.allSettled([arm(sb, guitarDef), arm(sb, drumDef)]);
    const ok = results.find((r) => r.status === "fulfilled");
    const bad = results.find((r) => r.status === "rejected");
    expect(ok?.status).toBe("fulfilled");
    expect(bad?.status).toBe("rejected");
    if (ok?.status !== "fulfilled" || bad?.status !== "rejected") {
      throw new Error("unreachable: expected one fulfilled and one rejected");
    }
    expect(ok.value.created).toBe(true);
    expect(bad.reason).toBeInstanceOf(KaminError);
    expect((bad.reason as KaminError).code).toBe("slots-full");
    expect(sb.tables.kamins).toHaveLength(1);
  });

  it("the slot check lives in the RPC: no separate count GET before insert", async () => {
    const sb = fakeSb({ kamins: [], kamin_seen_ads: [], notifications: [], kamin_runs: [] });
    await arm(sb, guitarDef);
    const paths = sb.calls.map((c) => `${c.method} ${c.path}`);
    expect(paths).toContain("POST /rpc/try_arm_kamin");
    // The old racy pattern (GET active count → client-side check → POST).
    expect(paths.some((p) => p.includes("status=eq.active"))).toBe(false);
  });

  it("waking a sleeping kamin is denied when slots are full", async () => {
    const activeKamin = kaminRow({ id: "k-active" });
    const sleepingKamin = kaminRow({
      id: "k-sleeping",
      status: "sleeping",
      canonical_key: kaminCanonicalKey(guitarDef),
      definition: guitarDef,
    });
    const sb = fakeSb({
      kamins: [
        activeKamin as unknown as Record<string, unknown>,
        sleepingKamin as unknown as Record<string, unknown>,
      ],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    // Re-arming the sleeping kamin's definition would wake it — but the
    // single paye slot is taken.
    await expect(arm(sb, guitarDef)).rejects.toMatchObject({ code: "slots-full" });
    const row = sb.tables.kamins.find((r) => r.id === "k-sleeping") as unknown as KaminRow;
    expect(row.status).toBe("sleeping");
    expect(sb.tables.kamins).toHaveLength(2);
  });

  it("waking a sleeping kamin succeeds when a slot is free", async () => {
    const sleepingKamin = kaminRow({
      id: "k-sleeping",
      status: "sleeping",
      canonical_key: kaminCanonicalKey(guitarDef),
      definition: guitarDef,
    });
    const sb = fakeSb({
      kamins: [sleepingKamin as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { kamin, created } = await arm(sb, guitarDef);
    expect(created).toBe(false);
    expect(kamin.id).toBe("k-sleeping");
    expect(kamin.status).toBe("active");
    expect(sb.tables.kamins).toHaveLength(1);
  });

  it("legacy fallback (RPC missing): old GET→POST path with uncapped baseline", async () => {
    const sb = fakeSb(
      { kamins: [], notifications: [], kamin_runs: [] },
      { rpc: false }
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { kamin, created } = await armKamin({ rest: sb.rest } as Sb, {
        userId: "u1",
        name: "پیانو",
        definition: DEF,
        seenIds: ["s1"],
        tier: "herfei",
      });
      expect(created).toBe(true);
      // The fake POST doesn't mint ids (the DB default does) — the row
      // itself is the assertion.
      expect(sb.tables.kamins).toHaveLength(1);
      expect(kamin.name).toBe("پیانو");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("try_arm_kamin RPC missing")
      );
      const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
      expect(row.seen_ids).toEqual(["s1"]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("legacyArmKamin — sleeping re-arm slot check (finding #11)", () => {
  const guitarDef: HuntDefinition = { ...DEF, query: "گیتار" };

  /** Sleeping kamin with DEF's canonical key; active kamin with another. */
  function seed(activeCount: 1 | 0) {
    const rows: Array<Record<string, unknown>> = [
      kaminRow({ id: "k2", status: "sleeping" }) as unknown as Record<string, unknown>,
    ];
    if (activeCount === 1) {
      rows.push(
        kaminRow({
          id: "k1",
          definition: guitarDef,
          canonical_key: kaminCanonicalKey(guitarDef),
        }) as unknown as Record<string, unknown>
      );
    }
    // rpc: false forces the legacy path (m9 not installed → RPC 404s).
    return fakeSb(
      { kamins: rows, kamin_seen_ads: [], notifications: [], kamin_runs: [] },
      { rpc: false }
    );
  }

  function rearm(sb: ReturnType<typeof fakeSb>) {
    const { deps } = testDeps(sb);
    return armKamin(deps.sb!, {
      userId: "u1",
      name: "پیانو",
      definition: DEF,
      seenIds: [],
      tier: "paye", // 1 slot
    });
  }

  it("re-arming a sleeping kamin on a full tier → slots-full (no bypass)", async () => {
    const sb = seed(1);
    const err = await rearm(sb).catch((e) => e);
    expect(err).toBeInstanceOf(KaminError);
    expect((err as KaminError).code).toBe("slots-full");
    // The sleeping kamin stays sleeping — nothing was woken.
    const k2 = (sb.tables.kamins as Array<Record<string, unknown>>).find(
      (r) => r.id === "k2"
    );
    expect(k2?.status).toBe("sleeping");
  });

  it("re-arming a sleeping kamin with a free slot → wakes it", async () => {
    const sb = seed(0);
    const { kamin, created } = await rearm(sb);
    expect(created).toBe(false);
    expect(kamin.id).toBe("k2");
    expect(kamin.status).toBe("active");
  });
});

describe("wakeKaminsForUser — hard slot limit (navid 2026-10-06)", () => {
  function sleeping(id: string, createdAt: string): Record<string, unknown> {
    return {
      id,
      user_id: "u1",
      name: id,
      definition: DEF,
      canonical_key: `key-${id}`,
      status: "sleeping",
      cadence: "daily",
      created_at: createdAt,
    };
  }

  it("wakes only up to the tier's free slots, newest first", async () => {
    const sb = fakeSb({
      kamins: [
        // Seeded newest-first: the fake ignores ORDER BY, so insertion
        // order models the real `order=created_at.desc`.
        sleeping("s-new", "2026-10-06T10:00:00Z"),
        sleeping("s-mid", "2026-10-05T10:00:00Z"),
        sleeping("s-old", "2026-10-04T10:00:00Z"),
      ],
    });
    const woken = await wakeKaminsForUser({ rest: sb.rest } as Sb, "u1", 1);
    expect(woken).toBe(1);
    const byId = Object.fromEntries(
      (sb.tables.kamins as Array<Record<string, unknown>>).map((r) => [r.id, r.status])
    );
    // Newest wakes; the rest stay sleeping.
    expect(byId).toEqual({ "s-new": "active", "s-mid": "sleeping", "s-old": "sleeping" });
    // The query asks for newest-first with a limit.
    const get = sb.calls.find((c) => c.path.includes("status=eq.sleeping"));
    expect(get?.path).toContain("order=created_at.desc");
    expect(get?.path).toContain("limit=1");
  });

  it("wakes nothing when slots are already full", async () => {
    const sb = fakeSb({
      kamins: [
        { ...sleeping("s1", "2026-10-06T10:00:00Z") },
        {
          id: "a1",
          user_id: "u1",
          name: "a1",
          definition: DEF,
          canonical_key: "key-a1",
          status: "active",
          cadence: "daily",
          created_at: "2026-10-01T10:00:00Z",
        },
      ],
    });
    const woken = await wakeKaminsForUser({ rest: sb.rest } as Sb, "u1", 1);
    expect(woken).toBe(0);
    const s1 = (sb.tables.kamins as Array<Record<string, unknown>>).find((r) => r.id === "s1");
    expect(s1?.status).toBe("sleeping");
  });

  it("wakes all sleeping when slots allow", async () => {
    const sb = fakeSb({
      kamins: [
        sleeping("s-new", "2026-10-06T10:00:00Z"),
        sleeping("s-old", "2026-10-05T10:00:00Z"),
      ],
    });
    const woken = await wakeKaminsForUser({ rest: sb.rest } as Sb, "u1", 3);
    expect(woken).toBe(2);
  });
});

describe("checkKamin", () => {
  it("first successful check is a SILENT baseline — never push for old ads", async () => {
    const k = kaminRow(); // last_success_at null
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, { candidates: [cand("a"), cand("b")] });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("baseline");
    expect(r.newCount).toBe(0);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
    const seenIds = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).map((row) => row.source_ad_id);
    expect(seenIds.sort()).toEqual(["a", "b"]);
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    expect(row.last_success_at).not.toBeNull();
  });

  it("diffs against the seen baseline and confirms ONLY new ids", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
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
    // baseline advanced in the table (unbounded), success window moved
    const seenIds = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).map((row) => row.source_ad_id);
    expect(seenIds).toEqual(expect.arrayContaining(["a", "b", "c"]));
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    expect(row.last_success_at).toBe(new Date(NOW).toISOString());
    expect(row.new_match_count).toBe(2);
  });

  it("a failed check never moves the baseline (flaw #6)", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T09:00:00.000Z",
      last_checked_at: "2026-10-06T09:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, { collectThrows: true });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("failed");
    const row = sb.tables.kamins[0] as unknown as KaminRow;
    // last_success_at untouched → next run catches up since last SUCCESS
    expect(row.last_success_at).toBe("2026-10-06T09:00:00.000Z");
    const seenIds = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).map((row) => row.source_ad_id);
    expect(seenIds).toEqual(["a"]);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
    const run = sb.tables.kamin_runs[0] as unknown as Record<string, unknown>;
    expect(run.status).toBe("failed");
  });

  it("no new matches → silent, baseline still advances the window", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a", "b"]),
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

  it("legacy fallback (table missing): checkKamin uses the seen_ids column", async () => {
    const k = {
      ...kaminRow({
        last_success_at: "2026-10-06T11:00:00.000Z",
        last_checked_at: "2026-10-06T11:00:00.000Z",
      }),
      seen_ids: ["a"],
    };
    const sb = fakeSb(
      {
        kamins: [k as unknown as Record<string, unknown>],
        notifications: [],
        kamin_runs: [],
      },
      { rpc: false }
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { deps, confirmedBatches } = testDeps(sb, {
        candidates: [cand("a"), cand("b")],
      });
      const r = await checkKamin(deps, k as unknown as KaminRow);
      expect(r.status).toBe("completed");
      expect(r.newCount).toBe(1);
      expect(confirmedBatches).toEqual([["b"]]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("kamin_seen_ads missing")
      );
      const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
      expect(row.seen_ids).toEqual(expect.arrayContaining(["a", "b"]));
    } finally {
      warn.mockRestore();
    }
  });
});

describe("checkKamin — stale collect (finding #17)", () => {
  it("stale collect: last_checked_at advances, last_success_at does NOT", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, {
      candidates: [cand("a"), cand("b")],
      collectStale: true,
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    // The check ran...
    expect(row.last_checked_at).toBe("2026-10-06T12:00:00.000Z");
    // ...but stale data is not success: the catch-up window is preserved.
    expect(row.last_success_at).toBe("2026-10-06T11:00:00.000Z");
    // The run row is marked stale for observability.
    const run = sb.tables.kamin_runs[0] as unknown as Record<string, unknown>;
    expect(run.stale).toBe(true);
  });

  it("fresh collect: both last_checked_at and last_success_at advance", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, {
      candidates: [cand("a"), cand("b")],
      collectStale: false,
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    expect(row.last_checked_at).toBe("2026-10-06T12:00:00.000Z");
    expect(row.last_success_at).toBe("2026-10-06T12:00:00.000Z");
    const run = sb.tables.kamin_runs[0] as unknown as Record<string, unknown>;
    expect(run.stale).toBe(false);
  });

  it("stale collect on arming: baseline is deferred, last_success_at stays null", async () => {
    const k = kaminRow(); // last_success_at null — first check
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, {
      candidates: [cand("a"), cand("b")],
      collectStale: true,
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(pushed).toHaveLength(0);
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    expect(row.last_checked_at).toBe("2026-10-06T12:00:00.000Z");
    // Not a real baseline — stays null so the next check retries it.
    expect(row.last_success_at).toBeNull();
    // Nothing marked seen from stale data.
    expect(sb.tables.kamin_seen_ads).toHaveLength(0);
  });
});

describe("checkKamin — detailUnknown (finding #21)", () => {
  it("detailUnknown ads are NOT marked seen and do NOT notify", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, {
      candidates: [cand("b"), cand("c")],
      confirmUnknown: new Set(["b", "c"]),
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    // Both were detailUnknown → zero verified matches.
    expect(r.newCount).toBe(0);
    expect(pushed).toHaveLength(0);
    expect(sb.tables.notifications).toHaveLength(0);
    // Neither id advanced the baseline — a later successful check can
    // still catch them.
    const seenIds = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).map((row) => row.source_ad_id);
    expect(seenIds).toEqual(["a"]);
  });

  it("mixed verified + detailUnknown: only verified advance the baseline", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed([]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed } = testDeps(sb, {
      candidates: [cand("b"), cand("c")],
      confirmUnknown: new Set(["c"]),
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(1);
    expect(pushed).toHaveLength(1);
    const seenIds = (
      sb.tables.kamin_seen_ads as Array<Record<string, unknown>>
    ).map((row) => row.source_ad_id);
    expect(seenIds).toEqual(["b"]);
  });

  it("ALL details degraded (stale/failed) → last_success_at frozen (finding #1, round 6)", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, {
      candidates: [cand("b"), cand("c")],
      // Every detail fetch failed or served stale cache — the pipeline
      // flags them all detailUnknown. The check verified NOTHING.
      confirmUnknown: new Set(["b", "c"]),
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(0);
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    // last_checked_at moves (the check ran)...
    expect(row.last_checked_at).toBe("2026-10-06T12:00:00.000Z");
    // ...but last_success_at is FROZEN — same as a stale list collect
    // (finding #17). Advancing it would fake a success and shrink the
    // next check's crawl budget via pageBudgetForElapsed.
    expect(row.last_success_at).toBe("2026-10-06T11:00:00.000Z");
    // The run is flagged for observability.
    const run = sb.tables.kamin_runs[0] as unknown as Record<string, unknown>;
    expect(run.stale).toBe(true);
  });

  it("SOME details verified → last_success_at advances (partial success is real)", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed([]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, {
      candidates: [cand("b"), cand("c")],
      confirmUnknown: new Set(["c"]), // c degraded, b verified
    });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(1);
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    // Genuine progress was made — the window advances. The degraded ad
    // stays unseen (detailUnknown filter) for a later retry.
    expect(row.last_success_at).toBe("2026-10-06T12:00:00.000Z");
  });
});

describe("seen baseline — unbounded (finding #8)", () => {
  function longLivedKamin() {
    return kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
    });
  }

  it("an ad seen 600 checks ago is NOT 'new' when it resurfaces", async () => {
    // The exact false-new the 500-id cap produced: with the cap, ad-0 ..
    // ad-99 would have been evicted and re-confirmed as "new".
    const oldIds = Array.from({ length: 600 }, (_, i) => `ad-${i}`);
    const sb = fakeSb({
      kamins: [longLivedKamin() as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(oldIds),
      notifications: [],
      kamin_runs: [],
    });
    const { deps, pushed, confirmedBatches } = testDeps(sb, {
      candidates: [cand("ad-0"), cand("ad-599"), cand("ad-new")],
    });
    const r = await checkKamin(deps, longLivedKamin());
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(1);
    // details fetched ONLY for the genuinely-new ad — never for ad-0/ad-599
    expect(confirmedBatches).toEqual([["ad-new"]]);
    expect(pushed).toHaveLength(1);
    expect(sb.tables.notifications).toHaveLength(1);
  });

  it("1000 seen ads → all 1000 still known (no cap anywhere)", async () => {
    const oldIds = Array.from({ length: 1000 }, (_, i) => `ad-${i}`);
    const sb = fakeSb({
      kamins: [longLivedKamin() as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(oldIds),
      notifications: [],
      kamin_runs: [],
    });
    const { deps, confirmedBatches } = testDeps(sb, {
      candidates: [cand("ad-0"), cand("ad-999")],
    });
    const r = await checkKamin(deps, longLivedKamin());
    expect(r.status).toBe("completed");
    expect(r.newCount).toBe(0);
    expect(confirmedBatches).toEqual([[]]);
    expect(sb.tables.notifications).toHaveLength(0);
  });
});

describe("baseline union is race-free (finding #14)", () => {
  it("concurrent advanceKaminBaseline calls lose no ids", async () => {
    // The lost-update in #14 needs a read-modify-write (GET → merge →
    // PATCH). The real kamin_mark_seen is a single INSERT ... ON CONFLICT
    // DO NOTHING (m9) — no read, so concurrent writers commute and the
    // union is always complete. The fake models exactly that: one
    // synchronous union block per call.
    const sb = fakeSb({
      kamins: [kaminRow({ id: "k1" }) as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const sets = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => `w${i}-ad-${j}`)
    );
    await Promise.all(
      sets.map((ids) =>
        advanceKaminBaseline({ rest: sb.rest } as Sb, "k1", "u1", ids)
      )
    );
    const rows = sb.tables.kamin_seen_ads as Array<Record<string, unknown>>;
    const got = new Set(rows.map((r) => r.source_ad_id as string));
    expect(got).toEqual(new Set(sets.flat()));
    expect(got.size).toBe(50);
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
      kamin_seen_ads: [],
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

  it("two overlapping ticks execute a due kamin exactly once (finding #13)", async () => {
    const due = kaminRow({
      id: "k1",
      last_checked_at: "2026-10-06T10:00:00.000Z", // 2h ago, hourly → due
      last_success_at: "2026-10-06T10:00:00.000Z",
    });
    const sb = fakeSb({
      kamins: [due as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [cand("z")] });
    // Overlapping ticks: the second claim must see zero rows (the first
    // tick's claim stamped claimed_at inside one atomic RPC statement).
    const [s1, s2] = await Promise.all([tickDueKamins(deps), tickDueKamins(deps)]);
    expect(s1.due + s2.due).toBe(1);
    // checkKamin executed exactly once: one run row, one notification.
    expect(sb.tables.kamin_runs).toHaveLength(1);
    expect(
      (sb.tables.notifications as Array<Record<string, unknown>>).filter(
        (n) => n.related_kamin_id === "k1"
      )
    ).toHaveLength(1);
  });

  it("a kamin claimed beyond the lease is claimable again", async () => {
    const stale = {
      ...kaminRow({
        id: "k1",
        last_checked_at: "2026-10-06T10:00:00.000Z", // due
        last_success_at: "2026-10-06T10:00:00.000Z",
      }),
      claimed_at: new Date(NOW - 601_000).toISOString(), // lease (600s) expired
    };
    const sb = fakeSb({
      kamins: [stale as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [cand("z")] });
    const summary = await tickDueKamins(deps);
    expect(summary).toMatchObject({ mode: "real", due: 1 });
  });

  it("a recently claimed kamin is not re-claimed", async () => {
    const fresh = {
      ...kaminRow({
        id: "k1",
        last_checked_at: "2026-10-06T10:00:00.000Z", // due by cadence...
        last_success_at: "2026-10-06T10:00:00.000Z",
      }),
      claimed_at: new Date(NOW - 60_000).toISOString(), // ...but lease held
    };
    const sb = fakeSb({
      kamins: [fresh as unknown as Record<string, unknown>],
      kamin_seen_ads: [],
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [cand("z")] });
    const summary = await tickDueKamins(deps);
    expect(summary).toMatchObject({ mode: "real", due: 0, completed: 0 });
    expect(sb.tables.kamin_runs).toHaveLength(0);
  });

  it("RPC missing (404) → loud warn + legacy GET+filter path", async () => {
    const due = kaminRow({
      id: "k1",
      last_checked_at: "2026-10-06T10:00:00.000Z",
      last_success_at: "2026-10-06T10:00:00.000Z",
    });
    const sb = fakeSb(
      {
        kamins: [due as unknown as Record<string, unknown>],
        kamin_seen_ads: [],
        notifications: [],
        kamin_runs: [],
      },
      { claimRpc: false }
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { deps } = testDeps(sb, { candidates: [cand("z")] });
      const summary = await tickDueKamins(deps);
      expect(summary).toMatchObject({ mode: "real", due: 1 });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("claim_due_kamins RPC missing")
      );
      // Legacy path still runs the due kamin.
      expect(sb.tables.kamin_runs).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("checkKamin — claim release (finding #1, round 5)", () => {
  it("completed check releases the scheduler claim (claimed_at -> null)", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
      claimed_at: "2026-10-06T11:55:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [cand("a"), cand("b")] });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("completed");
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    // The lease must not act as a minimum check interval: clearing the
    // claim lets the next due tick (by last_checked_at) claim immediately.
    expect(row.claimed_at).toBeNull();
  });

  it("failed check also releases the claim", async () => {
    const k = kaminRow({
      last_success_at: "2026-10-06T11:00:00.000Z",
      last_checked_at: "2026-10-06T11:00:00.000Z",
      claimed_at: "2026-10-06T11:55:00.000Z",
    });
    const sb = fakeSb({
      kamins: [k as unknown as Record<string, unknown>],
      kamin_seen_ads: seenSeed(["a"]),
      notifications: [],
      kamin_runs: [],
    });
    const { deps } = testDeps(sb, { candidates: [], collectThrows: true });
    const r = await checkKamin(deps, k);
    expect(r.status).toBe("failed");
    const row = sb.tables.kamins[0] as unknown as Record<string, unknown>;
    expect(row.claimed_at).toBeNull();
  });
});
