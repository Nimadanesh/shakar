import { describe, expect, it } from "vitest";
import { interpretQuery } from "@/lib/interpret";
import { buildEffectiveContext, EMPTY_CONTEXT_BASE } from "@/lib/search-context";

const QUERY = "پیانو یاماها تهران زیر ۲۰۰ میلیون";

function interp() {
  return interpretQuery(QUERY);
}

describe("buildEffectiveContext", () => {
  it("applies inferred city and price when nothing explicit is set", () => {
    const ctx = buildEffectiveContext(QUERY, EMPTY_CONTEXT_BASE, interp(), new Set());
    expect(ctx.city).toBe("tehran");
    expect(ctx.priceMax).toBe(200000000);
    expect(ctx.priceMin).toBeNull();
  });

  it("lets explicit controls override inferred values", () => {
    const ctx = buildEffectiveContext(
      QUERY,
      { ...EMPTY_CONTEXT_BASE, city: "isfahan", priceMax: "100000000" },
      interp(),
      new Set()
    );
    // City is the exception: the query text is the freshest signal, so the
    // text-named city wins over a stored preference (flagged inferred in UI).
    expect(ctx.city).toBe("tehran");
    expect(ctx.priceMax).toBe(100000000);
  });

  it("keeps the stored city while the text stays silent about location", () => {
    const ctx = buildEffectiveContext(
      "پیانو یاماها زیر ۲۰۰ میلیون",
      { ...EMPTY_CONTEXT_BASE, city: "isfahan" },
      interpretQuery("پیانو یاماها زیر ۲۰۰ میلیون"),
      new Set()
    );
    expect(ctx.city).toBe("isfahan");
  });

  it("respects dismissed inferred constraints", () => {
    const ctx = buildEffectiveContext(QUERY, EMPTY_CONTEXT_BASE, interp(), new Set(["city:tehran"]));
    expect(ctx.city).toBe("all");
    expect(ctx.priceMax).toBe(200000000);
  });

  it("combines explicit and inferred excludes without duplicates", () => {
    const withExclude = interpretQuery("پیانو دیجیتال نمیخوام");
    const ctx = buildEffectiveContext(
      "پیانو دیجیتال نمیخوام",
      { ...EMPTY_CONTEXT_BASE, exclude: ["پیانو دیجیتال"] },
      withExclude,
      new Set()
    );
    expect(ctx.excludeKeywords).toEqual(["پیانو دیجیتال"]);
  });

  it("never lets preferences enter the context", () => {
    const ctx = buildEffectiveContext(
      "پیانو ترجیحا U3",
      EMPTY_CONTEXT_BASE,
      interpretQuery("پیانو ترجیحا U3"),
      new Set()
    );
    expect(ctx.includeKeywords).toEqual([]);
  });

  it("marks city scope hard for location-bound hunts", () => {
    const q = "خونه ۵۰ متری تهران";
    const ctx = buildEffectiveContext(q, EMPTY_CONTEXT_BASE, interpretQuery(q), new Set());
    expect(ctx.city).toBe("tehran");
    expect(ctx.cityScope).toBe("hard");
  });

  it("marks city scope hard for the vehicles category", () => {
    const q = "۲۰۶ تیپ ۲ مشهد";
    const ctx = buildEffectiveContext(
      q,
      { ...EMPTY_CONTEXT_BASE, category: "vehicles" },
      interpretQuery(q),
      new Set()
    );
    expect(ctx.city).toBe("mashhad");
    expect(ctx.cityScope).toBe("hard");
  });

  it("marks city scope soft for shippable goods — never a silent filter", () => {
    const ctx = buildEffectiveContext(QUERY, EMPTY_CONTEXT_BASE, interp(), new Set());
    expect(ctx.city).toBe("tehran");
    expect(ctx.cityScope).toBe("soft");
  });

  it("has no city scope when no city is set", () => {
    const q = "پیانو یاماها";
    const ctx = buildEffectiveContext(q, EMPTY_CONTEXT_BASE, interpretQuery(q), new Set());
    expect(ctx.city).toBe("all");
    expect(ctx.cityScope).toBeNull();
  });
});
