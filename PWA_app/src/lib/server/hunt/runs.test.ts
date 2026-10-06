import { describe, expect, it } from "vitest";

import {
  canOpenRun,
  claimRunForExecution,
  createRun,
  getRun,
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
  it("issues unguessable UUID run ids", () => {
    const run = createRun(DEF, null, QUOTA);
    expect(run.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("exactly one execution per run — the second claim fails", () => {
    const run = createRun(DEF, null, QUOTA);
    expect(run.status).toBe("created");
    expect(claimRunForExecution(run)).toBe(true);
    expect(run.status).toBe("running");
    // A racing second GET can never become the owner.
    expect(claimRunForExecution(run)).toBe(false);
  });

  it("ownership: registered users open only their own runs", () => {
    const mine = createRun(DEF, "user-1", { ...QUOTA, userId: "user-1" });
    expect(canOpenRun(mine, "user-1")).toBe(true);
    expect(canOpenRun(mine, "user-2")).toBe(false);
    expect(canOpenRun(mine, null)).toBe(false);
  });

  it("ownership: guest runs are capability-protected (anyone with the UUID)", () => {
    const guest = createRun(DEF, null, QUOTA);
    expect(canOpenRun(guest, null)).toBe(true);
    // A logged-in user opening their own guest run still works.
    expect(canOpenRun(guest, "user-9")).toBe(true);
  });

  it("getRun returns the run with its lifecycle fields", () => {
    const run = createRun(DEF, "u1", { ...QUOTA, userId: "u1" });
    const fetched = getRun(run.id);
    expect(fetched?.status).toBe("created");
    expect(fetched?.eventLog).toEqual([]);
    expect(fetched?.finalized).toBe(false);
  });
});
