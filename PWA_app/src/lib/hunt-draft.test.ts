import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CONTEXT_BASE } from "./search-context";
import {
  clearDraft,
  draftHasData,
  readDraft,
  saveDraft,
} from "./hunt-draft";

const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  } as unknown as Window & typeof globalThis);
  vi.resetModules();
});

describe("hunt-draft", () => {
  it("round-trips a draft", () => {
    saveDraft({
      query: "پیانو",
      base: { ...EMPTY_CONTEXT_BASE, city: "tehran", include: ["یاماها"] },
      cityTouched: true,
      dismissed: ["x"],
    });
    const d = readDraft();
    expect(d?.query).toBe("پیانو");
    expect(d?.base.city).toBe("tehran");
    expect(d?.base.include).toEqual(["یاماها"]);
    expect(d?.cityTouched).toBe(true);
    expect(d?.dismissed).toEqual(["x"]);
  });

  it("clearDraft removes it", () => {
    saveDraft({ query: "q", base: EMPTY_CONTEXT_BASE, cityTouched: false, dismissed: [] });
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it("corrupt storage → null, no throw", () => {
    store["shakar:hunt-draft:v1"] = "{{{bad";
    expect(readDraft()).toBeNull();
  });

  it("draftHasData ignores the untouched home-city default", () => {
    const base = { ...EMPTY_CONTEXT_BASE, city: "tehran" };
    expect(
      draftHasData({ query: "", base, cityTouched: false, dismissed: [] }, "tehran")
    ).toBe(false);
    expect(
      draftHasData({ query: "پیانو", base, cityTouched: false, dismissed: [] }, "tehran")
    ).toBe(true);
    expect(
      draftHasData(
        { query: "", base: { ...base, city: "mashhad" }, cityTouched: true, dismissed: [] },
        "tehran"
      )
    ).toBe(true);
  });
});
