import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Candidate, HuntDefinition, HuntEvent } from "./pipeline";
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
  CATEGORY_API_VALUE: {
    all: "",
    mobile: "electronic-devices",
    "real-estate": "real-estate",
  },
  LEAF_CATEGORY: {
    apartmentSell: "apartment-sell",
    apartmentRent: "apartment-rent",
  },
  resolveCityId: vi.fn(async () => "1"),
}));

import { divarProvider } from "../divar/divarClient";
import { collapseDupes, runPipeline } from "./pipeline";

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
  should: [],
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
  it("scores titles (no hard include filter), dedups reposts, confirms via description", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "a1", title: "گوشی موبایل نو", price: 100 }),
        summary({ sourceAdId: "a2", title: "گوشی موبایل نو", price: 100 }), // repost dup
        summary({ sourceAdId: "a3", title: "لپ تاپ استوک", price: 50 }), // weak title, checked anyway
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
    // a1 confirmed; a2 collapsed as dup; a3 checked (weak title) but has
    // zero MUST evidence → rejected (flaw #19: the pigeon rule survives);
    // a4 hard-rejected at title by the exclude.
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["a1"]);
    expect(done.stats.adsSeen).toBe(4);
    expect(done.stats.titleRejected).toBe(1);
    expect(done.stats.dupsCollapsed).toBe(1);
    expect(done.stats.nearMiss).toBe(0);
    expect(done.stats.rejectedNoMatch).toBe(1);
    expect(done.results[0].evidence).toContain("گوشی");
    expect(done.results[0].matchKind).toBe("exact");
    const ranked = events.find((e) => e.type === "ranked");
    expect(ranked).toMatchObject({ scored: 4, shortlisted: 2, excluded: 1 });
  });

  it("emits a single ranked event instead of rejection waves", async () => {
    const listings = Array.from({ length: 120 }, (_, i) =>
      summary({ sourceAdId: `x${i}`, title: `آگهی شماره ${i}` })
    );
    mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
    const { events } = await collect({ ...DEF, include: ["گوشی"] });
    const ranked = events.filter((e) => e.type === "ranked");
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ scored: 120, shortlisted: 120, excluded: 0 });
    expect(events.map((e) => e.type)).not.toContain("filter-wave");
  });

  it("does NOT kill an ad at title level when the attribute lives only in the description (flaw #12)", async () => {
    const def: HuntDefinition = {
      query: "آپارتمان نوساز سعادت آباد",
      include: ["آپارتمان", "نوساز", "سعادت", "آباد"],
      exclude: [],
      should: [],
      city: "tehran",
      category: "real-estate",
      priceMin: "",
      priceMax: "",
      transaction: "",
      condition: "",
    };
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({
          sourceAdId: "s1",
          // No neighborhood in the title — the old hard-AND killed this.
          title: "اپارتمان ۱۰۰ متری نوساز",
          price: 100,
        }),
      ],
      hasMore: false,
    });
    mockGetDetail.mockResolvedValue({
      sourceAdId: "s1",
      title: "اپارتمان ۱۰۰ متری نوساز",
      price: 100,
      city: "تهران",
      description: "آپارتمان نوساز در سعادت آباد، طبقه سوم",
      images: [],
      categorySlug: "",
    });
    const { events } = await collect(def);
    const done = events.find((e) => e.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1"]);
  });

  it("enforces condition=new by rejecting explicit used cues only (finding #2)", async () => {
    const def: HuntDefinition = {
      ...DEF,
      include: ["گوشی"],
      exclude: [],
      condition: "new",
    };
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "n1", title: "گوشی آکبند" }),
        summary({ sourceAdId: "n2", title: "گوشی کارکرده تمیز" }),
        summary({ sourceAdId: "n3", title: "گوشی" }), // no condition cue → stays
      ],
      hasMore: false,
    });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: "گوشی سالم",
      images: [],
      categorySlug: "",
    }));
    const { events } = await collect(def);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    const ids = done.results.map((r) => r.sourceAdId).sort();
    expect(ids).toEqual(["n1", "n3"]);
  });

  it("enforces condition=used by rejecting explicit new cues only (finding #2)", async () => {
    const def: HuntDefinition = { ...DEF, include: ["گوشی"], exclude: [], condition: "used" };
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "u1", title: "گوشی آکبند" }),
        summary({ sourceAdId: "u2", title: "گوشی کارکرده" }),
      ],
      hasMore: false,
    });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: "گوشی",
      images: [],
      categorySlug: "",
    }));
    const { events } = await collect(def);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["u2"]);
  });

  it("does not confuse «نوساز» with the «نو» cue (token-level, finding #2)", async () => {
    // «آپارتمان نوساز» with condition=used must NOT be rejected: «نوساز»
    // is not the token «نو».
    const def: HuntDefinition = {
      ...DEF,
      query: "آپارتمان",
      include: ["آپارتمان"],
      exclude: [],
      condition: "used",
    };
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "w1", title: "آپارتمان نوساز" })],
      hasMore: false,
    });
    mockGetDetail.mockResolvedValue({
      sourceAdId: "w1",
      title: "آپارتمان نوساز",
      price: null,
      city: "",
      description: "آپارتمان نوساز",
      images: [],
      categorySlug: "",
    });
    const { events } = await collect(def);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["w1"]);
  });

  it("passes the hunt content terms as provider keywords (flaw #11)", async () => {
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    await collect(DEF);
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ["گوشی"] })
    );
  });

  it("honors the transaction answer with Divar's sell/rent leaf (flaw #13)", async () => {
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    const base: HuntDefinition = {
      query: "آپارتمان نوساز",
      include: ["آپارتمان", "نوساز"],
      exclude: [],
      should: [],
      city: "tehran",
      category: "real-estate",
      priceMin: "",
      priceMax: "",
      transaction: "buy",
      condition: "",
    };
    await collect(base);
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "apartment-sell" })
    );
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    await collect({ ...base, transaction: "rent" });
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "apartment-rent" })
    );
    // No answer → the whole real-estate category, never a silent half.
    mockSearchLists.mockResolvedValueOnce({ listings: [], hasMore: false });
    await collect({ ...base, transaction: "" });
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "real-estate" })
    );
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

  it("marks STALE details as unknown — stale cache is not verification (finding #1, round 6)", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "s1", title: "گوشی کارکرده" })],
      hasMore: false,
    });
    // The detail API was down; the provider served 60-min-old cache flagged
    // stale. The pipeline must NOT treat this as a verified confirmation.
    mockGetDetail.mockResolvedValueOnce({
      sourceAdId: "s1",
      title: "گوشی کارکرده",
      price: 100,
      city: "تهران",
      description: "توضیح",
      images: [],
      categorySlug: "mobile",
      stale: true,
    });
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
    mockSearchLists.mockImplementation(
      async ({ page }: { page: number; cursor?: unknown }) => ({
        listings: [summary({ sourceAdId: `p${page}`, title: "گوشی" })],
        hasMore: page < 100, // infinite — cap must stop it
        nextCursor: `cursor-${page}`,
      })
    );
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
    // The cursor actually threads forward (finding #1) — page N+1 carries
    // page N's cursor. Without this, every request re-fetches page 0.
    expect(mockSearchLists).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "cursor-0" })
    );
    expect(mockSearchLists).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ cursor: "cursor-1" })
    );
    const done = events.find((e) => e.type === "done");
    if (done?.type === "done") expect(done.stats.detailsChecked).toBeLessThanOrEqual(100);
  });

  it("stops the walk when the cursor runs out — never re-fetches page 0 (finding #1)", async () => {
    // hasMore lies, but no cursor: the walk MUST stop, not loop on page 0.
    mockSearchLists.mockResolvedValue({
      listings: [summary({ sourceAdId: "p0", title: "گوشی" })],
      hasMore: true,
      nextCursor: undefined,
    });
    await collect(DEF);
    expect(mockSearchLists).toHaveBeenCalledTimes(1);
  });

  it("deep-history resumes from the first phase's endCursor", async () => {
    const { collectCandidates } = await import("./pipeline");
    mockSearchLists.mockImplementation(async ({ cursor }: { cursor?: unknown }) => ({
      listings: [],
      hasMore: true,
      nextCursor: cursor === undefined ? "cursor-A" : "cursor-B",
    }));
    const first = await collectCandidates(DEF, { maxPages: 1 });
    expect(first.endCursor).toBe("cursor-A");
    mockSearchLists.mockClear();
    mockSearchLists.mockImplementation(async () => ({
      listings: [],
      hasMore: false,
      nextCursor: "cursor-B",
    }));
    await collectCandidates(
      { ...DEF, deepHistory: true },
      { maxPages: 1, startCursor: first.endCursor, startPage: 20 }
    );
    // The deep walk resumes where the first stopped — not from page 0.
    expect(mockSearchLists).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "cursor-A", page: 20 })
    );
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

describe("intent buckets — flaw #19 (MUST/SHOULD/MUST-NOT/UNKNOWN)", () => {
  function def19(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "برنج هندی",
      include: ["برنج", "هندی"],
      exclude: [],
      should: [],
      city: "all",
      category: "all",
      priceMin: "",
      priceMax: "",
      transaction: "",
      condition: "",
      ...over,
    };
  }

  async function doneOf(def: HuntDefinition) {
    const events: HuntEvent[] = [];
    await runPipeline(def, (e) => events.push(e));
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    return done;
  }

  function detail(descById: Record<string, string>) {
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: descById[id] ?? "",
      images: [],
      categorySlug: "",
    }));
  }

  it("LOCKED: برنج هندی — near-misses survive, zero-evidence dies", async () => {
    // The friend's screenshot: 7 candidates, all killed by the hard AND.
    // Now: exact + near are kept and labeled, only the zero-evidence ad dies.
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "a1", title: "برنج هندی اعلا", price: 100 }),
        summary({ sourceAdId: "a2", title: "برنج", price: 90 }),
        summary({ sourceAdId: "a3", title: "لوبیا قرمز", price: 50 }),
      ],
      hasMore: false,
    });
    detail({
      a1: "برنج هندی درجه یک",
      a2: "برنج ایرانی درجه یک", // «هندی» missing → UNKNOWN, not dead
      a3: "لوبیا",
    });
    const done = await doneOf(def19());
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["a1", "a2"]);
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results[0].missingInfo).toEqual([]);
    expect(done.results[1].matchKind).toBe("near");
    expect(done.results[1].missingInfo).toEqual(["هندی"]);
    expect(done.results[1].evidence).toContain("برنج");
    expect(done.stats.nearMiss).toBe(1);
    expect(done.stats.rejectedNoMatch).toBe(1); // a3: zero MUST evidence
  });

  it("LOCKED: piano regression — a pigeon ad is still rejected (flaw #8)", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "p1", title: "کفتر مسابقه‌ای اصیل" })],
      hasMore: false,
    });
    detail({ p1: "کفتر مسابقه‌ای" });
    const done = await doneOf(def19({ query: "پیانو", include: ["پیانو"] }));
    expect(done.results).toEqual([]);
    expect(done.stats.rejectedNoMatch).toBe(1);
    expect(done.stats.nearMiss).toBe(0);
  });

  it("MUST_NOT still hard-rejects in the detail phase", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "e1", title: "برنج هندی اعلا" })],
      hasMore: false,
    });
    // «کهنه» is not in the title (title phase passes) but hits the description.
    detail({ e1: "برنج هندی کهنه" });
    const done = await doneOf(def19({ exclude: ["کهنه"] }));
    expect(done.results).toEqual([]);
    expect(done.stats.rejectedNoMatch).toBe(1);
  });

  it("condition contradiction still rejects (flaw #15)", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "c1", title: "گوشی" })],
      hasMore: false,
    });
    detail({ c1: "گوشی کارکرده تمیز" });
    const done = await doneOf(
      def19({ query: "گوشی", include: ["گوشی"], condition: "new" })
    );
    expect(done.results).toEqual([]);
    expect(done.stats.rejectedNoMatch).toBe(1);
  });

  it("exact ranks above near even when the near ad has the higher raw score", async () => {
    const def = def19({
      query: "گوشی سامسونگ نو",
      include: ["گوشی", "سامسونگ", "نو"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        // x1: every MUST evidenced (description-only) → exact, score 2.0
        summary({ sourceAdId: "x1", title: "لوازم جانبی", price: null }),
        // x2: 2/3 MUST in title + known price → near, score 2.17
        summary({ sourceAdId: "x2", title: "گوشی سامسونگ", price: 100 }),
      ],
      hasMore: false,
    });
    detail({ x1: "گوشی سامسونگ نو", x2: "گوشی سامسونگ" });
    const done = await doneOf(def);
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["x1", "x2"]);
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results[1].matchKind).toBe("near");
    expect(done.results[1].score).toBeGreaterThan(done.results[0].score);
  });

  it("detailUnknown: title-only MUST match → near (never exact), score halved", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "d1", title: "برنج هندی", price: null })],
      hasMore: false,
    });
    mockGetDetail.mockRejectedValueOnce(new Error("boom"));
    const done = await doneOf(def19());
    expect(done.results).toHaveLength(1);
    const ad = done.results[0];
    expect(ad.detailUnknown).toBe(true);
    expect(ad.matchKind).toBe("near"); // unverified description → never exact
    expect(ad.missingInfo).toEqual([]);
    // Full title evidence: 3*1 + 0 + 0 = 3, halved for unknown details.
    expect(ad.score).toBe(1.5);
  });

  it("SHOULD boosts ranking but never filters and never penalizes", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "s1", title: "برنج هندی", price: null }),
        summary({ sourceAdId: "s2", title: "برنج هندی اعلا", price: null }),
        // s3 matches the SHOULD term but zero MUST → still rejected.
        summary({ sourceAdId: "s3", title: "لوبیا اعلا", price: null }),
      ],
      hasMore: false,
    });
    detail({ s1: "برنج هندی", s2: "برنج هندی اعلا", s3: "لوبیا" });
    const done = await doneOf(def19({ should: ["اعلا"] }));
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s2", "s1"]);
    expect(done.results[0].evidence).toContain("اعلا");
    expect(done.stats.rejectedNoMatch).toBe(1); // s3
    expect(done.stats.nearMiss).toBe(0);
  });

  it("keeps a standalone freezer as a near-match, not an exact refrigerator match", async () => {
    const def = def19({
      query: "یخچال",
      category: "home",
      include: ["یخچال"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "fridge", title: "یخچال فریزر سالم" }),
        summary({ sourceAdId: "freezer", title: "فریزر صندوقی بدون برفک" }),
      ],
      hasMore: false,
    });
    detail({
      fridge: "یخچال فریزر سالم",
      freezer: "فریزر صندوقی بدون برفک مناسب مغازه",
    });
    const done = await doneOf(def);

    expect(done.results.map((ad) => ad.sourceAdId)).toEqual(["fridge", "freezer"]);
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results[1].matchKind).toBe("near");
    expect(done.results[1].missingInfo).toEqual(["یخچال"]);
    expect(done.stats.nearMiss).toBe(1);
    expect(done.stats.rejectedNoMatch).toBe(0);
  });

  it("ranks a real acoustic piano above design/digital acoustic claims", async () => {
    const def = def19({
      query: "پیانو آکوستیک",
      category: "music",
      include: ["پیانو", "آکوستیک"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "real", title: "پیانو آکوستیک یاماها" }),
        summary({ sourceAdId: "design", title: "پیانو طرح آکوستیک" }),
        summary({ sourceAdId: "digital", title: "پیانو دیجیتال آکوستیک" }),
      ],
      hasMore: false,
    });
    detail({
      real: "پیانو آکوستیک واقعی یاماها",
      design: "پیانو طرح آکوستیک با رنگ‌بندی سفارشی",
      digital: "پیانو دیجیتال با صدای آکوستیک",
    });
    const done = await doneOf(def);

    expect(done.results[0].sourceAdId).toBe("real");
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results.find((ad) => ad.sourceAdId === "design")?.matchKind).toBe("near");
    expect(done.results.find((ad) => ad.sourceAdId === "digital")?.matchKind).toBe("near");
    expect(done.results.find((ad) => ad.sourceAdId === "design")?.missingInfo).toContain("آکوستیک");
    expect(done.results.find((ad) => ad.sourceAdId === "digital")?.missingInfo).toContain("آکوستیک");
  });

  it("keeps genuine acoustic evidence when a natural sound phrase co-occurs", async () => {
    // Guard must not over-filter: "صدای آکوستیک" alone is insufficient,
    // but "پیانو آکوستیک" elsewhere in the same text still proves the subtype.
    const def = def19({
      query: "پیانو آکوستیک",
      category: "music",
      include: ["پیانو", "آکوستیک"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [summary({ sourceAdId: "g1", title: "پیانو یاماها" })],
      hasMore: false,
    });
    detail({
      g1: "پیانو آکوستیک با صدای آکوستیک گرم",
    });
    const done = await doneOf(def);

    expect(done.results.map((ad) => ad.sourceAdId)).toEqual(["g1"]);
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results[0].missingInfo).toEqual([]);
  });

  it("keeps a keyboard-only listing as near, not exact, for a piano query", async () => {
    const def = def19({
      query: "پیانو",
      category: "music",
      include: ["پیانو"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "piano", title: "پیانو یاماها" }),
        summary({ sourceAdId: "keyboard", title: "کیبورد آموزشی" }),
      ],
      hasMore: false,
    });
    detail({
      piano: "پیانو سالم",
      keyboard: "کیبورد آموزشی مناسب شروع",
    });
    const done = await doneOf(def);

    expect(done.results.map((ad) => ad.sourceAdId)).toEqual(["piano", "keyboard"]);
    expect(done.results[0].matchKind).toBe("exact");
    expect(done.results[1].matchKind).toBe("near");
    expect(done.results[1].missingInfo).toEqual(["پیانو"]);
  });

  it("preserves the apartment positive control, including واحد alias listings", async () => {
    // Case C: آپارتمان نوساز سعادت‌آباد must keep ranking relevant results.
    // loc-a-live3/live5 name واحد instead of آپارتمان; the real-estate
    // alias must still match end-to-end.
    const def = def19({
      query: "آپارتمان نوساز سعادت‌آباد",
      category: "real-estate",
      include: ["آپارتمان", "نوساز", "سعادت", "آباد"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "live1", title: "آپارتمان سعادت آباد ۵۴۵ متر نوساز، مشاعات هتلینگ" }),
        summary({ sourceAdId: "live3", title: "فروش 108 متر نوساز کم واحد در سعادت آباد" }),
        summary({ sourceAdId: "live5", title: "107 متر، نوساز کلید نخورده، تک واحدی، سعادت آباد" }),
      ],
      hasMore: false,
    });
    detail({
      live1: "آپارتمان سعادت آباد ۵۴۵ متر نوساز",
      live3: "فروش 108 متر نوساز کم واحد در سعادت آباد",
      live5: "107 متر، نوساز کلید نخورده، تک واحدی، سعادت آباد",
    });
    const done = await doneOf(def);

    expect(done.results).toHaveLength(3);
    for (const ad of done.results) {
      expect(ad.matchKind).toBe("exact");
      expect(ad.missingInfo).toEqual([]);
    }
  });

  it("documents current repair/buyer-side behavior: MUST evidence still counts as exact", async () => {
    // The pipeline has no service-vs-product or buyer-vs-seller distinction
    // (flaw #7, future M4b). These listings contain یخچال, so they satisfy
    // the MUST textually. matchKind "exact" here means MUST-evidenced, not
    // a transaction-direction claim. If service/intent logic is added later,
    // this test must be revisited.
    const def = def19({
      query: "یخچال",
      category: "home",
      include: ["یخچال"],
    });
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "repair", title: "تعمیر یخچال" }),
        summary({ sourceAdId: "buyer", title: "خریدار یخچال سالم خراب سوخته" }),
      ],
      hasMore: false,
    });
    detail({
      repair: "تعمیر یخچال در محل",
      buyer: "خریدار یخچال سالم خراب سوخته",
    });
    const done = await doneOf(def);

    expect(done.results).toHaveLength(2);
    // Current behavior: textual MUST match → exact. No silent transaction
    // claim is made; the limitation is documented, not hidden.
    for (const ad of done.results) {
      expect(ad.matchKind).toBe("exact");
    }
  });
});

describe("collapseDupes — bug #19 (dedupe before sort, keep newest)", () => {
  function cand(over: Partial<Candidate> & { sourceAdId: string }): Candidate {
    return {
      title: "گوشی سامسونگ",
      price: 100,
      city: "تهران",
      titleStrength: 1,
      needsDetailReview: false,
      ...over,
    };
  }

  it("the NEWER dupe survives even when it has LOWER titleStrength", () => {
    // Fetch order = newest first. The old code sorted by titleStrength
    // BEFORE dedupe, so the older repost (strength 5) shadowed the newer
    // one (strength 1). Dedupe must not care about score — only order.
    // NOTE: with the real titleScore, same-key ads always share a strength
    // (both derive from the title), so this is constructed directly to lock
    // the invariant against future scoring changes.
    const newer = cand({ sourceAdId: "new", titleStrength: 1 });
    const older = cand({ sourceAdId: "old", titleStrength: 5 });
    const { unique, dupsCollapsed } = collapseDupes([newer, older]);
    expect(dupsCollapsed).toBe(1);
    expect(unique.map((c) => c.sourceAdId)).toEqual(["new"]);
  });

  it("keeps fetch order for non-dupes (sort happens later, not here)", () => {
    const a = cand({ sourceAdId: "a", title: "گوشی", titleStrength: 1 });
    const b = cand({ sourceAdId: "b", title: "لپ‌تاپ", price: 200, titleStrength: 9 });
    const { unique, dupsCollapsed } = collapseDupes([a, b]);
    expect(dupsCollapsed).toBe(0);
    expect(unique.map((c) => c.sourceAdId)).toEqual(["a", "b"]);
  });

  it("different cities are not dupes (bug #18)", () => {
    const tehran = cand({ sourceAdId: "t" });
    const isfahan = cand({ sourceAdId: "i", city: "اصفهان" });
    const { unique, dupsCollapsed } = collapseDupes([tehran, isfahan]);
    expect(dupsCollapsed).toBe(0);
    expect(unique).toHaveLength(2);
  });
});
