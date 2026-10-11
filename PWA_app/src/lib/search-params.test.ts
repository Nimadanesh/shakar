import { describe, expect, it } from "vitest";

import { EMPTY_CONTEXT_BASE, type ContextBase } from "@/lib/search-context";
import { readParams, writeParams } from "./search-params";

function base(over: Partial<ContextBase> = {}): ContextBase {
  return { ...EMPTY_CONTEXT_BASE, ...over };
}

describe("search-params multi-location round-trip", () => {
  it("round-trips several places exactly", () => {
    const url = writeParams("گوشی", base({ city: "tehran", cities: ["tehran", "karaj", "qom"] }));
    expect(url).toContain("cities=tehran%2Ckaraj%2Cqom");
    // Legacy readers see the first city rather than all-locations.
    expect(url).toContain("city=tehran");
    const back = readParams(new URLSearchParams(url.slice(2)));
    expect(back.base.cities).toEqual(["tehran", "karaj", "qom"]);
    expect(back.base.city).toBe("tehran");
    expect(back.query).toBe("گوشی");
  });

  it("reads legacy single-city links into the canonical set", () => {
    const back = readParams(new URLSearchParams("?q=x&city=karaj"));
    expect(back.base.cities).toEqual(["karaj"]);
    expect(back.base.city).toBe("karaj");
  });

  it("writes a single city in the legacy shape and all-cities bare", () => {
    expect(writeParams("x", base({ city: "karaj" }))).toContain("city=karaj");
    expect(writeParams("x", base({ city: "karaj" }))).not.toContain("cities=");
    expect(writeParams("x", base({ city: "all" }))).not.toContain("city=");
    expect(writeParams("x", base({ city: "all" }))).not.toContain("cities=");
  });

  it("prefers cities over a conflicting legacy city", () => {
    const back = readParams(new URLSearchParams("?q=x&city=karaj&cities=tehran%2Cqom"));
    expect(back.base.cities).toEqual(["tehran", "qom"]);
    expect(back.base.city).toBe("tehran");
  });
});
