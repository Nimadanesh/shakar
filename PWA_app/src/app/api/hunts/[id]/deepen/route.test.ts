/**
 * Route-level one-deepen-per-hunt tests (finding #12, bug-bounty round 3).
 * Mocks only the session (auth) — exercises the REAL deepen route with the
 * REAL runs module on the memory backend: real pre-check, real 400s.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

import { getSessionUserId } from "@/lib/server/auth";
import { createRun } from "@/lib/server/hunt/runs";
import { POST } from "@/app/api/hunts/[id]/deepen/route";

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

const QUOTA = {
  kind: "guest" as const,
  mode: "real" as const,
  userId: null,
  deviceId: "d1",
  charged: true,
};

function post(id: string) {
  return POST(new Request("http://x/", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

/** A finished parent run, ready to deepen (guest → no auth friction). */
async function doneParent() {
  const run = await createRun(DEF, null, QUOTA);
  run.status = "done";
  return run;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue(null);
});

describe("POST /api/hunts/[id]/deepen — one deepen per hunt", () => {
  it("deepens a done run once → 202 with the child run id", async () => {
    const parent = await doneParent();
    const res = await post(parent.id);
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.runId).not.toBe(parent.id);
  });

  it("deepening the same run twice → second is 400 already-deepened", async () => {
    const parent = await doneParent();
    const first = await post(parent.id);
    expect(first.status).toBe(202);
    const second = await post(parent.id);
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ ok: false, error: "already-deepened" });
  });

  it("deepening a deep run still returns already-deep", async () => {
    const deep = await createRun({ ...DEF, deepHistory: true }, null, QUOTA);
    deep.status = "done";
    const res = await post(deep.id);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "already-deep" });
  });

  it("deepening a non-done run → 409", async () => {
    const parent = await createRun(DEF, null, QUOTA);
    const res = await post(parent.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, error: "hunt-not-finished" });
  });

  it("unknown run → 404", async () => {
    const res = await post("00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });
});
