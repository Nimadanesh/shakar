import { describe, expect, it } from "vitest";
import { buildRadarConfig, canonicalKey } from "@/lib/radar";
import { EMPTY_SEARCH_CONTEXT } from "@/types/search";

const ctx = {
  ...EMPTY_SEARCH_CONTEXT,
  query: "پیانو یاماها",
  includeKeywords: ["یاماها", "U3"],
  excludeKeywords: ["دیجیتال"],
  city: "tehran",
};

describe("radar", () => {
  it("gives equivalent searches the same identity regardless of order", () => {
    const reordered = {
      ...ctx,
      includeKeywords: ["U3", "یاماها"],
      query: "  پیانو یاماها ",
    };
    expect(canonicalKey(reordered)).toBe(canonicalKey(ctx));
  });

  it("snapshots the exact context without relaxing constraints", () => {
    const radar = buildRadarConfig(ctx, "پیانو U3 تهران");
    expect(radar.id.startsWith("radar-")).toBe(true);
    expect(radar.name).toBe("پیانو U3 تهران");
    expect(radar.context).toEqual(ctx);
    expect(radar.context.includeKeywords).not.toBe(ctx.includeKeywords);
    expect(radar.wanted).toBe(true);
  });

  it("derives a name from the query when none is given", () => {
    expect(buildRadarConfig(ctx, "").name).toBe("پیانو یاماها");
  });
});
