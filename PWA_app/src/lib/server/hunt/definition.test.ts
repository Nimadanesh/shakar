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

  it("keeps an explicit city over the text", () => {
    expect(resolveHuntDefinition(body({ city: "isfahan" }))!.city).toBe(
      "isfahan"
    );
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

describe("parsePriceBound", () => {
  it("parses digits-only and Persian digits", () => {
    expect(parsePriceBound("200000000")).toBe(200000000);
    expect(parsePriceBound("۲۰۰")).toBe(200);
  });

  it("rejects garbage and zero", () => {
    expect(parsePriceBound("")).toBeNull();
    expect(parsePriceBound("abc")).toBeNull();
    expect(parsePriceBound("0")).toBeNull();
  });
});
