import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HuntDefinition } from "./pipeline";
import type { ListingSummary } from "../divar/provider";

// Detail requests stay strictly sequential: the provider executor is a
// single FIFO queue (~1 req/s), so pipeline-level parallelism would not
// reduce upstream time and would only add interleaving risk. This locks the
// documented decision: at most one in-flight detail, stable candidate order.
vi.mock("../divar/divarClient", () => ({
  divarProvider: {
    name: "divar-first-party",
    searchLists: vi.fn(),
    getDetail: vi.fn(),
  },
}));
vi.mock("../divar/taxonomy", () => ({
  CATEGORY_API_VALUE: { all: "", mobile: "electronic-devices", "real-estate": "real-estate" },
  LEAF_CATEGORY: { apartmentSell: "apartment-sell", apartmentRent: "apartment-rent" },
  resolveCityId: vi.fn(async () => "1"),
}));

import { divarProvider } from "../divar/divarClient";
import { runPipeline } from "./pipeline";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

const DEF: HuntDefinition = {
  query: "گوشی",
  include: ["گوشی"],
  exclude: [],
  should: [],
  city: "tehran",
  category: "mobile",
  priceMin: "",
  priceMax: "",
  transaction: "",
  condition: "",
};

function summary(over: Partial<ListingSummary> & { sourceAdId: string }): ListingSummary {
  return { title: "", price: null, city: "تهران", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detail-review concurrency (documented sequential decision)", () => {
  it("never has more than one in-flight detail and preserves candidate order", async () => {
    const ids = ["s1", "s2", "s3", "s4", "s5"];
    mockSearchLists.mockResolvedValueOnce({
      listings: ids.map((id) => summary({ sourceAdId: id, title: "گوشی سالم", district: `test-${id}` })),
      hasMore: false,
    });
    let active = 0;
    let maxActive = 0;
    const callOrder: string[] = [];
    mockGetDetail.mockImplementation(async (id: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      callOrder.push(id);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return { sourceAdId: id, title: "گوشی سالم", price: null, city: "", description: "گوشی", images: [], categorySlug: "" };
    });
    const events: unknown[] = [];
    await runPipeline(DEF, (e) => events.push(e));
    expect(maxActive).toBe(1);
    expect(callOrder).toEqual(ids);
  });

  it("keeps the 100-detail budget and batch progress cadence", async () => {
    const listings = Array.from({ length: 25 }, (_, i) =>
      summary({ sourceAdId: `b${i}`, title: "گوشی نو آکبند", price: 100 + i, district: `test-b${i}` })
    );
    mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: "گوشی نو آکبند",
      price: null,
      city: "",
      description: "گوشی",
      images: [],
      categorySlug: "",
    }));
    const events: Array<{ type: string; checked?: number; total?: number }> = [];
    await runPipeline(DEF, (e) => events.push(e as never));
    const batches = events.filter((e) => e.type === "details-batch");
    expect(batches).toHaveLength(3);
    expect(batches[0]).toMatchObject({ checked: 10, total: 25 });
  });
});
