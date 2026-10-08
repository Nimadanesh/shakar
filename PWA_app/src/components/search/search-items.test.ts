import {
  filterSearchItems,
  makeKeywords,
  sortSearchItems,
  type SearchItem,
} from "./search-items";
import { describe, expect, it } from "vitest";

function item(over: Partial<SearchItem> & { title: string }): SearchItem {
  return {
    id: over.title,
    kind: "history",
    tabLabel: "تاریخچه",
    constraints: [],
    keywords: makeKeywords(over.title, ...(over.constraints ?? [])),
    ...over,
  } as SearchItem;
}

describe("filterSearchItems", () => {
  const items = [
    item({ title: "بی ام و 320", constraints: ["تهران", "تا ۲ میلیارد"] }),
    item({ title: "بی ام و X3", constraints: ["اصفهان"] }),
    item({ title: "پیانو یاماها", constraints: ["تهران"] }),
  ];

  it("returns everything on empty query", () => {
    expect(filterSearchItems(items, "")).toHaveLength(3);
    expect(filterSearchItems(items, "   ")).toHaveLength(3);
  });

  it("matches by title token", () => {
    expect(filterSearchItems(items, "پیانو")).toHaveLength(1);
  });

  it("matches across title AND constraints (the dealer case)", () => {
    // Two hunts on BMW with different constraints — the city disambiguates.
    const res = filterSearchItems(items, "بی ام و اصفهان");
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("بی ام و X3");
  });

  it("requires every token to match", () => {
    expect(filterSearchItems(items, "بی ام و تهران")).toHaveLength(1);
    expect(filterSearchItems(items, "بی ام و شیراز")).toHaveLength(0);
  });

  it("is Persian-normalized (ي/ی, ك/ک)", () => {
    const arabic = item({ title: "ماشين بي ام و" }); // Arabic ي
    expect(filterSearchItems([arabic], "ماشین")).toHaveLength(1);
  });
});

describe("sortSearchItems", () => {
  it("orders fresh → kamin → history → favorite → saved-hunt", () => {
    const mixed: SearchItem[] = [
      item({ title: "s", kind: "saved-hunt", tabLabel: "ذخیره‌شده‌ها" }),
      item({ title: "f", kind: "favorite", tabLabel: "علاقه‌مندی‌ها" }),
      item({ title: "k", kind: "kamin", tabLabel: "کمین‌ها" }),
    ];
    const sorted = sortSearchItems(mixed);
    expect(sorted.map((i) => i.kind)).toEqual(["kamin", "favorite", "saved-hunt"]);
  });
});
