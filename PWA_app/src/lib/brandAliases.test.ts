import { describe, expect, it } from "vitest";
import { BRAND_ALIASES } from "./brandAliases";
import {
  BRAND_SET,
  brandGroupOfTerm,
  brandGroupsInText,
  normalizeForMatch,
  subjectMatchesByOneLetter,
  textMatches,
  textMatchesInclude,
} from "./persianNormalize";

describe("HANDOFF-4 — brand list (closed, exactly the handoff list)", () => {
  it("has 71 groups with unique ids", () => {
    expect(BRAND_ALIASES).toHaveLength(71);
    const ids = BRAND_ALIASES.map((g) => g.id);
    expect(new Set(ids).size).toBe(71);
  });

  it("every listed form maps to its own group (catches key collisions)", () => {
    for (const group of BRAND_ALIASES) {
      for (const form of [...group.fa, ...group.latin]) {
        expect(brandGroupOfTerm(form)).toBe(group.id);
      }
    }
  });

  it("has no Persian form for dell, bose, braun, jac (common Persian words)", () => {
    for (const id of ["dell", "bose", "braun", "jac"]) {
      const group = BRAND_ALIASES.find((g) => g.id === id);
      expect(group).toBeDefined();
      expect(group!.fa).toHaveLength(0);
    }
    expect(brandGroupOfTerm("دل")).toBeNull();
    expect(brandGroupOfTerm("براون")).toBeNull();
    expect(brandGroupOfTerm("بوز")).toBeNull();
    expect(brandGroupOfTerm("جک")).toBeNull();
  });

  it("N-group brands resolve too (honda, nintendo, iphone, rayban)", () => {
    expect(brandGroupOfTerm("هوندا")).toBe("honda");
    expect(brandGroupOfTerm("هندا")).toBe("honda");
    expect(brandGroupOfTerm("honda")).toBe("honda");
    expect(brandGroupOfTerm("نینتندو")).toBe("nintendo");
    expect(brandGroupOfTerm("نیتندو")).toBe("nintendo");
    expect(brandGroupOfTerm("آیفون")).toBe("iphone");
    expect(brandGroupOfTerm("iphone")).toBe("iphone");
    expect(brandGroupOfTerm("ری‌بن")).toBe("rayban");
    expect(brandGroupOfTerm("rayban")).toBe("rayban");
  });
});

describe("HANDOFF-4 R1 — exact brand matching in text", () => {
  it("Persian ↔ Latin forms are equal", () => {
    expect(brandGroupsInText("Sony WH-1000XM4 نو")).toEqual(new Set(["sony"]));
    expect(brandGroupsInText("هدفون سونی اصل")).toEqual(new Set(["sony"]));
    expect(brandGroupsInText("JBL Flip 6 اصلی")).toEqual(new Set(["jbl"]));
    expect(brandGroupsInText("اسپیکر جی‌بی‌ال")).toEqual(new Set(["jbl"]));
    expect(brandGroupsInText("اسپیکر جی بی ال")).toEqual(new Set(["jbl"]));
    expect(brandGroupsInText("LG OLED 55 اینچ")).toEqual(new Set(["lg"]));
    expect(brandGroupsInText("تلویزیون ال‌جی")).toEqual(new Set(["lg"]));
    expect(brandGroupsInText("Peugeot 206 تیپ ۲")).toEqual(
      new Set(["peugeot"])
    );
    expect(brandGroupsInText("پژو ۲۰۶")).toEqual(new Set(["peugeot"]));
  });

  it("Latin is case-insensitive and ignores - and .", () => {
    expect(brandGroupsInText("SAMSUNG نو")).toEqual(new Set(["samsung"]));
    expect(brandGroupsInText("تلویزیون x.vision")).toEqual(
      new Set(["xvision"])
    );
  });

  it("a two-letter Latin brand after a number is not a brand", () => {
    expect(brandGroupsInText("کمپرسور باد 2 hp")).toEqual(new Set());
    expect(brandGroupsInText("کمپرسور باد 2hp")).toEqual(new Set());
    expect(brandGroupsInText("HP Pavilion 15")).toEqual(new Set(["hp"]));
  });

  it("full-word equality only: no prefix, no substring, no fuzzy", () => {
    expect(brandGroupsInText("عروسک سونیا")).toEqual(new Set());
    expect(brandGroupsInText("کیف سامسونت مشکی")).toEqual(new Set());
    expect(brandGroupsInText("کیف سامسونگ")).toEqual(new Set(["samsung"]));
  });

  it("multi-form groups share one id", () => {
    expect(brandGroupsInText("گوشی شیامی")).toEqual(new Set(["xiaomi"]));
    expect(brandGroupsInText("گوشی شیاومی")).toEqual(new Set(["xiaomi"]));
    expect(brandGroupsInText("لپ‌تاپ اسوس")).toEqual(new Set(["asus"]));
    expect(brandGroupsInText("اسپیکر آنکر")).toEqual(new Set(["anker"]));
    expect(brandGroupsInText("جارو فلیپس")).toEqual(new Set(["philips"]));
    expect(brandGroupsInText("ماشین هیوندا")).toEqual(new Set(["hyundai"]));
    expect(brandGroupsInText("بنز کلاس E")).toEqual(new Set(["benz"]));
    expect(brandGroupsInText("مرسدس بنز")).toEqual(new Set(["benz"]));
    expect(brandGroupsInText("mercedes")).toEqual(new Set(["benz"]));
  });

  it("textMatchesInclude / textMatches use the brand rule (include + exclude paths)", () => {
    expect(textMatchesInclude("Sony WH-1000XM4 نو", "سونی")).toBe(true);
    expect(textMatchesInclude("هدفون سونی اصل", "sony")).toBe(true);
    expect(textMatches("هدفون Sony اصل", "سونی")).toBe(true);
    expect(textMatchesInclude("عروسک سونیا", "سونی")).toBe(false);
    expect(textMatchesInclude("کیف سامسونت مشکی", "سامسونگ")).toBe(false);
    expect(textMatchesInclude("کمپرسور باد 2 hp", "اچ‌پی")).toBe(false);
  });

  it("all new brands are in BRAND_SET, so layer B never runs on them", () => {
    for (const group of BRAND_ALIASES) {
      for (const form of [...group.fa, ...group.latin]) {
        const key = normalizeForMatch(form).replace(/ /g, "");
        expect(BRAND_SET.has(key)).toBe(true);
      }
    }
    // A one-letter-apart brand form still gets no guess (brand block).
    expect(subjectMatchesByOneLetter("شیامی", "شیامو")).toBe(false);
    expect(subjectMatchesByOneLetter("سامسونگ", "سامسونت")).toBe(false);
  });
});
