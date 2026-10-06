import { describe, expect, it } from "vitest";

import {
  canOpenRun,
  claimIdempotency,
  claimRunForExecution,
  createRun,
  getRun,
  releaseIdempotency,
} from "./runs";

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

describe("hunt run lifecycle (findings #3/#4)", () => {
  it("issues unguessable UUID run ids", async () => {
    const run = await createRun(DEF, null, QUOTA);
    expect(run.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("exactly one execution per run — the second claim fails", async () => {
    const run = await createRun(DEF, null, QUOTA);
    expect(run.status).toBe("created");
    expect(await claimRunForExecution(run)).toBe(true);
    expect(run.status).toBe("running");
    // A racing second GET can never become the owner.
    expect(await claimRunForExecution(run)).toBe(false);
  });

  it("ownership: registered users open only their own runs", async () => {
    const mine = await createRun(DEF, "user-1", { ...QUOTA, userId: "user-1" });
    expect(canOpenRun(mine, "user-1")).toBe(true);
    expect(canOpenRun(mine, "user-2")).toBe(false);
    expect(canOpenRun(mine, null)).toBe(false);
  });

  it("ownership: guest runs are capability-protected (anyone with the UUID)", async () => {
    const guest = await createRun(DEF, null, QUOTA);
    expect(canOpenRun(guest, null)).toBe(true);
    // A logged-in user opening their own guest run still works.
    expect(canOpenRun(guest, "user-9")).toBe(true);
  });

  it("getRun returns the run with its lifecycle fields", async () => {
    const run = await createRun(DEF, "u1", { ...QUOTA, userId: "u1" });
    const fetched = await getRun(run.id);
    expect(fetched?.status).toBe("created");
    expect(fetched?.eventLog).toEqual([]);
    expect(fetched?.finalized).toBe(false);
  });
});

describe("idempotency, in-memory backend (finding #9 fallback)", () => {
  it("a claimed key dedupes to the same run id; the claimed id is honored by createRun", async () => {
    const key = `tap-${Date.now()}-a`;
    const c1 = await claimIdempotency(key);
    expect(c1.fresh).toBe(true);
    const run = await createRun(DEF, null, QUOTA, key, undefined, c1.runId);
    expect(run.id).toBe(c1.runId);
    const c2 = await claimIdempotency(key);
    expect(c2.fresh).toBe(false);
    expect(c2.runId).toBe(c1.runId);
  });

  it("releasing a key (quota denied) lets a later tap claim fresh", async () => {
    const key = `tap-${Date.now()}-b`;
    const c1 = await claimIdempotency(key);
    expect(c1.fresh).toBe(true);
    await releaseIdempotency(key);
    const c2 = await claimIdempotency(key);
    expect(c2.fresh).toBe(true);
    expect(c2.runId).not.toBe(c1.runId);
  });

  it("concurrent claims for one key yield exactly one fresh winner", async () => {
    const key = `tap-${Date.now()}-c`;
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => claimIdempotency(key))
    );
    const fresh = claims.filter((c) => c.fresh);
    expect(fresh).toHaveLength(1);
    const winner = fresh[0].runId;
    for (const c of claims) expect(c.runId).toBe(winner);
  });
});
