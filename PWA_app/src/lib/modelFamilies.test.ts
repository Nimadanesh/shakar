import { describe, expect, it } from "vitest";
import { BRAND_ALIASES } from "./brandAliases";
import {
  brandOfFamily,
  familiesOfBrand,
  familyByToken,
  FAMILY_NEXT_WORD_KIND,
  FINE_KIND_WORDS,
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

describe("HANDOFF-4c1 — family kinds (table 1) and tables 2 and 3", () => {
  const byId = new Map(MODEL_FAMILIES.map((f) => [f.id, f]));

  it("still has exactly 51 entries, ids and brandIds unchanged", () => {
    expect(MODEL_FAMILIES).toHaveLength(51);
    expect(new Set(MODEL_FAMILIES.map((f) => f.id)).size).toBe(51);
  });

  it("table 1: default kinds match the handoff list", () => {
    expect(byId.get("ipad")?.kind).toBe("tablet");
    expect(byId.get("macbook")?.kind).toBe("laptop");
    expect(byId.get("airpods")?.kind).toBe("headphones");
    expect(byId.get("xperia")?.kind).toBe("phone");
    expect(byId.get("mavic")?.kind).toBe("drone");
    expect(byId.get("gshock")?.kind).toBe("watch");
    expect(byId.get("clavinova")?.kind).toBe("piano");
    expect(byId.get("vitara")?.kind).toBe("car");
    expect(byId.get("کوییک")?.kind).toBe("car");
    expect(byId.get("partybox")?.kind).toBe("speaker");
    expect(byId.get("powercore")?.kind).toBe("powerbank");
    expect(byId.get("bravia")?.kind).toBe("tv");
    expect(byId.get("powershot")?.kind).toBe("camera");
    expect(byId.get("playstation")?.kind).toBe("console");
    expect(byId.get("dedica")?.kind).toBe("coffee-machine");
  });

  it("table 1: multi-kind families have no default kind", () => {
    for (const id of ["galaxy", "redmi", "poco", "soundcore"]) {
      expect(byId.get(id)?.kind).toBeUndefined();
    }
  });

  it("table 2: next-word kinds", () => {
    expect(FAMILY_NEXT_WORD_KIND["tab"]).toBe("tablet");
    expect(FAMILY_NEXT_WORD_KIND["تب"]).toBe("tablet");
    expect(FAMILY_NEXT_WORD_KIND["pad"]).toBe("tablet");
    expect(FAMILY_NEXT_WORD_KIND["watch"]).toBe("watch");
    expect(FAMILY_NEXT_WORD_KIND["ساعت"]).toBe("watch");
    expect(FAMILY_NEXT_WORD_KIND["buds"]).toBe("headphones");
    expect(FAMILY_NEXT_WORD_KIND["بادز"]).toBe("headphones");
    expect(FAMILY_NEXT_WORD_KIND["book"]).toBe("laptop");
    expect(FAMILY_NEXT_WORD_KIND["بوک"]).toBe("laptop");
  });

  it("table 3: fine-kind forms, and نوت‌بوک deliberately absent", () => {
    const forms = new Map(
      FINE_KIND_WORDS.map((e) => [e.kind, e.forms] as const)
    );
    expect(forms.get("phone")).toContain("گوشی");
    expect(forms.get("phone")).toContain("تلفن همراه");
    expect(forms.get("laptop")).toContain("لپ‌تاپ");
    expect(forms.get("watch")).toContain("ساعت هوشمند");
    expect(forms.get("motorcycle")).toContain("موتورسیکلت");
    for (const entry of FINE_KIND_WORDS) {
      expect(entry.forms).not.toContain("نوت‌بوک");
      expect(entry.forms).not.toContain("ماشین");
      expect(entry.forms).not.toContain("ایرپاد");
    }
  });
});
