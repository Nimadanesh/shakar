/**
 * Finding #9 — stream route against the DB backend.
 * Mocks ONLY the boundaries (auth session, Divar pipeline, PostgREST);
 * exercises the REAL route handler + the REAL runs module: real replay
 * from the event table, real conditional execution claim, real ownership.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  supabaseConfigured: vi.fn(),
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/server/hunt/pipeline", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/server/hunt/pipeline")>();
  return { ...orig, runPipeline: vi.fn() };
});

import { supabaseConfigured, supabaseServer } from "@/lib/supabase-server";
import { getSessionUserId } from "@/lib/server/auth";
import { runPipeline } from "@/lib/server/hunt/pipeline";
import {
  appendRunEvent,
  claimRunForExecution,
  claimTuning,
  createRun,
  finalizeRun,
  getRun,
  getRunStatus,
  readRunEvents,
} from "@/lib/server/hunt/runs";
import { GET, streamTuning } from "@/app/api/hunts/[id]/stream/route";

const mockConfigured = vi.mocked(supabaseConfigured);
const mockServer = vi.mocked(supabaseServer);
const mockSession = vi.mocked(getSessionUserId);
const mockPipeline = vi.mocked(runPipeline);

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
  poolKey: "d1",
  charged: false,
};

const STATS = {
  adsSeen: 10, titleRejected: 2, dupsCollapsed: 1, candidates: 3,
  detailsChecked: 3, confirmed: 1, stale: false, nearMiss: 0,
};

/** Same minimal PostgREST fake as runs.db.test.ts (shared query shapes). */
function makeFakeDb() {
  const db = {
    runs: new Map<string, Record<string, unknown>>(),
    keys: new Map<string, { run_id: string; at: string }>(),
    events: [] as Array<{ id: number; run_id: string; type: string; payload: unknown }>,
    nextEventId: 1,
  };
  const conflict = (): never => {
    const e = new Error("duplicate key") as Error & { status: number };
    e.status = 409;
    throw e;
  };
  const rest = vi.fn(async (method: string, path: string, body?: unknown) => {
    const [table, qs] = path.split("?");
    const params = new URLSearchParams(qs ?? "");
    const b = (body ?? {}) as Record<string, unknown>;
    const eq = (col: string): string | null => {
      const v = params.get(col);
      return v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null;
    };
    if (table === "hunt_runs" && method === "GET" && params.get("limit") === "0") return [];
    if (table === "hunt_idem_keys" && method === "POST") {
      const key = b.key as string;
      if (db.keys.has(key)) conflict();
      db.keys.set(key, { run_id: b.run_id as string, at: new Date().toISOString() });
      return [];
    }
    if (table === "hunt_idem_keys" && method === "GET") {
      const row = db.keys.get(eq("key") ?? "");
      return row ? [{ run_id: row.run_id, at: row.at }] : [];
    }
    if (table === "hunt_idem_keys" && method === "DELETE") {
      const key = eq("key") ?? "";
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
      db.runs.set(b.id as string, { ...b, created_at: now, updated_at: now });
      return [];
    }
    if (table === "hunt_runs" && method === "GET") {
      const row = db.runs.get(eq("id") ?? "");
      if (!row) return [];
      const out: Record<string, unknown> = {};
      for (const c of (params.get("select") ?? "").split(",")) out[c] = row[c];
      return [out];
    }
    if (table === "hunt_runs" && method === "PATCH") {
      const row = db.runs.get(eq("id") ?? "");
      if (!row) return [];
      const statusEq = eq("status");
      if (statusEq !== null && row.status !== statusEq) return [];
      // Model the lease-recovery or= filter (finding #7): the second claim
      // PATCH requires status=running AND (claimed_at null OR < cutoff).
      const orRaw = params.get("or");
      if (orRaw) {
        const m = orRaw.match(/claimed_at\.lt\.(.+)$/);
        const cutoff = m ? decodeURIComponent(m[1].replace(/\)$/, "")) : null;
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
      const runId = eq("run_id");
      const gtRaw = params.get("id");
      const after = gtRaw?.startsWith("gt.") ? Number(gtRaw.slice(3)) : 0;
      return db.events
        .filter((e) => e.run_id === runId && e.id > after)
        .sort((a, z) => a.id - z.id)
        .map((e) => ({ id: e.id, type: e.type, payload: e.payload }));
    }
    throw new Error(`fake: unhandled ${method} ${path}`);
  });
  return { db, rest };
}

function get(id: string) {
  return GET(new Request("http://x/"), { params: Promise.resolve({ id }) });
}

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  const fake = makeFakeDb();
  mockServer.mockReturnValue(fake as never);
  mockSession.mockResolvedValue(null);
  claimTuning.pollMs = 5;
  claimTuning.rounds = 40;
  claimTuning.staleMs = 60_000;
  streamTuning.pollMs = 10;
  streamTuning.timeoutMs = 500;
});

describe("stream route, DB backend (finding #9)", () => {
  it("replays pre-seeded events for a done run — pipeline never executes", async () => {
    const run = await createRun(DEF, null, QUOTA);
    // Seed like a real completed hunt: owner claimed, emitted, finalized.
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(true);
    await appendRunEvent(run.id, { type: "started", query: "گوشی" });
    await appendRunEvent(run.id, {
      type: "done",
      results: [{ sourceAdId: "a1", title: "t", score: 1 } as never],
      stats: STATS as never,
    });
    expect(await finalizeRun(run.id, "done")).toBe(true);

    const res = await get(run.id);
    expect(res.status).toBe(200);
    const body = await readAll(res);
    const types = [...body.matchAll(/"type":"([a-z-]+)"/g)].map((m) => m[1]);
    expect(types).toEqual(["started", "done"]);
    expect(body).toContain('"sourceAdId":"a1"');
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("a run already running elsewhere is followed, never re-executed", async () => {
    const run = await createRun(DEF, null, QUOTA);
    // "Another instance" claimed it.
    expect(await claimRunForExecution((await getRun(run.id))!)).toBe(true);
    await appendRunEvent(run.id, { type: "started", query: "گوشی" });

    const res = await get(run.id);
    expect(res.status).toBe(200);
    const body = await readAll(res);
    expect(body).toContain('"type":"started"');
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("403s cross-user on the DB path — pipeline never runs", async () => {
    const run = await createRun(DEF, "user-1", { ...QUOTA, userId: "user-1" });
    mockSession.mockResolvedValue("user-2");
    const res = await get(run.id);
    expect(res.status).toBe(403);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("owner executes via the route: events persisted, status done, cursor saved", async () => {
    const run = await createRun(DEF, null, QUOTA);
    mockPipeline.mockImplementationOnce(async (_def, emit) => {
      emit({ type: "started", query: "گوشی" } as never);
      emit({
        type: "done",
        results: [{ sourceAdId: "a9", title: "t", score: 2 }],
        stats: STATS,
      } as never);
      return { results: [], stats: STATS, endCursor: { page: 5 } } as never;
    });

    const res = await get(run.id);
    expect(res.status).toBe(200);
    const body = await readAll(res);
    expect(body).toContain('"type":"done"');
    expect(mockPipeline).toHaveBeenCalledTimes(1);

    // The event table is the replay source: both events persisted in order.
    const stored = await readRunEvents(run.id, 0);
    expect(stored.map((e) => e.event.type)).toEqual(["started", "done"]);
    expect(await getRunStatus(run.id)).toBe("done");
    expect((await getRun(run.id))?.endCursor).toEqual({ page: 5 });
  });
});
