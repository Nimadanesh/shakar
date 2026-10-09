import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./throttle", () => ({
  divarFetch: vi.fn(),
}));

import { divarFetch } from "./throttle";
import { clearCache } from "./cache";
import { getAllCities, resolveCityId } from "./taxonomy";

const mockFetch = vi.mocked(divarFetch);

const CITIES_JSON = {
  cities: [
    { id: 1, slug: "tehran", name: "تهران" },
    { id: 2, slug: "mashhad", name: "مشهد" },
    { id: 760, slug: "bonab", name: "بناب" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  clearCache();
  mockFetch.mockResolvedValue(CITIES_JSON);
});

describe("resolveCityId", () => {
  it("resolves bonab — a city the old ~90 picker never offered (incident 2026-10-09)", async () => {
    expect(await resolveCityId("bonab")).toBe("760");
  });

  it("returns null for unknown slugs (caller falls back to all-cities)", async () => {
    expect(await resolveCityId("no-such-city")).toBeNull();
  });

  it("fetches the directory once and serves the rest from cache", async () => {
    await resolveCityId("tehran");
    await resolveCityId("bonab");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("getAllCities", () => {
  it("returns slug+name pairs including بناب", async () => {
    const cities = await getAllCities();
    expect(cities).toContainEqual({ slug: "bonab", name: "بناب" });
    expect(cities).toContainEqual({ slug: "tehran", name: "تهران" });
  });

  it("orders provincial capitals first", async () => {
    const cities = await getAllCities();
    // tehran and mashhad are both capitals; tehran is first in the fixed order.
    expect(cities[0]).toEqual({ slug: "tehran", name: "تهران" });
    expect(cities[1]).toEqual({ slug: "mashhad", name: "مشهد" });
    // bonab is not a capital — it sorts after them.
    const bonabIdx = cities.findIndex((c) => c.slug === "bonab");
    expect(bonabIdx).toBeGreaterThan(1);
  });
});
