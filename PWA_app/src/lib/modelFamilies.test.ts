import { describe, expect, it } from "vitest";
import { BRAND_ALIASES } from "./brandAliases";
import {
  brandOfFamily,
  familiesOfBrand,
  familyByToken,
  MODEL_FAMILIES,
} from "./modelFamilies";
import {
  brandGroupOfTerm,
  BRAND_SET,
  normalizeForMatch,
} from "./persianNormalize";

describe("HANDOFF-4b — modelFamilies", () => {
  it("has exactly 51 entries across 28 brands", () => {
    expect(MODEL_FAMILIES).toHaveLength(51);
    expect(new Set(MODEL_FAMILIES.map((f) => f.brandId)).size).toBe(28);
  });

  it("has unique ids, and every brandId exists in brandAliases", () => {
    const ids = MODEL_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const brandIds = new Set(BRAND_ALIASES.map((g) => g.id));
    for (const family of MODEL_FAMILIES) {
      expect(brandIds.has(family.brandId)).toBe(true);
    }
  });

  it("does not contain the deleted entries (civic, rana)", () => {
    for (const family of MODEL_FAMILIES) {
      expect(family.fa).not.toBe("سیویک");
      expect(family.fa).not.toBe("رانا");
      expect(family.en).not.toBe("civic");
      expect(family.en).not.toBe("rana");
    }
    expect(familiesOfBrand("honda")).toHaveLength(0);
  });

  it("familyByToken resolves both forms, case- and ZWNJ-insensitively", () => {
    expect(familyByToken("Mavic")?.id).toBe("mavic");
    expect(familyByToken("mavic")?.id).toBe("mavic");
    expect(familyByToken("ماویک")?.id).toBe("mavic");
    expect(familyByToken("مک‌بوک")?.id).toBe("macbook");
    expect(familyByToken("مک بوک")?.id).toBe("macbook");
    expect(familyByToken("G-Shock")?.id).toBe("gshock");
    expect(familyByToken("Santa Fe")?.id).toBe("santafe");
    expect(familyByToken("کوییک")?.id).toBe("کوییک");
    expect(familyByToken("کوییک")?.en).toBe("");
  });

  it("familyByToken rejects set-aside and deleted forms", () => {
    expect(familyByToken("مویک")).toBeUndefined();
    expect(familyByToken("mate")).toBeUndefined();
    expect(familyByToken("quick")).toBeUndefined();
    expect(familyByToken("civic")).toBeUndefined();
    expect(familyByToken("rana")).toBeUndefined();
    expect(familyByToken("osmo")).toBeUndefined();
  });

  it("brandOfFamily and familiesOfBrand are consistent", () => {
    expect(brandOfFamily("mavic")).toBe("dji");
    expect(brandOfFamily("avata")).toBe("dji");
    expect(familiesOfBrand("dji").map((f) => f.id)).toEqual([
      "mavic",
      "avata",
    ]);
    expect(familiesOfBrand("saipa").map((f) => f.id)).toEqual([
      "saina",
      "کوییک",
    ]);
    expect(brandOfFamily("no-such-family")).toBeUndefined();
  });

  it("familyByToken agrees with the engine key shape on every form", () => {
    for (const family of MODEL_FAMILIES) {
      const faKey = normalizeForMatch(family.fa)
        .toLowerCase()
        .replace(/ /g, "");
      expect(familyByToken(faKey)?.id).toBe(family.id);
      if (family.en !== "") {
        expect(familyByToken(family.en)?.id).toBe(family.id);
      }
    }
  });

  it("no family form is also a brand form (term side stays disjoint)", () => {
    for (const family of MODEL_FAMILIES) {
      expect(brandGroupOfTerm(family.fa)).toBeNull();
      if (family.en !== "") {
        expect(brandGroupOfTerm(family.en)).toBeNull();
      }
    }
  });

  it("every family form is in BRAND_SET, so layer B never runs on it", () => {
    for (const family of MODEL_FAMILIES) {
      const faKey = normalizeForMatch(family.fa).replace(/ /g, "");
      expect(BRAND_SET.has(faKey)).toBe(true);
      if (family.en !== "") {
        expect(BRAND_SET.has(family.en)).toBe(true);
      }
    }
  });
});
