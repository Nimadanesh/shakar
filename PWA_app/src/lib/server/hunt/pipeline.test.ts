import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HuntDefinition, HuntEvent } from "./pipeline";
import type { ListingSummary } from "../divar/provider";

// Mock the Divar client module (provider + taxonomy are real).
vi.mock("../divar/divarClient", () => ({
  divarProvider: {
    name: "divar-first-party",
    searchLists: vi.fn(),
    getDetail: vi.fn(),
  },
}));
vi.mock("../divar/taxonomy", () => ({
  CATEGORY_API_VALUE: { all: "", mobile: "electronic-devices" },
  resolveCityId: vi.fn(async () => "1"),
}));

import { divarProvider } from "../divar/divarClient";
import { runPipeline } from "./pipeline";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

function summary(over: Partial<ListingSummary> & { sourceAdId: string }): ListingSummary {
  return {
    title: "",
    price: null,
    city: "تهران",
    ...over,
  };
}

const DEF: HuntDefinition = {
  query: "گوشی",
  include: ["گوشی"],
  exclude: ["خراب"],
  city: "tehran",
  category: "mobile",
  priceMin: "",
  priceMax: "",
  transaction: "",
  condition: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function collect(def: HuntDefinition): Promise<{ events: HuntEvent[] }> {
  const events: HuntEvent[] = [];
  return runPipeline(def, (e) => events.push(e)).then(() => ({ events }));
}

describe("runPipeline", () => {
  it("filters by title rules, dedups reposts, scores by description", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "a1", title: "گوشی موبایل نو", price: 100 }),
        summary({ sourceAdId: "a2", title: "گوشی موبایل نو", price: 100 }), // repost dup
        summary({ sourceAdId: "a3", title: "لپ تاپ استوک", price: 50 }), // title reject
        summary({ sourceAdId: "a4", title: "گوشی خراب", price: 10 }), // exclude reject
      ],
      hasMore: false,
    });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: "",
      price: 100,
      city: "تهران",
      description: id === "a1" ? "گوشی تمیز بدون خط و خش" : "…",
      images: [],
      categorySlug: "",
    }));

    const { events } = await collect(DEF);
    const done = events.find((e) => e.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    // a1 confirmed; a2 collapsed as dup; a3/a4 rejected at title.
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["a1"]);
    expect(done.stats.adsSeen).toBe(4);
    expect(done.stats.titleRejected).toBe(2);
    expect(done.stats.dupsCollapsed).toBe(1);
    expect(done.results[0].evidence).toContain("گوشی");
  });

  it("emits filter waves in chunks (chunked discernment)", async () => {
    const listings = Array.from({ length: 120 }, (_, i) =>
      summary({ sourceAdId: `x${i}`, title: `آگهی شماره ${i}` })
    );
    mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
    const { events } = await collect({ ...DEF, include: ["گوشی"] });
    const waves = events.filter((e) => e.type === "filter-wave");
    // 120 rejects → waves at 50, 100, + final flush.
    expect(waves.length).toBe(3);
    expect(waves[0]).toMatchObject({ wave: 1, rejected: 50, totalRejected: 50 });
  });

  it("streams details in batches of 10, prioritized", async () => {
    const listings = Array.from({ length: 25 }, (_, i) =>
      summary({ sourceAdId: `b${i}`, title: "گوشی نو آکبند", price: 100 + i })
    );
    mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: "گوشی نو آکبند",
      price: 100,
      city: "تهران",
      description: "گوشی سالم",
      images: [],
      categorySlug: "",
    }));
    const { events } = await collect(DEF);
    const batches = events.filter((e) => e.type === "details-batch");
    expect(batches.length).toBe(3); // 25 → 10 + 10 + 5
    expect(batches[0]).toMatchObject({ checked: 10, total: 25 });
    const done = events.find((e) => e.type === "done");
    if (done?.type === "done") expect(done.results).toHaveLength(25);
  });

  it("marks failed details as unknown instead of dropping them", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "u1", title: "گوشی کارکرده" })],
      hasMore: false,
    });
    mockGetDetail.mockRejectedValueOnce(new Error("boom"));
    const { events } = await collect(DEF);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    expect(done.results).toHaveLength(1);
    expect(done.results[0].detailUnknown).toBe(true);
  });

  it("returns empty results (zero-result hunt) without throwing", async () => {
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    const { events } = await collect(DEF);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    expect(done.results).toEqual([]);
    expect(done.stats.adsSeen).toBe(0);
  });

  it("paginates while hasMore and stops at the cap", async () => {
    mockSearchLists.mockImplementation(async ({ page }: { page: number }) => ({
      listings: [summary({ sourceAdId: `p${page}`, title: "گوشی" })],
      hasMore: page < 100, // infinite — cap must stop it
    }));
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: "گوشی",
      price: null,
      city: "",
      description: "گوشی",
      images: [],
      categorySlug: "",
    }));
    const { events } = await collect(DEF);
    // 20 pages max (MAX_LIST_PAGES_PER_HUNT), 100 details max.
    expect(mockSearchLists).toHaveBeenCalledTimes(20);
    const done = events.find((e) => e.type === "done");
    if (done?.type === "done") expect(done.stats.detailsChecked).toBeLessThanOrEqual(100);
  });

  it("honors price bounds but keeps unknown-price ads (contract)", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "a1", title: "گوشی", price: 150 }), // in range
        summary({ sourceAdId: "a2", title: "گوشی", price: 500 }), // too expensive
        summary({ sourceAdId: "a3", title: "گوشی", price: 10 }), // too cheap
        summary({ sourceAdId: "a4", title: "گوشی", price: null }), // unknown stays
      ],
      hasMore: false,
    });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: "گوشی",
      price: null,
      city: "",
      description: "گوشی",
      images: [],
      categorySlug: "",
    }));
    const { events } = await collect({
      ...DEF,
      priceMin: "100",
      priceMax: "200",
    });
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    const ids = done.results.map((r) => r.sourceAdId).sort();
    expect(ids).toEqual(["a1", "a4"]);
  });
});
