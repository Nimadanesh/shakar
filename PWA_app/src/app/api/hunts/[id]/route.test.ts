/**
 * Route tests for GET /api/hunts/[id] — the results-VIEW backing.
 * Mocks the session (auth); exercises the REAL handler: real runs map,
 * real 404/403 logic, real terminal-event extraction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

import { getSessionUserId } from "@/lib/server/auth";
import { createRun } from "@/lib/server/hunt/runs";
import { GET } from "@/app/api/hunts/[id]/route";

const mockSession = vi.mocked(getSessionUserId);

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

const QUOTA = { kind: "guest", mode: "permissive-dev", userId: null, deviceId: "d1" } as const;

function get(id: string) {
  return GET(new Request("http://x/"), { params: Promise.resolve({ id }) });
}

const DONE_EVENT = {
  type: "done",
  results: [
    {
      sourceAdId: "tok1",
      title: "گوشی نو",
      price: 100,
      city: "تهران",
      score: 9,
      breakdown: {},
      evidence: ["گوشی"],
    },
  ],
  stats: { adsSeen: 50, titleRejected: 10, dupsCollapsed: 0, candidates: 5, detailsChecked: 5, nearMiss: 0 },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue(null);
});

describe("GET /api/hunts/[id]", () => {
  it("404s on an unknown run id", async () => {
    const res = await get("no-such-run");
    expect(res.status).toBe(404);
  });

  it("403s when a signed-in user opens someone else's run", async () => {
    const run = await createRun(DEF, "owner-1", { ...QUOTA }, "k1");
    mockSession.mockResolvedValue("intruder");
    const res = await get(run.id);
    expect(res.status).toBe(403);
  });

  it("returns running status without results while the hunt is active", async () => {
    const run = await createRun(DEF, null, { ...QUOTA }, "k2");
    const res = await get(run.id);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { status: string; results?: unknown } };
    expect(json.ok).toBe(true);
    expect(json.data.status).not.toBe("done");
    expect(json.data.results).toBeUndefined();
  });

  it("serves the terminal results directly for a completed run (no stream needed)", async () => {
    const run = await createRun(DEF, null, { ...QUOTA }, "k3");
    run.status = "done";
    run.eventLog.push(DONE_EVENT as never);
    const res = await get(run.id);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { status: string; results: Array<{ sourceAdId: string }>; definition: { query: string } };
    };
    expect(json.data.status).toBe("done");
    expect(json.data.results).toHaveLength(1);
    expect(json.data.results[0].sourceAdId).toBe("tok1");
    expect(json.data.definition.query).toBe("گوشی");
  });
});
