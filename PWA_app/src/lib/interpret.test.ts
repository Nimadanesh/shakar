import { describe, expect, it } from "vitest";
import { interpretQuery } from "@/lib/interpret";

function kinds(raw: string): string[] {
  return interpretQuery(raw).applied.map((c) => `${c.kind}:${c.value}`);
}

describe("interpretQuery", () => {
  it("interprets the canonical piano query without inventing precision", () => {
    const { applied, preferences } = interpretQuery(
      "پیانو اکوستیک یاماها میخوام، ترجیحاً U3، تهران باشه، زیر ۲۰۰ میلیون، طرح اکوستیک و دیجیتال نمیخوام."
    );
    expect(kinds).toBeDefined();
    expect(applied.map((c) => c.id)).toContain("city:tehran");
    expect(applied.map((c) => c.id)).toContain("priceMax:200000000");
    // Negation scope stays conservative: conjunction splits into short terms.
    const excludes = applied.filter((c) => c.kind === "exclude").map((c) => c.value);
    expect(excludes).toContain("دیجیتال");
    expect(excludes).toContain("طرح اکوستیک");
    // Preference is surfaced but never applied as a hard filter.
    expect(preferences.map((p) => p.value)).toContain("u3");
    expect(preferences.every((p) => p.applied === false)).toBe(true);
    expect(applied.every((c) => c.source === "inferred")).toBe(true);
  });

  it("keeps vague language vague", () => {
    const { applied, preferences } = interpretQuery("آیفون ۱۵ خوب");
    expect(applied).toEqual([]);
    expect(preferences).toEqual([]);
  });

  it("returns empty interpretation for blank input", () => {
    expect(interpretQuery("   ")).toEqual({ applied: [], preferences: [] });
  });

  it("detects a price floor", () => {
    const { applied } = interpretQuery("آپارتمان بالای ۵ میلیارد تهران");
    expect(applied.map((c) => c.id)).toContain("priceMin:5000000000");
    expect(applied.map((c) => c.id)).toContain("city:tehran");
  });

  it("detects بدون exclusion", () => {
    const { applied } = interpretQuery("مبل راحتی بدون لکه");
    expect(applied.map((c) => c.id)).toContain("exclude:لکه");
  });

  it("detects trailing negation exclusion as a whole phrase", () => {
    const { applied } = interpretQuery("پیانو دیجیتال نمیخوام");
    expect(applied.map((c) => c.id)).toContain("exclude:پیانو دیجیتال");
  });

  it("marks preference cues as display-only", () => {
    const { applied, preferences } = interpretQuery("پراید ترجیحا مدل بالا");
    expect(applied).toEqual([]);
    expect(preferences).toHaveLength(1);
    expect(preferences[0].applied).toBe(false);
  });

  it("does not treat bare numbers as prices", () => {
    const { applied } = interpretQuery("پژو ۲۰۶");
    expect(applied).toEqual([]);
  });
});
