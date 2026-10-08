/**
 * Finding #9 — DB backend for hunt runs (finding #9, bug-bounty 2026-10-06).
 * Mocks ONLY the DB boundary (@/lib/supabase-server) with an in-memory
 * PostgREST fake; exercises the REAL runs module: real claim SQL-shape,
 * real conditional updates, real event log ordering.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import {
  appendRunEvent,
  canOpenRun,
  claimIdempotency,
  claimRunForExecution,
  claimTuning,
  createRun,
  DeepenConflictError,
  finalizeRun,
  getRun,
  getRunStatus,
  hasDeepChild,
  heartbeatRunClaim,
  isDeepenConflict,
  readRunEvents,
  releaseIdempotency,
  RUN_LEASE_MS,
  setRunStartCursor,
} from "./runs";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);

const DEF = {
  query: "گوشی",
  include: ["گوشی"],
  exclude: [],
  city: "tehran",
  category: "mobile",
  priceMin: "",
  priceMax: "",
  transaction: "" as const,
  condition: "" as const,
};

const QUOTA = {
  kind: "guest" as const,
  mode: "real" as const,
  userId: null,
  deviceId: "d1",
  charged: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface FakeDb {
  runs: Map<string, Record<string, unknown>>;
  keys: Map<string, { run_id: string; at: string }>;
  events: Array<{ id: number; run_id: string; type: string; payload: unknown }>;
  nextEventId: number;
  /** Models the deepened_from partial unique index (finding #12). */
  deepenedFrom: Set<string>;
  rest: ReturnType<typeof vi.fn>;
}

/** Minimal PostgREST fake implementing exactly the query shapes runs.ts uses. */
function makeFakeDb(): FakeDb {
  const db: Omit<FakeDb, "rest"> = {
    runs: new Map(),
    keys: new Map(),
    events: [],
    nextEventId: 1,
    deepenedFrom: new Set(),
  };
  const conflict = (): never => {
    const e = new Error("duplicate key value violates unique constraint") as Error & {
      status: number;
    };
    e.status = 409;
    throw e;
  };
  /** Shaped like the real SupabaseError for the deepened_from 23505. */
  const deepenedConflict = (): never => {
    const e = new Error(
      'Supabase POST hunt_runs → 409: {"code":"23505","message":"duplicate key value violates unique constraint \\"hunt_runs_deepened_from_uidx\\""}'
    ) as Error & { status: number };
    e.status = 409;
    throw e;
  };
  const parse = (path: string): [string, URLSearchParams] => {
    const [table, qs] = path.split("?");
    return [table, new URLSearchParams(qs ?? "")];
  };
  const eq = (p: URLSearchParams, col: string): string | null => {
    const v = p.get(col);
    return v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null;
  };
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    const [table, params] = parse(path);
    const b = (body ?? {}) as Record<string, unknown>;

    if (table === "hunt_runs" && method === "GET" && params.get("limit") === "0") return [];
    if (table === "hunt_idem_keys" && method === "POST") {
      const key = b.key as string;
      if (db.keys.has(key)) conflict();
      db.keys.set(key, { run_id: b.run_id as string, at: new Date().toISOString() });
      return [];
    }
    if (table === "hunt_idem_keys" && method === "GET") {
      const row = db.keys.get(eq(params, "key") ?? "");
      return row ? [{ run_id: row.run_id, at: row.at }] : [];
    }
    if (table === "hunt_idem_keys" && method === "DELETE") {
      const key = eq(params, "key") ?? "";
      const atRaw = params.get("at");
      const row = db.keys.get(key);
      if (row && atRaw) {
        const op = atRaw.slice(0, 3);
        const val = decodeURIComponent(atRaw.slice(3));
        const match = op === "eq." ? row.at === val : op === "lt." ? row.at < val : false;
        if (match) db.keys.delete(key);
      } else if (row) {
        db.keys.delete(key);
      }
      return [];
    }
    if (table === "hunt_runs" && method === "POST") {
      const now = new Date().toISOString();
      const df = b.deepened_from as string | null | undefined;
      if (df) {
        if (db.deepenedFrom.has(df)) deepenedConflict();
        db.deepenedFrom.add(df);
      }
      db.runs.set(b.id as string, { ...b, created_at: now, updated_at: now });
      return [];
    }
    if (table === "hunt_runs" && method === "GET") {
      const dfEq = eq(params, "deepened_from");
      if (dfEq !== null) {
        const hit = [...db.runs.values()].find((r) => r.deepened_from === dfEq);
        return hit ? [{ id: hit.id }] : [];
      }
      const row = db.runs.get(eq(params, "id") ?? "");
      if (!row) return [];
      const out: Record<string, unknown> = {};
      for (const c of (params.get("select") ?? "").split(",")) out[c] = row[c];
      return [out];
    }
    if (table === "hunt_runs" && method === "PATCH") {
      const row = db.runs.get(eq(params, "id") ?? "");
      if (!row) return [];
      const statusEq = eq(params, "status");
      if (statusEq !== null && row.status !== statusEq) return [];
      // Model the lease-recovery or= filter (finding #7): the second claim
      // PATCH requires status=running AND (claimed_at null OR < cutoff).
      const orRaw = params.get("or");
      if (orRaw) {
        const m = orRaw.match(/claimed_at\.lt\.(.+)$/);
        const cutoff = m ? decodeURIComponent(m[1]) : null;
        const leaseOk =
          row.claimed_at == null || (cutoff !== null && String(row.claimed_at) < cutoff);
        if (!leaseOk) return [];
      }
      Object.assign(row, b, { updated_at: new Date().toISOString() });
      return [{ id: row.id }];
    }
    if (table === "hunt_run_events" && method === "POST") {
      db.events.push({
        id: db.nextEventId++,
        run_id: b.run_id as string,
        type: b.type as string,
        payload: b.payload,
      });
      return [];
    }
    if (table === "hunt_run_events" && method === "GET") {
      const runId = eq(params, "run_id");
      const gtRaw = params.get("id");
      const after = gtRaw?.startsWith("gt.") ? Number(gtRaw.slice(3)) : 0;
      return db.events
        .filter((e) => e.run_id === runId && e.id > after)
        .sort((a, z) => a.id - z.id)
        .map((e) => ({ id: e.id, type: e.type, payload: e.payload }));
    }
    throw new Error(`fake: unhandled ${method} ${path}`);
  });
  return { ...db, rest };
}

let fake: FakeDb;

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  fake = makeFakeDb();
  mockServer.mockReturnValue(fake as never);
  // Shrink the loser-poll windows for fast tests (prod keeps the defaults).
  claimTuning.pollMs = 5;
  claimTuning.rounds = 40;
  claimTuning.staleMs = 60_000;
});

describe("idempotency across instances (shared DB)", () => {
  it("two sequential claims for one key → same runId, second not fresh", async () => {
    const c1 = await claimIdempotency("k-seq");
    expect(c1.fresh).toBe(true);
    // "Instance A" creates the run.
    await createRun(DEF, null, QUOTA, "k-seq", undefined, c1.runId);
    // "Instance B" sees the same key.
    const c2 = await claimIdempotency("k-seq");
    expect(c2.fresh).toBe(false);
    expect(c2.runId).toBe(c1.runId);
  });

  it("10 concurrent claims → exactly one fresh winner, all agree on its id", async () => {
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => claimIdempotency("k-race"))
    );
    const fresh = claims.filter((c) => c.fresh);
    expect(fresh).toHaveLength(1);
    const winner = fresh[0].runId;
    for (const c of claims) expect(c.runId).toBe(winner);
    expect(fake.keys.get("k-race")?.run_id).toBe(winner);
  });

  it("loser polls, sees the winner's run appear, and dedupes", async () => {
    const c1 = await claimIdempotency("k-poll");
    expect(c1.fresh).toBe(true);
    const loser = claimIdempotency("k-poll");
    await sleep(30);
    // Winner's quota+createRun land while the loser is polling.
    await createRun(DEF, null, QUOTA, "k-poll", undefined, c1.runId);
    const c2 = await loser;
    expect(c2.fresh).toBe(false);
    expect(c2.runId).toBe(c1.runId);
  });

  it("winner quota-denied (key released) → next claim is fresh", async () => {
    const c1 = await claimIdempotency("k-deny");
    expect(c1.fresh).toBe(true);
    await releaseIdempotency("k-deny");
    const c2 = await claimIdempotency("k-deny");
    expect(c2.fresh).toBe(true);
    expect(c2.runId).not.toBe(c1.runId);
  });

  it("stale claim (winner crashed before createRun) is reclaimed fresh", async () => {
    fake.keys.set("k-stale", {
      run_id: "dead-beef",
      at: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    const c = await claimIdempotency("k-stale");
    expect(c.fresh).toBe(true);
    expect(c.runId).not.toBe("dead-beef");
    expect(fake.keys.get("k-stale")?.run_id).toBe(c.runId);
  });
});

describe("conditional execution + finalization (exactly one winner)", () => {
  it("two instances racing claimRunForExecution → exactly one owner", async () => {
    const run = await createRun(DEF, null, QUOTA);
    const viewA = await getRun(run.id);
    const viewB = await getRun(run.id);
    const [a, b] = await Promise.all([
      claimRunForExecution(viewA!),
      claimRunForExecution(viewB!),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await getRunStatus(run.id)).toBe("running");
  });

  it("finalizeRun: exactly one closer; end cursor persisted", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await claimRunForExecution((await getRun(run.id))!);
    const [w1, w2] = await Promise.all([
      finalizeRun(run.id, "done", { page: 20 }),
      finalizeRun(run.id, "done", { page: 20 }),
    ]);
    expect([w1, w2].filter(Boolean)).toHaveLength(1);
    const reread = await getRun(run.id);
    expect(reread?.status).toBe("done");
    expect(reread?.endCursor).toEqual({ page: 20 });
  });
});

describe("execution lease — crash recovery (finding #7)", () => {
  it("fresh lease: second claim while owner alive fails", async () => {
    const run = await createRun(DEF, null, QUOTA);
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(true);
    // Owner just claimed; lease is fresh — nobody may steal it.
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(false);
    expect(await getRunStatus(run.id)).toBe("running");
  });

  it("expired lease: crashed owner's run becomes claimable again", async () => {
    const run = await createRun(DEF, null, QUOTA);
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(true);
    // Simulate the crash: owner died, heartbeat stopped long ago.
    const row = fake.runs.get(run.id)!;
    row.claimed_at = new Date(Date.now() - RUN_LEASE_MS - 60_000).toISOString();
    // A new opener recovers the run instead of waiting forever.
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(true);
    expect(await getRunStatus(run.id)).toBe("running");
  });

  it("heartbeat refreshes claimed_at; finalizeRun releases the claim", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await claimRunForExecution((await getRun(run.id))!);
    const before = fake.runs.get(run.id)!.claimed_at as string;
    await new Promise((r) => setTimeout(r, 5));
    await heartbeatRunClaim(run.id);
    const after = fake.runs.get(run.id)!.claimed_at as string;
    expect(after > before).toBe(true);
    // Finalization clears the lease atomically with the terminal status.
    expect(await finalizeRun(run.id, "done")).toBe(true);
    expect(fake.runs.get(run.id)!.claimed_at).toBeNull();
    expect(await getRunStatus(run.id)).toBe("done");
  });
});

describe("TTL applies only to terminal runs (finding #8)", () => {
  it("running run older than 30min is still reachable via getRun", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await claimRunForExecution((await getRun(run.id))!);
    // Age the row 31 minutes; status stays running.
    fake.runs.get(run.id)!.created_at = new Date(Date.now() - 31 * 60_000).toISOString();
    const reread = await getRun(run.id);
    expect(reread).toBeDefined();
    expect(reread!.status).toBe("running");
  });

  it("done run older than 30min is still reachable via getRun (DB: 30-day retention)", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await claimRunForExecution((await getRun(run.id))!);
    await finalizeRun(run.id, "done");
    // Age the row 31 minutes — well within the 30-day DB retention.
    fake.runs.get(run.id)!.created_at = new Date(Date.now() - 31 * 60_000).toISOString();
    const reread = await getRun(run.id);
    expect(reread).toBeDefined();
    expect(reread!.status).toBe("done");
  });

  it("done run older than 30 days is reaped by getRun", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await claimRunForExecution((await getRun(run.id))!);
    await finalizeRun(run.id, "done");
    fake.runs.get(run.id)!.created_at = new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString();
    expect(await getRun(run.id)).toBeUndefined();
  });
});

describe("event log", () => {  it("persists and replays events in id order, with afterId filtering", async () => {
    const run = await createRun(DEF, null, QUOTA);
    await appendRunEvent(run.id, { type: "started", query: "گوشی" });
    await appendRunEvent(run.id, {
      type: "done",
      results: [],
      stats: {
        adsSeen: 1, titleRejected: 0, dupsCollapsed: 0, candidates: 0,
        detailsChecked: 0, confirmed: 0, stale: false, nearMiss: 0,
      },
    });
    const all = await readRunEvents(run.id, 0);
    expect(all.map((e) => e.event.type)).toEqual(["started", "done"]);
    expect(all[1].id).toBeGreaterThan(all[0].id);
    const tail = await readRunEvents(run.id, all[0].id);
    expect(tail).toHaveLength(1);
    expect(tail[0].event.type).toBe("done");
  });
});

describe("run rows", () => {
  it("ownership comes from the DB row; deepen cursor round-trips", async () => {
    const run = await createRun(DEF, "u1", { ...QUOTA, userId: "u1" });
    const fetched = (await getRun(run.id))!;
    expect(canOpenRun(fetched, "u1")).toBe(true);
    expect(canOpenRun(fetched, "u2")).toBe(false);
    expect(fetched.quota.charged).toBe(true);
    await setRunStartCursor(fetched, { page: 20 });
    expect((await getRun(run.id))?.startCursor).toEqual({ page: 20 });
  });

  it("unknown ids → undefined", async () => {
    expect(await getRun("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(await getRunStatus("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("one deepen per hunt (finding #12)", () => {
  it("deepenedFrom is persisted on the child row", async () => {
    const parent = await createRun(DEF, null, QUOTA);
    const child = await createRun(
      { ...DEF, deepHistory: true },
      null,
      QUOTA,
      undefined,
      undefined,
      undefined,
      parent.id
    );
    expect(child.deepenedFrom).toBe(parent.id);
    expect((await getRun(child.id))?.deepenedFrom).toBe(parent.id);
  });

  it("second createRun with the same deepenedFrom → 23505-shaped 409", async () => {
    const parent = await createRun(DEF, null, QUOTA);
    await createRun({ ...DEF }, null, QUOTA, undefined, undefined, undefined, parent.id);
    const err = await createRun(
      { ...DEF },
      null,
      QUOTA,
      undefined,
      undefined,
      undefined,
      parent.id
    ).catch((e) => e);
    expect(err).toMatchObject({ status: 409 });
    expect(isDeepenConflict(err)).toBe(true);
  });

  it("two concurrent deepens of the same parent → exactly one child", async () => {
    const parent = await createRun(DEF, null, QUOTA);
    const deepen = () =>
      createRun({ ...DEF }, null, QUOTA, undefined, undefined, undefined, parent.id);
    const results = await Promise.allSettled([deepen(), deepen()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(isDeepenConflict((bad[0] as PromiseRejectedResult).reason)).toBe(true);
  });

  it("hasDeepChild: false before, true after the deepen", async () => {
    const parent = await createRun(DEF, null, QUOTA);
    expect(await hasDeepChild(parent.id)).toBe(false);
    await createRun({ ...DEF }, null, QUOTA, undefined, undefined, undefined, parent.id);
    expect(await hasDeepChild(parent.id)).toBe(true);
    expect(await hasDeepChild("00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("isDeepenConflict ignores other errors", async () => {
    expect(isDeepenConflict(new Error("boom"))).toBe(false);
    expect(isDeepenConflict({ status: 409, message: "no code here" })).toBe(false);
    expect(isDeepenConflict({ status: 500, message: "23505" })).toBe(false);
    expect(isDeepenConflict(null)).toBe(false);
    expect(isDeepenConflict(new DeepenConflictError("p1"))).toBe(true);
  });
});
