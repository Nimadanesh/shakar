import { describe, expect, it } from "vitest";
import { fa, pickVariant } from "./hunt-copy";

describe("fa", () => {
  it("converts digits to Persian", () => {
    expect(fa(47)).toBe("۴۷");
    expect(fa("123")).toBe("۱۲۳");
  });
});

describe("pickVariant", () => {
  const variants = ["a", "b", "c"];
  it("is deterministic for the same runId + stage", () => {
    expect(pickVariant("run1", "filter", variants)).toBe(pickVariant("run1", "filter", variants));
  });
  it("varies across stages and runs", () => {
    const seen = new Set(
      ["r1", "r2", "r3", "r4", "r5"].map((r) => pickVariant(r, "filter", variants))
    );
    expect(seen.size).toBeGreaterThan(1);
  });
  it("always returns a valid variant", () => {
    for (let i = 0; i < 20; i++) {
      expect(variants).toContain(pickVariant(`run${i}`, "s", variants));
    }
  });
});
