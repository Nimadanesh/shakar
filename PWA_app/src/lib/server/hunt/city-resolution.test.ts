import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HuntDefinition } from "./pipeline";
import type { ListingSummary } from "../divar/provider";

// Real taxonomy (file-based catalog, no network); only the provider
// boundary is mocked. Proves resolution failures stay visible.
vi.mock("../divar/divarClient", () => ({
  divarProvider: {
    name: "divar-first-party",
    searchLists: vi.fn(),
    getDetail: vi.fn(),
  },
}));

import { divarProvider } from "../divar/divarClient";
import { collectCandidates } from "./pipeline";

const mockSearchLists = vi.mocked(divarProvider.searchLists);

function def(over: Partial<HuntDefinition> = {}): HuntDefinition {
  return {
    query: "گوشی",
    include: ["گوشی"],
    exclude: [],
    should: [],
    city: "all",
    category: "mobile",
    priceMin: "",
    priceMax: "",
    transaction: "",
    condition: "",
    ...over,
  };
}

function summary(over: Partial<ListingSummary> & { sourceAdId: string }): ListingSummary {
  return { title: "", price: null, city: "تهران", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("city resolution failures stay visible (never silent all-city)", () => {
  it("rejects an unknown city slug instead of searching everywhere", async () => {
    await expect(
      collectCandidates(def({ city: "no-such-city" }), { maxPages: 1 })
    ).rejects.toMatchObject({ errorClass: "bad-request" });
    expect(mockSearchLists).not.toHaveBeenCalled();
  });

  it("resolves a newly supported small city to its Divar id", async () => {
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    await collectCandidates(def({ city: "eslamshahr" }), { maxPages: 1 });
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: "29" })
    );
  });

  it("sends an empty city id only when all cities was requested", async () => {
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    await collectCandidates(def({ city: "all" }), { maxPages: 1 });
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: "" })
    );
  });

  it("keeps a supported picker city end to end with displayed agreement", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "a1", title: "گوشی سالم" })],
      hasMore: false,
    });
    const { candidates } = await collectCandidates(def({ city: "younesi" }), { maxPages: 1 });
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: "3010" })
    );
    expect(candidates).toHaveLength(1);
  });
});
