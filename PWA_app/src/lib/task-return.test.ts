/**
 * Task-continuity navigation: the return slot records where the user was
 * (page + scroll + pending favorite) so diverting flows (auth, ad detail)
 * bring them back to the exact spot — never a cold page that loses the
 * hunt context.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTaskReturn,
  peekTaskReturn,
  setTaskReturn,
  takeTaskReturn,
  taskReturnMatches,
} from "@/lib/task-return";

/** sessionStorage stub (same pattern as kamin-store.test.ts). */
function seedStorage(raw: string | null) {
  const store: Record<string, string> = {};
  if (raw !== null) store["shakar:task-return:v1"] = raw;
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedStorage(null);
});

describe("task-return", () => {
  it("round-trips url, scrollY and pendingFavorite", () => {
    setTaskReturn({ url: "/hunt/abc?q=x", scrollY: 1234, pendingFavorite: "tok1" });
    const tr = peekTaskReturn();
    expect(tr?.url).toBe("/hunt/abc?q=x");
    expect(tr?.scrollY).toBe(1234);
    expect(tr?.pendingFavorite).toBe("tok1");
  });

  it("take consumes the slot; peek does not", () => {
    setTaskReturn({ url: "/hunt/abc", scrollY: 10 });
    expect(takeTaskReturn()?.url).toBe("/hunt/abc");
    expect(peekTaskReturn()).toBeNull();
    setTaskReturn({ url: "/hunt/abc", scrollY: 10 });
    expect(peekTaskReturn()?.url).toBe("/hunt/abc");
    expect(peekTaskReturn()?.url).toBe("/hunt/abc");
  });

  it("a newer task overwrites the previous one (single slot, not a stack)", () => {
    setTaskReturn({ url: "/hunt/a", scrollY: 1 });
    setTaskReturn({ url: "/hunt/b", scrollY: 2 });
    expect(takeTaskReturn()?.url).toBe("/hunt/b");
  });

  it("stale returns (>10min) are treated as absent", () => {
    seedStorage(
      JSON.stringify({ url: "/hunt/a", scrollY: 5, ts: Date.now() - 11 * 60_000 })
    );
    expect(peekTaskReturn()).toBeNull();
  });

  it("matches on pathname only — query params may differ", () => {
    setTaskReturn({ url: "/hunt/abc?q=x", scrollY: 5 });
    const tr = peekTaskReturn()!;
    expect(taskReturnMatches(tr, "/hunt/abc")).toBe(true);
    expect(taskReturnMatches(tr, "/hunt/other")).toBe(false);
    expect(taskReturnMatches(tr, "/")).toBe(false);
  });

  it("clearTaskReturn empties the slot", () => {
    setTaskReturn({ url: "/hunt/a", scrollY: 1 });
    clearTaskReturn();
    expect(peekTaskReturn()).toBeNull();
  });

  it("malformed storage is treated as absent, never throws", () => {
    seedStorage("not-json{{{");
    expect(peekTaskReturn()).toBeNull();
    expect(takeTaskReturn()).toBeNull();
  });
});
