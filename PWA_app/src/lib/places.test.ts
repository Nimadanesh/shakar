import { describe, expect, it } from "vitest";

import { DIVAR_PLACES, DIVAR_PLACE_COUNT } from "@/data/divar-places";
import {
  citySearchText,
  findMentionedPlaceSlugs,
  isPlaceSlug,
  normalizePlaceText,
  PLACE_ALIASES,
  placeBySlug,
  placeLabel,
  placeNameVariants,
  placeNamesForSlug,
  searchPlaces,
} from "./places";

describe("divar place catalog integrity (generated from the official response)", () => {
  it("contains exactly 1,177 verified places", () => {
    expect(DIVAR_PLACE_COUNT).toBe(1177);
    expect(DIVAR_PLACES).toHaveLength(1177);
  });

  it("has unique slugs and complete id/slug/name fields", () => {
    const slugs = new Set<string>();
    for (const p of DIVAR_PLACES) {
      expect(typeof p.id).toBe("number");
      expect(p.slug.trim()).not.toBe("");
      expect(p.name.trim()).not.toBe("");
      expect(slugs.has(p.slug)).toBe(false);
      slugs.add(p.slug);
    }
    expect(slugs.size).toBe(1177);
  });

  it("maps known slugs to verified Divar ids", () => {
    expect(placeBySlug("tehran")).toMatchObject({ id: 1, name: "تهران" });
    expect(placeBySlug("karaj")).toMatchObject({ id: 2 });
    expect(placeBySlug("mashhad")).toMatchObject({ id: 3 });
    expect(placeBySlug("isfahan")).toMatchObject({ id: 4 });
    expect(placeBySlug("shiraz")).toMatchObject({ id: 6 });
    expect(placeBySlug("urmia")).toMatchObject({ id: 10 });
    expect(placeBySlug("bandar-abbas")).toMatchObject({ id: 18 });
    expect(placeBySlug("abadan")).toMatchObject({ id: 24 });
    expect(placeBySlug("khorramabad")).toMatchObject({ id: 27 });
    expect(placeBySlug("eslamshahr")).toMatchObject({ id: 29 });
    expect(placeBySlug("kashan")).toMatchObject({ id: 30 });
    expect(placeBySlug("najafabad")).toMatchObject({ id: 31 });
    expect(placeBySlug("no-such-city")).toBeNull();
  });

  it("preserves verified spelling aliases and nothing else", () => {
    expect(PLACE_ALIASES).toEqual({
      urmia: ["اورمیه"],
      "bandar-abbas": ["بندر عباس"],
      khorramabad: ["خرم آباد"],
    });
    expect(placeNamesForSlug("urmia")).toContain("اورمیه");
    expect(placeNamesForSlug("bandar-abbas")).toContain("بندر عباس");
    expect(placeNamesForSlug("khorramabad")).toContain("خرم آباد");
  });

  it("has exactly one known normalized-variant collision (سیروان)", () => {
    // Two distinct Divar places share the display name سیروان. The
    // multi-match ambiguity guard (no silent guess) exists for cases like
    // this — this test fails loudly if new collisions ever appear.
    const index = new Map<string, string[]>();
    for (const p of DIVAR_PLACES) {
      for (const v of placeNameVariants(p.name, PLACE_ALIASES[p.slug] ?? [])) {
        const key = normalizePlaceText(v);
        index.set(key, [...(index.get(key) ?? []), p.slug]);
      }
    }
    const collisions = [...index.entries()].filter(([, slugs]) => new Set(slugs).size > 1);
    expect(collisions).toEqual([["سیروان", ["sirvan", "sirvan-city"]]]);
  });
});

describe("place search and mention matching", () => {
  it("ranks exact names before prefix and substring matches", () => {
    const res = searchPlaces("تهران", undefined, 5);
    expect(res[0]).toEqual({ slug: "tehran", name: "تهران" });
  });

  it("finds ZWNJ names from space-typed queries and vice versa", () => {
    expect(searchPlaces("خرم آباد").map((p) => p.slug)).toContain("khorramabad");
    expect(searchPlaces("خرم‌آباد").map((p) => p.slug)).toContain("khorramabad");
    expect(searchPlaces("بندر عباس").map((p) => p.slug)).toContain("bandar-abbas");
  });

  it("folds Arabic keyboard variants", () => {
    expect(searchPlaces("اروميه").map((p) => p.slug)).toContain("urmia");
  });

  it("returns [] for unknown spellings instead of guessing", () => {
    expect(searchPlaces("ناکجاآباد")).toEqual([]);
  });

  it("finds single mentions and every mention of several", () => {
    expect(findMentionedPlaceSlugs("آپارتمان در اسلام‌شهر")).toEqual(["eslamshahr"]);
    const multi = findMentionedPlaceSlugs("آپارتمان تهران کرج");
    expect(multi).toContain("tehran");
    expect(multi).toContain("karaj");
    expect(multi.length).toBeGreaterThan(1);
  });

  it("keeps word boundaries (درشت is not رشت)", () => {
    expect(findMentionedPlaceSlugs("ماهی درشت")).toEqual([]);
  });

  it("treats the shared سیروان name as ambiguous (both slugs surface)", () => {
    expect(findMentionedPlaceSlugs("خانه در سیروان")).toEqual(["sirvan", "sirvan-city"]);
  });

  it("labels known slugs and echoes unknown ones", () => {
    expect(placeLabel("tehran")).toBe("تهران");
    expect(placeLabel("nope")).toBe("nope");
    expect(isPlaceSlug("tehran")).toBe(true);
    expect(isPlaceSlug("nope")).toBe(false);
  });

  it("exposes alias spellings in the picker haystack", () => {
    expect(citySearchText("urmia")).toContain("اورمیه");
    expect(citySearchText("bandar-abbas")).toContain("بندر عباس");
    expect(citySearchText("khorramabad")).toContain("خرم آباد");
  });
});
