import { describe, expect, it } from "vitest";

import { planFireCity } from "./hunt-fire";

describe("planFireCity — query-versus-picker conflicts", () => {
  it("lets an untouched picker's live inference win (freshest signal)", () => {
    const plan = planFireCity({
      baseCity: "all",
      cityTouched: false,
      inferredCity: { id: "city:tehran", value: "tehran" },
      liveCityIds: ["city:tehran"],
      dismissed: new Set<string>(),
    });
    expect(plan.city).toBe("tehran");
    expect([...plan.dismissed]).toEqual([]);
  });

  it("lets an explicit pick (including all) win and dismisses live inferences", () => {
    const picked = planFireCity({
      baseCity: "karaj",
      cityTouched: true,
      inferredCity: null,
      liveCityIds: ["city:tehran"],
      dismissed: new Set<string>(),
    });
    expect(picked.city).toBe("karaj");
    expect([...picked.dismissed]).toEqual(["city:tehran"]);

    const all = planFireCity({
      baseCity: "all",
      cityTouched: true,
      inferredCity: null,
      liveCityIds: ["city:tehran"],
      dismissed: new Set<string>(),
    });
    expect(all.city).toBe("all");
    expect([...all.dismissed]).toContain("city:tehran");
  });

  it("keeps the pick when nothing is inferred and preserves prior dismissals", () => {
    const plan = planFireCity({
      baseCity: "tabriz",
      cityTouched: true,
      inferredCity: null,
      liveCityIds: [],
      dismissed: new Set(["city:tehran"]),
    });
    expect(plan.city).toBe("tabriz");
    expect([...plan.dismissed]).toEqual(["city:tehran"]);
  });
});
