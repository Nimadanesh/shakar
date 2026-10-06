import { afterEach, describe, expect, it, vi } from "vitest";
import { listKamins } from "@/lib/kamin-store";

/**
 * Regression tests for the /saved crash: a malformed kamin ctx must never
 * throw — it migrates (legacy shapes) or drops the record.
 */
function seedKamins(raw: unknown) {
  const store: Record<string, string> = {
    "shakar:kamins:v1": JSON.stringify(raw),
  };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const goodCtx = {
  query: "پیانو",
  includeKeywords: ["یاماها"],
  excludeKeywords: [],
  category: "music",
  city: "tehran",
  // Derived on normalize: stored kamins predate the field, so the
  // migration computes it (music + tehran → soft).
  cityScope: "soft",
  priceMin: 100000000,
  priceMax: 400000000,
  hasImage: false,
  transaction: "",
};

describe("kamin ctx validation", () => {
  it("drops a kamin whose ctx is not an object instead of crashing", () => {
    seedKamins([
      { id: "k1", name: "خراب", ctx: "not-an-object", seenIds: [], armedAt: 1 },
      { id: "k2", name: "خوب", ctx: goodCtx, seenIds: [], armedAt: 2 },
    ]);
    const kamins = listKamins();
    expect(kamins.map((k) => k.id)).toEqual(["k2"]);
  });

  it("migrates the legacy ContextBase shape", () => {
    seedKamins([
      {
        id: "k1",
        name: "پیانو قدیمی",
        ctx: {
          category: "music",
          city: "tehran",
          priceMin: "100000000",
          priceMax: "400000000",
          include: ["یاماها"],
          exclude: ["دیجیتال"],
          hasImage: false,
        },
        seenIds: [],
        armedAt: 1,
      },
    ]);
    const [kamin] = listKamins();
    expect(kamin.ctx.includeKeywords).toEqual(["یاماها"]);
    expect(kamin.ctx.excludeKeywords).toEqual(["دیجیتال"]);
    expect(kamin.ctx.priceMin).toBe(100000000);
    expect(kamin.ctx.priceMax).toBe(400000000);
    expect(kamin.ctx.query).toBe("پیانو قدیمی");
  });

  it("fills safe defaults for missing fields", () => {
    seedKamins([
      { id: "k1", name: "ناقص", ctx: { query: "x" }, seenIds: [], armedAt: 1 },
    ]);
    const [kamin] = listKamins();
    expect(kamin.ctx).toMatchObject({
      query: "x",
      includeKeywords: [],
      excludeKeywords: [],
      category: "all",
      city: "all",
      priceMin: null,
      priceMax: null,
      hasImage: false,
    });
  });

  it("keeps a valid ctx untouched", () => {
    seedKamins([
      { id: "k1", name: "خوب", ctx: goodCtx, seenIds: ["a"], armedAt: 1 },
    ]);
    const [kamin] = listKamins();
    expect(kamin.ctx).toEqual(goodCtx);
    expect(kamin.seenIds).toEqual(["a"]);
  });
});
