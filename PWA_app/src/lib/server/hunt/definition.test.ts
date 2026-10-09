import { describe, expect, it } from "vitest";

import { parsePriceBound, resolveHuntDefinition } from "./definition";
import { textMatches } from "@/lib/persianNormalize";

function body(over: Record<string, unknown> = {}) {
  return {
    query: "پیانو U3 تهران",
    include: [],
    exclude: [],
    city: "all",
    category: "all",
    priceMin: "",
    priceMax: "",
    transaction: "",
    condition: "",
    ...over,
  };
}

describe("resolveHuntDefinition — the «پیانو» incident (2026-10-06)", () => {
  it("makes the query's content terms mandatory", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.include).toContain("پیانو");
    expect(def.include).toContain("U3");
    // Structural words never become content terms.
    expect(def.include).not.toContain("تهران");
  });

  it("a pigeon ad can no longer pass a piano hunt", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.include.length).toBeGreaterThan(0);
    // The old code passed EVERY ad vacuously (include=[]). Now every
    // mandatory term must match — «کفتر» matches none of them.
    const pigeonPasses = def.include.every((t) =>
      textMatches("کفتر مسابقه‌ای اصیل", t)
    );
    expect(pigeonPasses).toBe(false);
    const pianoPasses = def.include.every((t) =>
      textMatches("پیانو یاماها U3 در حد آکبند", t)
    );
    expect(pianoPasses).toBe(true);
  });

  it("applies the text city when the picker is all", () => {
    expect(resolveHuntDefinition(body())!.city).toBe("tehran");
  });

  it("text city beats a stored/remembered picker value (navid 2026-10-08)", () => {
    // The piano hunt DISPLAYED تهران but searched تبریز — the remembered
    // picker silently won. The query text is the freshest signal.
    const def = resolveHuntDefinition(body({ city: "tabriz" }))!;
    expect(def.city).toBe("tehran");
    expect(def.citySource).toBe("text");
  });

  it("a dismissed city inference keeps the picker value", () => {
    const def = resolveHuntDefinition(
      body({ city: "tabriz", dismissed: ["city:tehran"] })
    )!;
    expect(def.city).toBe("tabriz");
    expect(def.citySource).toBe("picker");
  });

  it("records citySource picker when the text names no city", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو U3", city: "tabriz" })
    )!;
    expect(def.city).toBe("tabriz");
    expect(def.citySource).toBe("picker");
  });

  it("applies the text category when the picker is all (flaw #10)", () => {
    const def = resolveHuntDefinition(
      body({ query: "آپارتمان نوساز سعادت آباد" })
    )!;
    expect(def.category).toBe("real-estate");
  });

  it("keeps an explicit category over the text", () => {
    const def = resolveHuntDefinition(
      body({ query: "آپارتمان نوساز سعادت آباد", category: "vehicles" })
    )!;
    expect(def.category).toBe("vehicles");
  });

  it("detects the piano category from text (music)", () => {
    expect(resolveHuntDefinition(body())!.category).toBe("music");
  });

  it("honors a dismissed city reading — but keeps the content terms", () => {
    const def = resolveHuntDefinition(body({ dismissed: ["city:tehran"] }))!;
    expect(def.city).toBe("all");
    expect(def.include).toContain("پیانو");
  });

  it("extracts price bounds from text without leaking them into terms", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی زیر ۲۰۰ میلیون" }))!;
    expect(def.priceMax).toBe("200000000");
    expect(def.include).toContain("گوشی");
    expect(def.include).not.toContain("۲۰۰");
    expect(def.include).not.toContain("میلیون");
    expect(def.include).not.toContain("تا");
  });

  it("applies inline «نه» excludes without keeping the cue word", () => {
    const def = resolveHuntDefinition(body({ query: "پیانو نه دیجیتال" }))!;
    expect(def.exclude).toContain("دیجیتال");
    expect(def.include).toContain("پیانو");
    expect(def.include).not.toContain("نه");
  });

  it("does not invent terms for an empty query", () => {
    expect(resolveHuntDefinition(body({ query: "" }))).toBeNull();
    expect(resolveHuntDefinition(body({ query: "   " }))).toBeNull();
  });

  it("a city-only query yields no content terms (honest city browse)", () => {
    const def = resolveHuntDefinition(body({ query: "تهران" }))!;
    expect(def.include).toEqual([]);
    expect(def.city).toBe("tehran");
  });

  it("merges with explicit include chips without duplicating", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو یاماها", include: ["یاماها"] })
    )!;
    expect(def.include.filter((t) => t === "یاماها")).toHaveLength(1);
    expect(def.include).toContain("پیانو");
  });
});

describe("resolveHuntDefinition — SHOULD bucket (flaw #19, 2026-10-09)", () => {
  it("maps «ترجیحاً» wishes to should (ranking-only)", () => {
    const def = resolveHuntDefinition(body({ query: "گوشی ترجیحاً تمیز" }))!;
    expect(def.should).toContain("تمیز");
    expect(def.include).toContain("گوشی");
    expect(def.include).not.toContain("تمیز");
    expect(def.include).not.toContain("ترجیحاً");
  });

  it("dedupes should against include chips", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو ترجیحاً تمیز", include: ["تمیز"] })
    )!;
    expect(def.should).not.toContain("تمیز");
    expect(def.include).toContain("تمیز");
  });

  it("dedupes should against exclude terms", () => {
    const def = resolveHuntDefinition(
      body({ query: "پیانو ترجیحاً کهنه", exclude: ["کهنه"] })
    )!;
    expect(def.should).not.toContain("کهنه");
  });

  it("defaults should to [] when there are no preferences", () => {
    const def = resolveHuntDefinition(body())!;
    expect(def.should).toEqual([]);
  });
});

describe("parsePriceBound", () => {  it("parses digits-only and Persian digits", () => {
    expect(parsePriceBound("200000000")).toBe(200000000);
    expect(parsePriceBound("۲۰۰")).toBe(200);
  });

  it("rejects garbage and zero", () => {
    expect(parsePriceBound("")).toBeNull();
    expect(parsePriceBound("abc")).toBeNull();
    expect(parsePriceBound("0")).toBeNull();
  });
});
