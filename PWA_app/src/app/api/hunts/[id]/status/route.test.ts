/**
 * Route tests for GET /api/hunts/[id]/status — the featherweight status
 * endpoint the ActiveHuntChip polls (navid 2026-10-08). Must return ONLY
 * the status (never the results array), with the same 404/403 semantics
 * as the full GET.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({
  getSessionUserId: vi.fn(),
}));

import { getSessionUserId } from "@/lib/server/auth";
import { createRun } from "@/lib/server/hunt/runs";
import { GET } from "@/app/api/hunts/[id]/status/route";

const mockSession = vi.mocked(getSessionUserId);

const DEF = {
  query: "گوشی",
  include: ["گوشی"],
  exclude: [],
  should: [],
  city: "tehran",
  category: "mobile",
  priceMin: "",
  priceMax: "",
  transaction: "" as const,
  condition: "" as const,
};

const QUOTA = { kind: "guest", mode: "permissive-dev", userId: null, deviceId: "d1", poolKey: "d1", charged: true } as const;

function get(id: string) {
  return GET(new Request("http://x/"), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue(null);
});

describe("GET /api/hunts/[id]/status", () => {
  it("404s on an unknown run id", async () => {
    const res = await get("no-such-run");
    expect(res.status).toBe(404);
  });

  it("403s when a signed-in user polls someone else's run", async () => {
    const run = await createRun(DEF, "owner-1", { ...QUOTA }, "k1");
    mockSession.mockResolvedValue("intruder");
    const res = await get(run.id);
    expect(res.status).toBe(403);
  });

  it("returns only the status for a running hunt — never the results", async () => {
    const run = await createRun(DEF, null, { ...QUOTA }, "k2");
    const res = await get(run.id);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: Record<string, unknown> };
    expect(json.ok).toBe(true);
    expect(typeof json.data.status).toBe("string");
    expect(json.data.status).not.toBe("done");
    // The whole point: no results payload for the poller.
    expect("results" in json.data).toBe(false);
    expect("stats" in json.data).toBe(false);
  });
});
