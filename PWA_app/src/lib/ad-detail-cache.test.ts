/**
 * Shared ad-detail cache — concurrent/duplicate resolutions must fire ONE
 * request per token, and repeat resolutions within the TTL must fire none.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAdDetail, resolveAdDetails } from "@/lib/ad-detail-cache";

const TOKEN = "tok-abc";

function okFetch() {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        title: "آپارتمان نوساز",
        price: 5000000000,
        city: "تهران",
        images: ["https://img/x.jpg"],
      },
    }),
    url,
  }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveAdDetail", () => {
  it("dedupes concurrent requests for the same token into one fetch", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const [a, b, c] = await Promise.all([
      resolveAdDetail(TOKEN),
      resolveAdDetail(TOKEN),
      resolveAdDetail(TOKEN),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.title).toBe("آپارتمان نوساز");
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("serves repeat resolutions from cache without refetching", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await resolveAdDetail("tok-repeat-1");
    await resolveAdDetail("tok-repeat-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns failed:true instead of throwing when the ad is gone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );
    const d = await resolveAdDetail("tok-gone-1");
    expect(d.failed).toBe(true);
    expect(d.title).toBe("");
  });
});

describe("resolveAdDetails", () => {
  it("fires one request per unique token across overlapping batches", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const [m1, m2] = await Promise.all([
      resolveAdDetails(["tok-x1", "tok-x2"]),
      resolveAdDetails(["tok-x2", "tok-x3"]),
    ]);
    // tok-x2 shared between the two concurrent batches.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(m1.get("tok-x1")?.title).toBe("آپارتمان نوساز");
    expect(m2.get("tok-x3")?.city).toBe("تهران");
  });
});
