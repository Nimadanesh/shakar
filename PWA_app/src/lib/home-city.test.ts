import { afterEach, describe, expect, it, vi } from "vitest";
import { getHomeCity, setHomeCity } from "@/lib/home-city";

/** home-city is a thin localStorage wrapper: stub storage per test. */
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
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home-city (navid 2026-10-08, two-location model)", () => {
  it("returns null when nothing is set", () => {
    stubStorage();
    expect(getHomeCity()).toBeNull();
  });

  it("persists and reads the home city", () => {
    stubStorage();
    setHomeCity("tehran");
    expect(getHomeCity()).toBe("tehran");
  });

  it("clearing with «all» removes it", () => {
    stubStorage();
    setHomeCity("tehran");
    setHomeCity("all");
    expect(getHomeCity()).toBeNull();
  });

  it("rejects unknown city ids", () => {
    stubStorage();
    setHomeCity("atlantis");
    expect(getHomeCity()).toBeNull();
  });

  it("migrates the legacy remembered city once", () => {
    const store = stubStorage({ "shekaar-city": "tabriz" });
    expect(getHomeCity()).toBe("tabriz");
    // And it is now stored under the home key.
    expect(store["shekaar-home-city"]).toBe("tabriz");
  });

  it("the home key wins over the legacy key", () => {
    stubStorage({ "shekaar-city": "tabriz" });
    setHomeCity("isfahan");
    expect(getHomeCity()).toBe("isfahan");
  });

  it("ignores an invalid legacy value", () => {
    stubStorage({ "shekaar-city": "atlantis" });
    expect(getHomeCity()).toBeNull();
  });
});
