import { describe, expect, it } from "vitest";
import {
  getDimensionStatuses,
  isDimensionsBlocking,
  type DimensionQuery,
} from "./dimensions";

function q(partial: Partial<DimensionQuery>): DimensionQuery {
  return {
    query: "",
    include: [],
    exclude: [],
    category: "all",
    values: { transaction: "", condition: "" },
    ...partial,
  };
}

function ids(s: ReturnType<typeof getDimensionStatuses>): string[] {
  return s.map((x) => x.def.id);
}

describe("getDimensionStatuses", () => {
  it("asks transaction for real estate without a transaction word", () => {
    const s = getDimensionStatuses(q({ query: "خونه 50 متری تهران" }));
    expect(ids(s)).toEqual(["transaction"]);
    expect(isDimensionsBlocking(s)).toBe(true);
  });

  it("never asks again when the text already says خرید (navid's rule)", () => {
    expect(ids(getDimensionStatuses(q({ query: "خرید خونه تهران" })))).toEqual([]);
    expect(ids(getDimensionStatuses(q({ query: "خونه اجاره‌ای" })))).toEqual([]);
  });

  it("checks every input text, not just «چی؟»", () => {
    // «اجاره» lives in the «باید» field — still answered.
    const s = getDimensionStatuses(q({ query: "خونه", include: ["اجاره‌ای"] }));
    expect(ids(s)).toEqual([]);
  });

  it("asks condition for a car with no condition word", () => {
    const s = getDimensionStatuses(q({ query: "۲۰۶ تیپ ۲" }));
    expect(ids(s)).toEqual(["condition"]);
    expect(s[0].def.neutral?.value).toBe("any");
    expect(isDimensionsBlocking(s)).toBe(true);
  });

  it("asks condition for digital / home / music via text hints", () => {
    expect(ids(getDimensionStatuses(q({ query: "آیفون ۱۳" })))).toEqual(["condition"]);
    expect(ids(getDimensionStatuses(q({ query: "مبل راحتی" })))).toEqual(["condition"]);
    expect(ids(getDimensionStatuses(q({ query: "پیانو" })))).toEqual(["condition"]);
  });

  it("stays silent when the text already states the condition", () => {
    expect(ids(getDimensionStatuses(q({ query: "پراید صفر" })))).toEqual([]);
    expect(ids(getDimensionStatuses(q({ query: "آیفون نو" })))).toEqual([]);
    expect(ids(getDimensionStatuses(q({ query: "مبل کارکرده" })))).toEqual([]);
    expect(ids(getDimensionStatuses(q({ query: "گوشی دست دوم" })))).toEqual([]);
  });

  it("honors the explicit category picker over text", () => {
    const s = getDimensionStatuses(q({ query: "۲۰۶", category: "vehicles" }));
    expect(ids(s)).toEqual(["condition"]);
  });

  it("stays silent for unknown categories — never guesses", () => {
    expect(ids(getDimensionStatuses(q({ query: "چیز عجیب" })))).toEqual([]);
    expect(ids(getDimensionStatuses(q({ query: "" })))).toEqual([]);
  });

  it("keeps a picked chip visible but no longer blocking", () => {
    const s = getDimensionStatuses(
      q({ query: "۲۰۶ تیپ ۲", values: { transaction: "", condition: "any" } })
    );
    expect(ids(s)).toEqual(["condition"]);
    expect(s[0].value).toBe("any");
    expect(isDimensionsBlocking(s)).toBe(false);
  });

  it("asks at most one dimension: real estate wins over goods", () => {
    const s = getDimensionStatuses(q({ query: "خونه و ماشین" }));
    expect(ids(s)).toEqual(["transaction"]);
  });
});
