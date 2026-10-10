import { afterEach, describe, expect, it, vi } from "vitest";

import { fireRealHunt, planFireLocations } from "./hunt-fire";
import { EMPTY_CONTEXT_BASE } from "./search-context";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("planFireLocations — query-versus-picker conflicts", () => {
  it("lets an untouched picker's live inference win (freshest signal)", () => {
    const plan = planFireLocations({
      baseCities: [],
      cityTouched: false,
      inferredCity: { id: "city:tehran", value: "tehran" },
      liveCityIds: ["city:tehran"],
      dismissed: new Set<string>(),
    });
    expect(plan.cities).toEqual(["tehran"]);
    expect([...plan.dismissed]).toEqual([]);
  });

  it("lets an explicit set (including all) win and dismisses live inferences", () => {
    const picked = planFireLocations({
      baseCities: ["karaj", "tehran"],
      cityTouched: true,
      inferredCity: null,
      liveCityIds: ["city:mashhad"],
      dismissed: new Set<string>(),
    });
    expect(picked.cities).toEqual(["karaj", "tehran"]);
    expect([...picked.dismissed]).toEqual(["city:mashhad"]);

    const all = planFireLocations({
      baseCities: [],
      cityTouched: true,
      inferredCity: null,
      liveCityIds: ["city:tehran"],
      dismissed: new Set<string>(),
    });
    expect(all.cities).toEqual([]);
    expect([...all.dismissed]).toContain("city:tehran");
  });

  it("keeps the set when nothing is inferred and preserves prior dismissals", () => {
    const plan = planFireLocations({
      baseCities: ["tabriz"],
      cityTouched: true,
      inferredCity: null,
      liveCityIds: [],
      dismissed: new Set(["city:tehran"]),
    });
    expect(plan.cities).toEqual(["tabriz"]);
    expect([...plan.dismissed]).toEqual(["city:tehran"]);
  });

  it("never lets one inference override an explicit multi-city set", () => {
    const untouched = planFireLocations({
      baseCities: ["tehran", "karaj"],
      cityTouched: false,
      inferredCity: { id: "city:mashhad", value: "mashhad" },
      liveCityIds: ["city:mashhad"],
      dismissed: new Set<string>(),
    });
    expect(untouched.cities).toEqual(["tehran", "karaj"]);
    expect([...untouched.dismissed]).toContain("city:mashhad");
    const touched = planFireLocations({
      baseCities: ["tehran", "karaj"],
      cityTouched: true,
      inferredCity: { id: "city:mashhad", value: "mashhad" },
      liveCityIds: ["city:mashhad"],
      dismissed: new Set<string>(),
    });
    expect(touched.cities).toEqual(["tehran", "karaj"]);
    expect([...touched.dismissed]).toContain("city:mashhad");
  });
});

describe("fireRealHunt payload", () => {
  it("sends the full multi-city selection, never just the first city", async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body?: string }) => {
        sent = JSON.parse(String(init.body ?? "{}"));
        return { ok: true, status: 200, json: async () => ({ ok: true, data: { runId: "r1" } }) };
      })
    );
    const res = await fireRealHunt({
      query: "گوشی",
      base: { ...EMPTY_CONTEXT_BASE, city: "tehran", cities: ["tehran", "karaj"] },
      dismissed: new Set<string>(),
    });
    expect(res).toEqual({ ok: true, runId: "r1" });
    expect(sent.cities).toEqual(["tehran", "karaj"]);
    expect(sent.city).toBe("tehran");
  });
});
