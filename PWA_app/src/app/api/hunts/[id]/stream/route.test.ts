/**
 * Route-level ownership + single-execution tests for the hunt stream.
 * Mocks the session (auth) and the pipeline (Divar) — but exercises the
 * REAL route handler: real runs map, real claim, real 403 logic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/server/hunt/pipeline", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/server/hunt/pipeline")>();
  return {
    ...orig,
    runPipeline: vi.fn(async (_def: unknown, emit: (e: unknown) => void) => {
      emit({ type: "done", results: [{ sourceAdId: "a1", title: "t", score: 1 }], stats: {} });
      return { results: [], stats: {}, endCursor: undefined };
    }),
  };
});

vi.mock("@/lib/server/hunt/runs", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/server/hunt/runs")>();
  return {
    ...orig,
    runCompletionSideEffects: vi.fn(),
  };
});

import { getSessionUserId } from "@/lib/server/auth";
import { runPipeline } from "@/lib/server/hunt/pipeline";
import { createRun, runCompletionSideEffects } from "@/lib/server/hunt/runs";
import { GET } from "@/app/api/hunts/[id]/stream/route";

const mockSession = vi.mocked(getSessionUserId);
const mockPipeline = vi.mocked(runPipeline);
const mockSideEffects = vi.mocked(runCompletionSideEffects);

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
});

describe("stream route (live handler, mocked session+pipeline)", () => {
  it("403s when a signed-in user opens someone else's run — pipeline never runs", async () => {
    const run = await createRun(DEF, "user-1", {
      kind: "standard",
      mode: "real",
      userId: "user-1",
      deviceId: "d",
      poolKey: "user-1",
      charged: false,
    });
    mockSession.mockResolvedValue("user-2");
    const res = await get(run.id);
    expect(res.status).toBe(403);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it("lets the owner run; a second GET attaches instead of re-executing", async () => {
    const run = await createRun(DEF, "user-1", {
      kind: "standard",
      mode: "real",
      userId: "user-1",
      deviceId: "d",
      poolKey: "user-1",
      charged: false,
    });
    mockSession.mockResolvedValue("user-1");

    // Slow the pipeline down so the second GET lands mid-run.
    mockPipeline.mockImplementationOnce(async (_def, emit) => {
      await new Promise((r) => setTimeout(r, 300));
      emit({ type: "done", results: [], stats: {} } as never);
      return { results: [], stats: {}, endCursor: undefined } as never;
    });

    const [r1, r2] = await Promise.all([get(run.id), get(run.id)]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const [b1, b2] = await Promise.all([readAll(r1), readAll(r2)]);
    expect(b1).toContain('"type":"done"');
    expect(b2).toContain('"type":"done"');
    // Exactly ONE pipeline execution for two concurrent GETs.
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });

  it("replays the log after completion without re-running", async () => {
    const run = await createRun(DEF, null, {
      kind: "guest",
      mode: "real",
      userId: null,
      deviceId: "d",
      poolKey: "d",
      charged: false,
    });
    mockSession.mockResolvedValue(null);
    const r1 = await get(run.id);
    await readAll(r1);
    expect(mockPipeline).toHaveBeenCalledTimes(1);

    const t0 = Date.now();
    const r2 = await get(run.id);
    const b2 = await readAll(r2);
    const dt = Date.now() - t0;
    expect(b2).toContain('"type":"done"');
    expect(mockPipeline).toHaveBeenCalledTimes(1); // no re-execution
    expect(dt).toBeLessThan(2000); // instant replay, not a re-run
  });

  it("finding #21: all-detailUnknown results → sawResults false (refund path)", async () => {
    const run = await createRun(DEF, "user-1", {
      kind: "standard",
      mode: "real",
      userId: "user-1",
      deviceId: "d",
      poolKey: "user-1",
      charged: true,
    });
    mockSession.mockResolvedValue("user-1");
    mockPipeline.mockImplementationOnce(async (_def, emit) => {
      emit({
        type: "done",
        results: [
          { sourceAdId: "a1", title: "t", score: 0.5, detailUnknown: true },
          { sourceAdId: "a2", title: "t", score: 0.4, detailUnknown: true },
        ],
        stats: {},
      } as never);
      return { results: [], stats: {}, endCursor: undefined } as never;
    });
    const res = await get(run.id);
    await readAll(res);
    // detailUnknown ads are not "results" — the user pays for hunts,
    // not for our detail-fetch errors.
    expect(mockSideEffects).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sawResults: false })
    );
  });

  it("finding #21: mixed verified + detailUnknown → sawResults true", async () => {
    const run = await createRun(DEF, "user-1", {
      kind: "standard",
      mode: "real",
      userId: "user-1",
      deviceId: "d",
      poolKey: "user-1",
      charged: true,
    });
    mockSession.mockResolvedValue("user-1");
    mockPipeline.mockImplementationOnce(async (_def, emit) => {
      emit({
        type: "done",
        results: [
          { sourceAdId: "a1", title: "t", score: 1 },
          { sourceAdId: "a2", title: "t", score: 0.4, detailUnknown: true },
        ],
        stats: {},
      } as never);
      return { results: [], stats: {}, endCursor: undefined } as never;
    });
    const res = await get(run.id);
    await readAll(res);
    expect(mockSideEffects).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sawResults: true })
    );
  });
});
