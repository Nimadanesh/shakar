import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveHunt,
  readActiveHunt,
  setActiveHunt,
} from "@/lib/active-hunt";

/** active-hunt is a thin sessionStorage wrapper: stub storage per test. */
function stubWindow() {
  const store: Record<string, string> = {};
  const listeners: Record<string, Array<(e: Event) => void>> = {};
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
    dispatchEvent: (e: Event) => {
      for (const l of listeners[e.type] ?? []) l(e);
      return true;
    },
    addEventListener: (t: string, l: (e: Event) => void) => {
      (listeners[t] ??= []).push(l);
    },
    removeEventListener: (t: string, l: (e: Event) => void) => {
      listeners[t] = (listeners[t] ?? []).filter((x) => x !== l);
    },
  });
  return { store, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("active-hunt (navid 2026-10-08, reactive chip)", () => {
  it("records and reads the active hunt", () => {
    stubWindow();
    setActiveHunt("run-1", "پیانو");
    expect(readActiveHunt()).toMatchObject({ runId: "run-1", query: "پیانو" });
  });

  it("dispatches shekaar:active-hunt-set so mounted chips wake instantly", () => {
    const { listeners } = stubWindow();
    let fired = 0;
    listeners["shekaar:active-hunt-set"] = [() => fired++];
    setActiveHunt("run-2", "آپارتمان");
    expect(fired).toBe(1);
  });

  it("clearActiveHunt removes the record", () => {
    stubWindow();
    setActiveHunt("run-3", "ماشین");
    clearActiveHunt("run-3");
    expect(readActiveHunt()).toBeNull();
  });

  it("clearActiveHunt with a non-matching id leaves the record alone", () => {
    stubWindow();
    setActiveHunt("run-4", "ماشین");
    clearActiveHunt("other-run");
    expect(readActiveHunt()).toMatchObject({ runId: "run-4" });
  });
});
