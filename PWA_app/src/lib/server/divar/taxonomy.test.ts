import { afterEach, describe, expect, it, vi } from "vitest";

import { DIVAR_PLACES } from "@/data/divar-places";
import { divarFetch } from "./throttle";
import { requireCityId, resolveCityId } from "./taxonomy";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("canonical place resolution (file-based, no network)", () => {
  it("resolves large, small, and satellite cities without fetching", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("resolution must not hit the network");
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      expect(await resolveCityId("tehran")).toBe("1");
      expect(await resolveCityId("karaj")).toBe("2");
      expect(await resolveCityId("eslamshahr")).toBe("29");
      expect(await resolveCityId("younesi")).toBe("3010");
      expect(await resolveCityId("abadan")).toBe("24");
      expect(await resolveCityId("definitely-not-a-city")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requireCityId passes all through and throws visibly otherwise", async () => {
    await expect(requireCityId("all")).resolves.toBe("");
    await expect(requireCityId("tehran")).resolves.toBe("1");
    await expect(requireCityId("no-such-city")).rejects.toMatchObject({
      errorClass: "bad-request",
    });
  });
});

describe("canonical catalog versus the official live Divar response", () => {
  it("matches id/slug/name for all 1,177 places (one throttled request)", async () => {
    let live: Array<{ id: unknown; slug: unknown; name: unknown }>;
    try {
      const json = (await divarFetch("https://api.divar.ir/v8/places/cities", {
        method: "GET",
        kind: "meta",
      })) as { cities?: unknown };
      if (!Array.isArray(json.cities)) throw new Error("missing .cities array");
      live = json.cities as Array<{ id: unknown; slug: unknown; name: unknown }>;
    } catch (e) {
      throw new Error(
        "BLOCKED: official Divar catalog unreachable — rerun with network access; " +
          `the local file was NOT revalidated (${(e as Error).message})`
      );
    }
    const fileBySlug = new Map(DIVAR_PLACES.map((p) => [p.slug, p]));
    const liveBySlug = new Map<string, { id: unknown; name: unknown }>();
    for (const c of live) {
      if (typeof c.slug === "string") liveBySlug.set(c.slug, { id: c.id, name: c.name });
    }
    const missingInFile = [...liveBySlug.keys()].filter((s) => !fileBySlug.has(s));
    const staleInFile = [...fileBySlug.keys()].filter((s) => !liveBySlug.has(s));
    const drifted = [...fileBySlug.entries()]
      .filter(([slug, p]) => {
        const l = liveBySlug.get(slug);
        return l !== undefined && (l.id !== p.id || l.name !== p.name);
      })
      .map(([slug]) => slug);
    expect({ missingInFile, staleInFile, drifted }).toEqual({
      missingInFile: [],
      staleInFile: [],
      drifted: [],
    });
  }, 60000);
});
