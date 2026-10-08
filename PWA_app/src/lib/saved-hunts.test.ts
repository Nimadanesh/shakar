import { describe, expect, it } from "vitest";

import { normalizeBase } from "./saved-hunts";

describe("normalizeBase", () => {
  it("passes through a complete server definition", () => {
    expect(
      normalizeBase({
        category: "mobile",
        city: "tehran",
        priceMin: "1000",
        priceMax: "5000",
        include: ["a"],
        exclude: ["b"],
        hasImage: true,
        transaction: "buy",
        condition: "new",
      })
    ).toEqual({
      category: "mobile",
      city: "tehran",
      priceMin: "1000",
      priceMax: "5000",
      include: ["a"],
      exclude: ["b"],
      hasImage: true,
      transaction: "buy",
      condition: "new",
    });
  });

  it("degrades garbage to all/empty — never null", () => {
    const base = normalizeBase({ category: 42, include: "nope", transaction: "x" });
    expect(base.category).toBe("all");
    expect(base.include).toEqual([]);
    expect(base.transaction).toBe("");
    expect(base).not.toBeNull();
    expect(typeof base).toBe("object");
  });

  it("handles null/undefined definitions", () => {
    for (const def of [null, undefined, 42, "x"]) {
      const base = normalizeBase(def);
      expect(base.city).toBe("all");
      expect(base.include).toEqual([]);
    }
  });
});
