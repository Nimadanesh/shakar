import { afterEach, describe, expect, it, vi } from "vitest";
import { getRememberedCity, rememberCity } from "@/lib/city-memory";

/** city-memory is a thin localStorage wrapper: stub storage per test. */
function stubStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("city-memory", () => {
  it("returns null when nothing was remembered", () => {
    stubStorage();
    expect(getRememberedCity()).toBeNull();
  });

  it("remembers an explicit city pick", () => {
    stubStorage();
    rememberCity("shiraz");
    expect(getRememberedCity()).toBe("shiraz");
  });

  it("clears the preference when «همه شهرها» is picked", () => {
    stubStorage({ "shekaar-city": "tehran" });
    rememberCity("all");
    expect(getRememberedCity()).toBeNull();
  });

  it("ignores unknown ids left by an older taxonomy", () => {
    stubStorage({ "shekaar-city": "atlantis" });
    expect(getRememberedCity()).toBeNull();
  });

  it("never throws when storage is unavailable (SSR / private mode)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(getRememberedCity()).toBeNull();
    expect(() => rememberCity("tehran")).not.toThrow();
  });
});
