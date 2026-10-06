import { describe, expect, it } from "vitest";
import { canonicalTitle, dupKey, isRepost } from "./nearDup";

describe("canonicalTitle", () => {
  it("unifies keyboard variants and spacing", () => {
    expect(canonicalTitle("پيانو  آكوستيك")).toBe(canonicalTitle("پیانو آکوستیک"));
  });
});

describe("dupKey / isRepost", () => {
  const ad = { title: "پیانو آکوستیک یاماها", price: "120000000", sellerId: "s1" };

  it("flags a repost (same title+price, different ad id) as dup", () => {
    expect(isRepost(ad, { ...ad })).toBe(true);
  });

  it("still matches when the repost was typed with Arabic keyboard", () => {
    expect(isRepost(ad, { title: "پيانو آكوستيك یاماها", price: "120000000", sellerId: "s1" })).toBe(
      true
    );
  });

  it("does not flag a real price drop as a dup", () => {
    expect(isRepost(ad, { ...ad, price: "110000000" })).toBe(false);
  });

  it("does not flag a different ad as a dup", () => {
    expect(isRepost(ad, { ...ad, title: "پیانو دیجیتال یاماها" })).toBe(false);
  });

  it("works without seller id (title+price only)", () => {
    expect(dupKey("مبل راحتی", null)).toBe(dupKey("مبل راحتی", null));
    expect(dupKey("مبل راحتی", null)).not.toBe(dupKey("مبل راحتی", "5000000"));
  });
});
