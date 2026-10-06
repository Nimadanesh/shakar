import { describe, expect, it } from "vitest";
import { canonicalTitle, dupKey, isRepost } from "./nearDup";

describe("canonicalTitle", () => {
  it("unifies keyboard variants and spacing", () => {
    expect(canonicalTitle("پيانو  آكوستيك")).toBe(canonicalTitle("پیانو آکوستیک"));
  });
});

describe("dupKey / isRepost", () => {
  const ad = {
    title: "پیانو آکوستیک یاماها",
    price: "120000000",
    city: "تهران",
    district: "سعادت‌آباد",
  };

  it("flags a repost (same title+price+city+district, different ad id) as dup", () => {
    expect(isRepost(ad, { ...ad })).toBe(true);
  });

  it("still matches when the repost was typed with Arabic keyboard", () => {
    expect(
      isRepost(ad, { title: "پيانو آكوستيك یاماها", price: "120000000", city: "تهران", district: "سعادت‌آباد" })
    ).toBe(true);
  });

  it("does not flag a real price drop as a dup", () => {
    expect(isRepost(ad, { ...ad, price: "110000000" })).toBe(false);
  });

  it("does not flag a different ad as a dup", () => {
    expect(isRepost(ad, { ...ad, title: "پیانو دیجیتال یاماها" })).toBe(false);
  });

  it("bug #18: same title+price in a DIFFERENT city are NOT dupes", () => {
    // The old key (title+price only) collapsed these — two different
    // sellers' ads destroyed. City in the key fixes it.
    expect(isRepost(ad, { ...ad, city: "اصفهان" })).toBe(false);
  });

  it("bug #18: same title+price+city in a DIFFERENT district are NOT dupes", () => {
    expect(isRepost(ad, { ...ad, district: "ونک" })).toBe(false);
  });

  it("bug #18: same title+price+city+district ARE dupes (likely repost)", () => {
    expect(isRepost(ad, { ...ad })).toBe(true);
  });

  it("works without district (title+price+city only)", () => {
    expect(dupKey("مبل راحتی", null, "تهران")).toBe(dupKey("مبل راحتی", null, "تهران"));
    expect(dupKey("مبل راحتی", null, "تهران")).not.toBe(dupKey("مبل راحتی", "5000000", "تهران"));
    expect(dupKey("مبل راحتی", null, "تهران")).not.toBe(dupKey("مبل راحتی", null, "شیراز"));
  });
});
