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
import { resolveHuntDefinition } from "./definition";

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
});

describe("service intent — P0 (HumanTest S3: تعمیر یخچال)", () => {
  function defService(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "تعمیر یخچال",
      include: ["تعمیر", "یخچال"],
      exclude: [],
      should: [],
      city: "all",
      category: "all",
      priceMin: "",
      priceMax: "",
      transaction: "",
      condition: "",
      serviceIntent: true,
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  it("ranks the repairer above the fridge-for-sale", async () => {
    listings([
      { sourceAdId: "g1", title: "یخچال سامسونگ" },
      { sourceAdId: "s1", title: "تعمیرکار یخچال در منزل" },
    ]);
    detail({
      g1: "یخچال تعمیرشده، آماده فروش", // goods: matches یخچال only
      s1: "تعمیرات انواع یخچال در محل", // provider: demand satisfied via تعمیرکار/تعمیرات
    });
    const done = await doneOf(defService());
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1", "g1"]);
    expect(done.results[0].matchKind).toBe("exact");
    // The goods ad still renders (spectrum UX) but sinks: scoring-zero equivalent.
    expect(done.results[1].score).toBeLessThan(done.results[0].score - 2);
  });

  it("provider-form satisfies the تعمیر MUST (the S3 root cause)", async () => {
    listings([{ sourceAdId: "s1", title: "تعمیرکار یخچال" }]);
    detail({ s1: "خدمات تعمیر یخچال" });
    const done = await doneOf(defService());
    expect(done.results).toHaveLength(1);
    expect(done.results[0].missingInfo).toEqual([]);
    expect(done.results[0].evidence).toContain("تعمیر");
  });

  it("does NOT penalize goods ads when serviceIntent is off (S5 guard)", async () => {
    listings([{ sourceAdId: "g1", title: "یخچال سامسونگ" }]);
    detail({ g1: "یخچال نو، فروش" });
    const done = await doneOf(defService({ serviceIntent: false }));
    // No goods penalty without service intent: score must stay non-negative
    // and the ad must not be sunk by the P0 adjustments.
    expect(done.results).toHaveLength(1);
    expect(done.results[0].score).toBeGreaterThanOrEqual(0);
  });

  it("Q1: a fridge NEEDING repair sinks on a service hunt", async () => {
    listings([
      { sourceAdId: "n1", title: "یخچال نیازمند تعمیر" },
      { sourceAdId: "s1", title: "تعمیرکار یخچال در منزل" },
    ]);
    detail({
      n1: "یخچال خراب، نیازمند تعمیر", // good needing the service — not a provider
      s1: "تعمیرات انواع یخچال در محل",
    });
    const done = await doneOf(defService());
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1", "n1"]);
    expect(done.results[1].score).toBeLessThan(0);
  });

  it("در محل does NOT shield a seller ad (location phrase, not a trade word)", async () => {
    listings([
      { sourceAdId: "n1", title: "یخچال آدمیرال نیازمند تعمیر" },
      { sourceAdId: "s1", title: "تعمیرکار یخچال" },
    ]);
    detail({
      // Seller language: viewing on site. No trade word anywhere.
      n1: "فروش یخچال، بازدید در محل",
      s1: "تعمیرات یخچال",
    });
    const done = await doneOf(defService());
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1", "n1"]);
    expect(done.results[1].score).toBeLessThan(0);
  });

  it("نیازمند تعمیرکار describes the item's need, not the seller's trade", async () => {
    listings([
      { sourceAdId: "n1", title: "یخچال نیازمند تعمیرکار" },
      { sourceAdId: "s1", title: "تعمیرکار یخچال" },
    ]);
    detail({
      // Broken fridge for sale; the تعمیرکار here is what the ITEM needs.
      n1: "یخچال سالم نیست، نیازمند تعمیرکار",
      s1: "تعمیرات یخچال در محل",
    });
    const done = await doneOf(defService());
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1", "n1"]);
    expect(done.results[1].score).toBeLessThan(0);
  });

  it("Q4: تعمیری query does not trigger the service path", async () => {
    // resolveHuntDefinition-level: detectServiceIntent("یخچال تعمیری") is false,
    // so even if include carried تعمیر, the demand-family must not fire.
    // Here we assert the definition resolver end to end.
    const { resolveHuntDefinition } = await import("./definition");
    const def = resolveHuntDefinition({ query: "یخچال تعمیری" });
    expect(def?.serviceIntent).toBe(false);
    const def2 = resolveHuntDefinition({ query: "تعمیر یخچال" });
    expect(def2?.serviceIntent).toBe(true);
    expect(def2?.include).toContain("تعمیر");
  });
});

describe("transaction direction — P1 (HumanTest S4: خریدار یخچال)", () => {
  function defDir(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "خریدار یخچال",
      include: ["یخچال"], // خریدار is stripped: role word, not content
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  it("seek-buyer («خریدار یخچال»): the buyer ad outranks the offer ad", async () => {
    listings([
      { sourceAdId: "d1", title: "خریدار یخچال هستیم" },
      { sourceAdId: "s1", title: "یخچال سامسونگ" },
    ]);
    detail({
      d1: "خریدار انواع یخچال",
      s1: "یخچال سالم، فروش",
    });
    // R7 (navid's R6 product decision): bare «خریدار X» seeks BUYERS — the
    // buyer ad is what the hunter wants; the clear offer sinks (demote).
    const def = resolveHuntDefinition({ query: "خریدار یخچال" });
    expect(def!.roleMode).toBe("seek-buyer");
    const done = await doneOf(def!);
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["d1", "s1"]);
  });

  it("seek-seller («فروشنده یخچال»): the seller ad outranks the buyer ad", async () => {
    listings([
      { sourceAdId: "d1", title: "خریدار یخچال هستیم" },
      { sourceAdId: "s1", title: "یخچال سامسونگ" },
    ]);
    detail({
      d1: "خریدار انواع یخچال",
      s1: "یخچال سالم، فروش",
    });
    const def = resolveHuntDefinition({ query: "فروشنده یخچال" });
    expect(def!.roleMode).toBe("seek-seller");
    const done = await doneOf(def!);
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["s1", "d1"]);
  });

  it("resolveHuntDefinition strips role words from MUST (the S4 inversion)", async () => {
    const { resolveHuntDefinition } = await import("./definition");
    const def = resolveHuntDefinition({ query: "خریدار یخچال" });
    expect(def?.include).toEqual(["یخچال"]);
    const def2 = resolveHuntDefinition({ query: "فروشنده مبل راحتی" });
    expect(def2?.include).toEqual(["مبل", "راحتی"]);
  });
});

describe("semantic caps — unified engine (5b)", () => {  function defCap(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "probe",
      include: [],
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  it("sibling variant capped at near; exact model stays exact (S1)", async () => {
    listings([
      { sourceAdId: "md-exact", title: "آیفون ۱۳ پرو ۲۵۶ گیگ" },
      { sourceAdId: "md-max", title: "آیفون ۱۳ پرو مکس" },
    ]);
    detail({ "md-exact": "سالم", "md-max": "۱۲۸ گیگ" });
    const done = await doneOf(
      defCap({ query: "آیفون ۱۳ پرو", include: ["آیفون", "۱۳", "پرو"], category: "mobile" })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["md-exact"]).toBe("exact");
    // Every query token matches, but «مکس» adds unrequested specificity.
    expect(kinds["md-max"]).toBe("near");
  });

  it("«طرح آکوستیک» is not exact for a real acoustic-piano hunt", async () => {
    listings([
      { sourceAdId: "acoustic-real", title: "پیانو آکوستیک کاوایی KL-502" },
      { sourceAdId: "acoustic-style", title: "پیانو دیجیتال یاماها طرح آکوستیک" },
    ]);
    detail({
      "acoustic-real": "پیانو آکوستیک اصل ژاپن",
      "acoustic-style": "پیانو دیجیتال یاماها طرح آکوستیک",
    });
    const done = await doneOf(
      defCap({
        query: "پیانو اکوستیک",
        include: ["پیانو", "اکوستیک"],
        category: "music",
      })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["acoustic-real"]).toBe("exact");
    expect(kinds["acoustic-style"]).toBe("near");
  });

  it("an explicitly requested «طرح آکوستیک» remains exact", async () => {
    listings([{ sourceAdId: "style-requested", title: "پیانو طرح آکوستیک دیواری" }]);
    detail({ "style-requested": "پیانو طرح آکوستیک دیواری" });
    const done = await doneOf(
      defCap({
        query: "پیانو طرح اکوستیک",
        include: ["پیانو", "اکوستیک"],
        category: "music",
      })
    );
    const result = done.results.find((r) => r.sourceAdId === "style-requested");
    expect(result?.matchKind).toBe("exact");
  });

  it("accessory listing is REJECTED (R6: wrong item, not shown); the item itself stays exact", async () => {
    // R6 product decision (navid's R5 grades: 0 = wrong item): «قاب» for a
    // phone hunt is not a near-miss, it's the wrong item — rejected.
    listings([
      { sourceAdId: "acc-case", title: "قاب ایفون ۱۳ پرو" },
      { sourceAdId: "acc-glass", title: "گلس ایفون ۱۳ پرو" },
      { sourceAdId: "md-exact", title: "آیفون ۱۳ پرو ۲۵۶ گیگ" },
    ]);
    detail({ "acc-case": "قاب ژله‌ای", "acc-glass": "گلس سرامیکی", "md-exact": "سالم" });
    const done = await doneOf(
      defCap({ query: "آیفون ۱۳ پرو", include: ["آیفون", "۱۳", "پرو"], category: "mobile" })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["acc-case"]).toBeUndefined();
    expect(kinds["acc-glass"]).toBeUndefined();
    expect(done.stats.rejectedNoMatch).toBe(2);
    expect(kinds["md-exact"]).toBe("exact");
  });

  it("hunting the accessory itself is unaffected by the accessory cap", async () => {
    // The marker is skipped when the query itself contains it.
    listings([{ sourceAdId: "acc-case", title: "قاب ایفون ۱۳ پرو" }]);
    detail({ "acc-case": "قاب ژله‌ای" });
    const done = await doneOf(
      defCap({ query: "قاب ایفون ۱۳", include: ["قاب", "ایفون", "۱۳"], category: "mobile" })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["acc-case"]).toBe("exact");
  });

  it("repair polarity: «بدون تعمیر» satisfies, «تعمیر شده» contradicts", async () => {
    const def = defCap({
      query: "آیفون ۱۳، بدون تعمیر",
      include: ["آیفون", "۱۳"],
      exclude: ["تعمیر"],
      category: "mobile",
    });
    listings([{ sourceAdId: "no-repair", title: "آیفون ۱۳ بدون تعمیر" }]);
    detail({ "no-repair": "سالم و تمیز" });
    const done = await doneOf(def);
    // Explicitly satisfies the absence request — not banned by its own vocabulary.
    expect(done.results).toHaveLength(1);
    expect(done.results[0].matchKind).toBe("exact");

    listings([{ sourceAdId: "repaired", title: "آیفون ۱۳" }]);
    detail({ repaired: "تعمیر شده، سالم" });
    const done2 = await doneOf(def);
    // Explicit contradiction — rejected.
    expect(done2.results).toHaveLength(0);
  });

  it("service offer for the wrong appliance capped at near (target binding)", async () => {
    listings([
      { sourceAdId: "wm-incidental", title: "تعمیر لباسشویی در محل" },
      { sourceAdId: "fridge-offer", title: "تعمیر یخچال در محل" },
    ]);
    detail({
      "wm-incidental": "تعمیر لباسشویی در محل با ضمانت یکساله، یخچال فریزر هم موجود است",
      "fridge-offer": "تعمیر یخچال در محل، سرویس فوری",
    });
    const done = await doneOf(
      defCap({
        query: "تعمیر یخچال",
        include: ["تعمیر", "یخچال"],
        serviceIntent: true,
        category: "home",
      })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    // Offer targets the washer; the fridge is incidental and far.
    expect(kinds["wm-incidental"]).toBe("near");
    expect(kinds["fridge-offer"]).toBe("exact");
  });

  it("item needing repair capped at near for a service query (not exact)", async () => {
    listings([
      { sourceAdId: "need-daewoo", title: "یخچال فریزر دوو" },
      { sourceAdId: "offer-ok", title: "تعمیر یخچال در محل" },
    ]);
    detail({
      "need-daewoo": "یخچال فریزر دوو-نیاز به تعمیر دارد",
      "offer-ok": "تعمیر یخچال در محل، سرویس فوری",
    });
    const done = await doneOf(
      defCap({
        query: "تعمیر یخچال",
        include: ["تعمیر", "یخچال"],
        serviceIntent: true,
        category: "home",
      })
    );
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["need-daewoo"]).toBe("near");
    expect(kinds["offer-ok"]).toBe("exact");
    // And the genuine offer still outranks the needs-repair item.
    expect(done.results[0].sourceAdId).toBe("offer-ok");
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

describe("S5 goods-intent regression gate (R1a: B 0.8688)", () => {
  function defS5(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "پراید ۱۳۱ مدل ۹۸",
      include: ["پراید", "۱۳۱", "مدل", "۹۸"],
      exclude: [],
      should: [],
      city: "all",
      category: "vehicles",
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a detailed goods query without losing model/year terms", async () => {
    const { resolveHuntDefinition } = await import("./definition");
    const def = resolveHuntDefinition({ query: "پراید ۱۳۱ مدل ۹۸" });
    expect(def?.category).toBe("vehicles");
    // The detail terms must survive into MUST — losing «۹۸» would make
    // every Pride 131 an exact match.
    expect(def?.include).toContain("پراید");
    expect(def?.include).toContain("۹۸");
  });

  it("exact model+year stays exact; wrong year capped at near", async () => {
    mockSearchLists.mockResolvedValueOnce({
      listings: [
        summary({ sourceAdId: "right", title: "پراید ۱۳۱ مدل ۹۸" }),
        summary({ sourceAdId: "wrong-year", title: "پراید ۱۳۱ مدل ۹۵" }),
      ],
      hasMore: false,
    });
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: id === "right" ? "سالم، بیمه دارد" : "سالم",
      images: [],
      categorySlug: "",
    }));
    const done = await doneOf(defS5());
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["right"]).toBe("exact");
    // «۹۸» is missing → near via MUST-missing, never exact.
    expect(kinds["wrong-year"]).toBe("near");
    expect(done.results[0].sourceAdId).toBe("right");
  });
});

describe("R3 fixes — 2026-10-17 grading round", () => {
  function defCap(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "probe",
      include: [],
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  it("P0: «بدون رنگ» is an absent-attribute, not a ban — the R3 inversion", async () => {
    const def = resolveHuntDefinition({ query: "ماشین بدون رنگ" });
    expect(def?.include).toEqual(["ماشین"]);
    // The killer assertion: «رنگ» must NOT be a hard exclude anymore.
    expect(def?.exclude).toEqual([]);
    expect(def?.absentAttributes).toEqual(["رنگ"]);

    listings([
      { sourceAdId: "good", title: "پراید ۱۳۱ مدل ۹۸ شاسی پلمپ و بدون رنگ" },
      { sourceAdId: "plain", title: "پراید ۸۶" },
      { sourceAdId: "repainted", title: "پراید رنگ شده" },
      { sourceAdId: "battery", title: "باطری ماشین" },
    ]);
    detail({
      good: "ماشین سالم و تمیز",
      plain: "ماشین سالم",
      repainted: "ماشین سالم",
      battery: "باطری ماشین نو",
    });
    const done = await doneOf(def!);
    const byId = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r]));
    // The بدون‌رنگ car survives (was murdered at the title phase before).
    expect(byId["good"].matchKind).toBe("exact");
    expect(byId["good"].evidence).toContain("بدون رنگ");
    // No paint info → honest near, never exact.
    expect(byId["plain"].matchKind).toBe("near");
    // Explicit contradiction → rejected.
    expect(byId["repainted"]).toBeUndefined();
    // «باطری ماشین» is not a car — R6: wrong item → rejected (was near).
    expect(byId["battery"]).toBeUndefined();
    // The بدون‌رنگ car outranks the paint-unknown one.
    expect(done.results[0].sourceAdId).toBe("good");
  });

  it("P1: «می‌خوام» never becomes a MUST term", () => {
    const def = resolveHuntDefinition({ query: "نصاب کولر گازی می‌خوام" });
    // Decision v2 (intent contract): the agent noun «نصاب» resolves to
    // its ACTION term «نصب» — ads offer نصب, hunters want the service.
    expect(def?.include).toEqual(["کولر", "گازی", "نصب"]);
    expect(def?.include).not.toContain("می");
    expect(def?.include).not.toContain("نصاب");
  });

  it("P1: parts/packaging subjects cap to near; clean subjects stay exact", async () => {
    const def = resolveHuntDefinition({ query: "پراید" });
    listings([
      { sourceAdId: "car", title: "پراید ۱۳۱ مدل ۹۶" },
      { sourceAdId: "van", title: "وانت پراید" },
      { sourceAdId: "rim", title: "رینگ پراید" },
      { sourceAdId: "feature", title: "پراید ۱۳۱ با رینگ اسپرت" },
    ]);
    detail({
      car: "پراید سالم",
      van: "وانت پراید سالم",
      rim: "رینگ پراید نو",
      feature: "پراید سالم با رینگ اسپرت",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["car"]).toBe("exact");
    // وانت is a marginal variant (R3 graded 1).
    expect(kinds["van"]).toBe("near");
    // A rim is not a car (R6: rejected, not near).
    expect(kinds["rim"]).toBeUndefined();
    // …but a car WITH rims is a car (clean subject).
    expect(kinds["feature"]).toBe("exact");
  });

  it("P1: packaging subject («کارتون») is not the item", async () => {
    const def = resolveHuntDefinition({ query: "ماشین لباسشویی" });
    listings([
      { sourceAdId: "washer", title: "ماشین لباسشویی پاکشوما" },
      { sourceAdId: "box", title: "کارتون یخچال فریزر و ماشین لباسشویی" },
    ]);
    detail({
      washer: "ماشین لباسشویی سالم",
      box: "کارتون ماشین لباسشویی",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["washer"]).toBe("exact");
    expect(kinds["box"]).toBeUndefined(); // R6: wrong item → rejected
  });

  it("P1: derived products («کره») demote only when they lead", async () => {
    const def = resolveHuntDefinition({ query: "بادوم زمینی" });
    listings([
      { sourceAdId: "nut", title: "بادوم زمینی مخصوص کره گیری" },
      { sourceAdId: "butter", title: "کره بادوم زمینی" },
      { sourceAdId: "machine", title: "دستگاه کره بادوم زمینی" },
    ]);
    detail({
      nut: "بادوم زمینی تازه",
      butter: "کره بادوم زمینی خوشمزه",
      machine: "دستگاه کره گیری",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["nut"]).toBe("exact");
    expect(kinds["butter"]).toBeUndefined(); // R6: wrong item → rejected
    expect(kinds["machine"]).toBeUndefined(); // R6: wrong item → rejected
  });

  it("P1: equipment-before-service — selling tools is not offering the service", async () => {
    const def = resolveHuntDefinition({ query: "تعمیرات تخصصی موبایل" });
    expect(def?.serviceIntent).toBe(true);
    listings([
      { sourceAdId: "shop", title: "تعمیرات تخصصی موبایل در محل" },
      { sourceAdId: "tools", title: "فروش فوری تجهیزات تخصصی تعمیرات موبایل" },
    ]);
    detail({
      shop: "تعمیرات موبایل با گارانتی",
      tools: "تجهیزات تعمیرات موبایل نو",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["shop"]).toBe("exact");
    expect(kinds["tools"]).toBeUndefined(); // R6: wrong item → rejected
  });
});

describe("R4 fixes — 2026-10-17 second grading round", () => {
  function defCap(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "probe",
      include: [],
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  it("R4: expanded part subjects (دیسک/کلاچ/فنر/درب/گیربکس) are not the car", async () => {
    const def = resolveHuntDefinition({ query: "پراید" });
    listings([
      { sourceAdId: "car", title: "پراید ۱۳۱ مدل ۹۶" },
      { sourceAdId: "clutch", title: "دیسک و صحفه کلاچ پراید" },
      { sourceAdId: "spring", title: "فنر عقب پراید" },
      { sourceAdId: "gearbox", title: "گیربکس پراید ۲۰۶" },
      { sourceAdId: "door", title: "درب پراید" },
    ]);
    detail({
      car: "پراید سالم",
      clutch: "دیسک و صفحه کلاچ پراید",
      spring: "فنر عقب پراید",
      gearbox: "گیربکس پراید",
      door: "درب پراید",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["car"]).toBe("exact");
    // R6: wrong item → rejected, not near.
    expect(kinds["clutch"]).toBeUndefined();
    expect(kinds["spring"]).toBeUndefined();
    expect(kinds["gearbox"]).toBeUndefined();
    expect(kinds["door"]).toBeUndefined();
  });

  it("R4: «گارد ایفون» is not the phone; a phone WITH a case stays exact", async () => {
    const def = resolveHuntDefinition({ query: "آیفون ۱۳ پرو" });
    listings([
      { sourceAdId: "phone", title: "آیفون ۱۳ پرو" },
      { sourceAdId: "case", title: "گارد ایفون ۱۳ پرو" },
      { sourceAdId: "withcase", title: "ایفون ۱۳ پرو با گارد رایگان" },
    ]);
    detail({
      phone: "آیفون ۱۳ پرو سالم",
      case: "گارد ایفون ۱۳ پرو",
      withcase: "ایفون ۱۳ پرو با گارد رایگان",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["phone"]).toBe("exact");
    expect(kinds["case"]).toBeUndefined(); // R6: wrong item → rejected
    // Clean subject: the case is a feature, not the offering.
    expect(kinds["withcase"]).toBe("exact");
  });

  it("R4: consumables («پودر») are not the machine", async () => {
    const def = resolveHuntDefinition({ query: "ماشین لباسشویی" });
    listings([
      { sourceAdId: "washer", title: "ماشین لباسشویی پاکشوما" },
      { sourceAdId: "powder", title: "پودر ماشین لباسشویی" },
      { sourceAdId: "hose", title: "شلنگ ماشین لباسشویی" },
    ]);
    detail({
      washer: "ماشین لباسشویی سالم",
      powder: "پودر ماشین لباسشویی",
      hose: "شلنگ ماشین لباسشویی",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["washer"]).toBe("exact");
    expect(kinds["powder"]).toBeUndefined(); // R6: wrong item → rejected
    expect(kinds["hose"]).toBeUndefined(); // R6: wrong item → rejected
  });

  it("R4: training courses are not the service", async () => {
    const def = resolveHuntDefinition({ query: "تعمیرات تخصصی موبایل" });
    listings([
      { sourceAdId: "shop", title: "تعمیرات تخصصی موبایل در محل" },
      { sourceAdId: "course", title: "آموزش تخصصی تعمیرات موبایل" },
      { sourceAdId: "withcourse", title: "تعمیرات تخصصی موبایل با آموزش رایگان" },
    ]);
    detail({
      shop: "تعمیرات موبایل با گارانتی",
      course: "آموزش تعمیرات موبایل",
      withcourse: "تعمیرات تخصصی موبایل با آموزش رایگان",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["shop"]).toBe("exact");
    expect(kinds["course"]).toBeUndefined(); // R6: wrong item → rejected
    // Clean subject: the course mention is a feature, not the offering.
    expect(kinds["withcourse"]).toBe("exact");
  });

  it("R4: «یخچال پراید وانت» equipment subject is not the van", async () => {
    const def = resolveHuntDefinition({ query: "وانت پراید" });
    listings([
      { sourceAdId: "van", title: "پراید وانت مدل ۱۴۰۲" },
      { sourceAdId: "fridge", title: "یخچال پراید وانت مخصوص حمل بستنی" },
    ]);
    detail({
      van: "پراید وانت سالم",
      fridge: "یخچال مخصوص حمل بستنی",
    });
    const done = await doneOf(def!);
    const kinds = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
    expect(kinds["van"]).toBe("exact");
    expect(kinds["fridge"]).toBeUndefined(); // R6: wrong item → rejected
  });

  it("R4: ingredient rule — «مخصوص کره گیری» is not the butter for a کره hunt", async () => {
    const defButter = resolveHuntDefinition({ query: "کره بادوم زمینی" });
    listings([
      { sourceAdId: "butter", title: "کره بادوم زمینی اعلا" },
      { sourceAdId: "ingredient", title: "بادوم زمینی مخصوص کره گیری" },
    ]);
    detail({
      butter: "کره بادوم زمینی",
      ingredient: "بادوم زمینی مخصوص کره گیری",
    });
    const doneButter = await doneOf(defButter!);
    const kindsButter = Object.fromEntries(
      doneButter.results.map((r) => [r.sourceAdId, r.matchKind])
    );
    expect(kindsButter["butter"]).toBe("exact");
    expect(kindsButter["ingredient"]).toBeUndefined(); // R6: wrong item → rejected

    // …but for a «بادوم زمینی» hunt the same ad IS the item (graded 3).
    const defNut = resolveHuntDefinition({ query: "بادوم زمینی" });
    listings([{ sourceAdId: "ingredient", title: "بادوم زمینی مخصوص کره گیری" }]);
    detail({ ingredient: "بادوم زمینی مخصوص کره گیری" });
    const doneNut = await doneOf(defNut!);
    expect(doneNut.results[0]?.matchKind).toBe("exact");
  });

  it("R4: absent synonym bridge — «بی رنگ» satisfies «بدون تصادف»", async () => {
    const def = resolveHuntDefinition({ query: "ماشین بدون تصادف" });
    expect(def?.absentAttributes).toEqual(["تصادف"]);
    listings([
      { sourceAdId: "ok", title: "پراید ۸۶ تمیز" },
      { sourceAdId: "repainted", title: "پراید رنگ شده" },
      { sourceAdId: "plain", title: "پراید ۸۶" },
    ]);
    detail({
      ok: "ماشین سالم و بی رنگ",
      repainted: "ماشین سالم",
      plain: "ماشین سالم",
    });
    const done = await doneOf(def!);
    const byId = Object.fromEntries(done.results.map((r) => [r.sourceAdId, r]));
    // The bridge: بی رنگ ⇒ بدون تصادف, disclosed in the evidence.
    expect(byId["ok"].matchKind).toBe("exact");
    expect(byId["ok"].evidence).toContain("بدون تصادف (از: بدون رنگ)");
    // Explicit repaint ⇒ contradiction via the synonym ⇒ rejected.
    expect(byId["repainted"]).toBeUndefined();
    // No paint info ⇒ honest near.
    expect(byId["plain"].matchKind).toBe("near");
  });

  it("R4: «وام» infers buy — rentals never enter a «بدون وام» hunt", async () => {
    const def = resolveHuntDefinition({ query: "آپارتمان بدون وام" });
    expect(def?.transaction).toBe("buy");
  });
});

describe("R6 fixes — 2026-10-17 third grading round (wrong-item rejection)", () => {
  function defCap(over: Partial<HuntDefinition> = {}): HuntDefinition {
    return {
      query: "probe",
      include: [],
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

  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }

  function kindsOf(done: { results: Array<{ sourceAdId: string; matchKind: string }> }) {
    return Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
  }

  it("R6: junkyard + suspension parts rejected via subject phrase (R5 h3/h4 zeros)", async () => {
    const def = resolveHuntDefinition({ query: "پراید" });
    listings([
      { sourceAdId: "car", title: "پراید ۱۳۱ مدل ۹۶" },
      { sourceAdId: "junk", title: "اوراقی خودرو پیکان و پراید" },
      { sourceAdId: "susp", title: "ست کامل جلوبندی پراید" },
      { sourceAdId: "stuff", title: "بغل در ۱۴۱، ۱۳۲کفپوش پراید" },
    ]);
    detail({
      car: "پراید سالم",
      junk: "اوراقی خودرو",
      susp: "جلوبندی پراید",
      stuff: "کفپوش پراید",
    });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["car"]).toBe("exact");
    // Wrong item → rejected, not near (R5 product decision).
    expect(kinds["junk"]).toBeUndefined();
    expect(kinds["susp"]).toBeUndefined();
    expect(kinds["stuff"]).toBeUndefined();
    expect(done.stats.rejectedNoMatch).toBe(3);
  });

  it("R6: کره leak — sale-shape shields don't protect the derived product (R5 h8)", async () => {
    const def = resolveHuntDefinition({ query: "بادوم زمینی" });
    listings([
      { sourceAdId: "nut", title: "بادوم زمینی تازه" },
      { sourceAdId: "bulk", title: "فروش عمده کره بادوم زمینی شکلاتی" },
      { sourceAdId: "factory", title: "تولیدی کره بادوم زمینی" },
      { sourceAdId: "typo", title: "کرم بادوم زمینی پروتئینی" },
      { sourceAdId: "purpose", title: "بادوم زمینی مخصوص کره گیری" },
      { sourceAdId: "wholesale", title: "فروش عمده بادوم زمینی" },
    ]);
    detail({
      nut: "بادوم زمینی",
      bulk: "کره بادوم زمینی",
      factory: "تولیدی کره",
      typo: "کره بادوم زمینی",
      purpose: "بادوم زمینی مخصوص کره گیری",
      wholesale: "بادوم زمینی عمده",
    });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["nut"]).toBe("exact");
    expect(kinds["bulk"]).toBeUndefined();
    expect(kinds["factory"]).toBeUndefined();
    expect(kinds["typo"]).toBeUndefined();
    // Purpose phrase: the ad IS peanuts.
    expect(kinds["purpose"]).toBe("exact");
    // Legit wholesale peanuts: عمده-skip must not nuke the item.
    expect(kinds["wholesale"]).toBe("exact");
    expect(done.stats.rejectedNoMatch).toBe(3);
  });

  it("R6: seeker roles rejected; «مشتری‌مدار» seller stays (false-positive guard)", async () => {
    const def = resolveHuntDefinition({ query: "یخچال" });
    listings([
      { sourceAdId: "fridge", title: "یخچال فریزر دوقلو" },
      { sourceAdId: "seeker", title: "مشتری یخچال فریزر کارکرده" },
      { sourceAdId: "oriented", title: "فروشنده مشتری‌مدار یخچال" },
    ]);
    detail({
      fridge: "یخچال سالم",
      seeker: "مشتری یخچال",
      oriented: "فروشنده یخچال",
    });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["fridge"]).toBe("exact");
    expect(kinds["seeker"]).toBeUndefined();
    // ZWNJ splits مشتری‌مدار — first-position rule keeps this seller clean.
    expect(kinds["oriented"]).toBeDefined();
  });

  it("R6: mixed-role dealer «فروشنده خریدار» rejected; pure seller stays", async () => {
    const def = resolveHuntDefinition({ query: "یخچال" });
    listings([
      { sourceAdId: "mixed", title: "فروشنده خریدار یخچال فریزر" },
      { sourceAdId: "seller", title: "فروشنده یخچال فریزر" },
    ]);
    detail({ mixed: "خرید و فروش یخچال", seller: "فروش یخچال" });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["mixed"]).toBeUndefined();
    expect(kinds["seller"]).toBeDefined();
  });

  it("R6: «لپازم» typo rejected (R5 h24)", async () => {
    const def = resolveHuntDefinition({ query: "موتور سیکلت" });
    listings([
      { sourceAdId: "bike", title: "موتور سیکلت هوندا ۱۲۵" },
      { sourceAdId: "acc", title: "لپازم موتور سیکلت" },
    ]);
    detail({ bike: "موتور سیکلت سالم", acc: "لوازم موتور" });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["bike"]).toBe("exact");
    expect(kinds["acc"]).toBeUndefined();
  });

  it("R6/R12: demand-goods caps a product ad to near (reject demoted by the R11 audit)", async () => {
    const def = defCap({
      query: "نصاب کولر گازی می‌خوام",
      include: ["نصاب", "کولر", "گازی"],
      serviceIntent: true,
    });
    listings([
      { sourceAdId: "goods", title: "کولرگازی اصلی کولر گازی inverter (نصب امروز)" },
      { sourceAdId: "pro", title: "نصب و تعمیر کولر گازی" },
    ]);
    detail({ goods: "کولر گازی نو", pro: "نصاب کولر گازی" });
    const done = await doneOf(def);
    const kinds = kindsOf(done);
    // نصب matched only via the morphological family; the ad sells ACs.
    // R6 rejected it; R11's human audit found 7/8 demand-goods rejections
    // WRONG (grade 3 genuine installers) — R12 demotes the rule to a
    // near-cap (doubt = keep) until re-derived from real firing text.
    expect(kinds["goods"]).toBe("near");
    // Literal service lead stays.
    expect(kinds["pro"]).toBeDefined();
    // R12b (F3): the demote is labelled on the result for battery audits.
    expect(done.results.find((r) => r.sourceAdId === "goods")?.demotedBy).toBe(
      "demand-goods"
    );
  });

  it("R6/R12: bait titles capped to near; terse-but-honest descriptions stay", async () => {
    const def = defCap({ query: "موتور سیکلت", include: ["موتور", "سیکلت"] });
    listings([
      { sourceAdId: "bait", title: "موتور سیکلت" },
      { sourceAdId: "honest", title: "موتور سیکلت هوندا" },
      { sourceAdId: "variant", title: "پراید ۱۳۱" },
    ]);
    detail({
      bait: "موتور برق ۳/۵کیلووات کوباتاژاپن سالم و سرحال",
      honest: "تمیز، مدل ۱۴۰۳، مدارک کامل",
      variant: "پراید وانت مدل ۹۰",
    });
    // Variant control needs its own definition (different MUST).
    const done = await doneOf(def);
    const kinds = kindsOf(done);
    // R6 rejected the bait title; R11's audit found 11/11 bait rejections
    // WRONG (grade 3) — R12 demotes bait to a near-cap (never exact).
    expect(kinds["bait"]).toBe("near");
    expect(kinds["honest"]).toBeDefined();
    // R12b (F3): the demote is labelled on the result for battery audits.
    expect(done.results.find((r) => r.sourceAdId === "bait")?.demotedBy).toBe(
      "bait"
    );

    const defV = defCap({ query: "پراید ۱۳۱", include: ["پراید", "۱۳۱"] });
    listings([{ sourceAdId: "variant", title: "پراید ۱۳۱" }]);
    detail({ variant: "پراید وانت مدل ۹۰" });
    const doneV = await doneOf(defV);
    // وانت is a variant → near (honest spectrum), NOT bait-rejected.
    expect(kindsOf(doneV)["variant"]).toBe("near");
  });

  it("R6: sibling variant in lead position stays near (not rejected)", async () => {
    const def = defCap({ query: "آیفون ۱۳ پرو", include: ["آیفون", "۱۳", "پرو"], category: "mobile" });
    listings([{ sourceAdId: "rev", title: "مکس آیفون ۱۳ پرو" }]);
    detail({ rev: "آیفون ۱۳ پرو مکس" });
    const done = await doneOf(def);
    expect(kindsOf(done)["rev"]).toBe("near");
  });

  it("R6: guards — hunting the marker itself is unaffected", async () => {
    const defT = resolveHuntDefinition({ query: "آموزش تعمیرات موبایل" });
    listings([{ sourceAdId: "course", title: "آموزش تعمیرات موبایل" }]);
    detail({ course: "آموزش تعمیرات موبایل" });
    expect(kindsOf(await doneOf(defT!))["course"]).toBe("exact");

    const defY = resolveHuntDefinition({ query: "یخچال" });
    listings([{ sourceAdId: "fridge", title: "یخچال فریزر" }]);
    detail({ fridge: "یخچال سالم" });
    expect(kindsOf(await doneOf(defY!))["fridge"]).toBe("exact");

    const defB = resolveHuntDefinition({ query: "کره بادوم زمینی" });
    listings([{ sourceAdId: "butter", title: "کره بادوم زمینی" }]);
    detail({ butter: "کره بادوم زمینی" });
    expect(kindsOf(await doneOf(defB!))["butter"]).toBe("exact");
  });
});

describe("R7 speech-act role — seek-buyer (navid's R6 product decision)", () => {
  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
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
  async function doneOf(def: HuntDefinition) {
    const events: HuntEvent[] = [];
    await runPipeline(def, (e) => events.push(e));
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    return done;
  }

  it("effectiveWantsSellers: roleMode is the single authority (direction was dead)", async () => {
    const { effectiveWantsSellers } = await import("./pipeline");
    const base: HuntDefinition = { ...DEF, include: ["پراید"] };
    expect(effectiveWantsSellers({ ...base })).toBe(true); // default: buyer
    expect(effectiveWantsSellers({ ...base, roleMode: "seek-buyer" })).toBe(false);
    expect(effectiveWantsSellers({ ...base, roleMode: "self-seller" })).toBe(false);
    expect(effectiveWantsSellers({ ...base, roleMode: "seek-seller" })).toBe(true);
    expect(effectiveWantsSellers({ ...base, roleMode: "self-buyer" })).toBe(true);
    expect(effectiveWantsSellers({ ...base, roleMode: "none" })).toBe(true);
    // R7-redteam: def.direction was never set by any code path — the old
    // "explicit form wins" assertions tested a fiction. roleMode decides.
  });

  it("resolveHuntDefinition carries the query's roleMode", async () => {
    expect(resolveHuntDefinition({ query: "خریدار پراید" })?.roleMode).toBe("seek-buyer");
    expect(resolveHuntDefinition({ query: "پراید" })?.roleMode).toBe("none");
  });

  it("seek-buyer hunt: buyer ads outrank clear offer ads (wrong-side demote)", async () => {
    const def = resolveHuntDefinition({ query: "خریدار پراید" });
    listings([
      { sourceAdId: "offer", title: "پراید ۱۳۱ فروش فوری" },
      { sourceAdId: "buyer", title: "خریدار پراید" },
    ]);
    detail({
      offer: "پراید ۱۳۱ مدل ۹۰ فروش فوری",
      buyer: "خریدار پراید هستیم نقد",
    });
    const done = await doneOf(def!);
    const ids = done.results.map((r) => r.sourceAdId);
    expect(ids).toContain("buyer");
    expect(ids).toContain("offer");
    expect(ids.indexOf("buyer")).toBeLessThan(ids.indexOf("offer"));
  });

  it("role-silent ads stay fully compatible on a seek-buyer hunt", async () => {
    const def = resolveHuntDefinition({ query: "خریدار پراید" });
    listings([{ sourceAdId: "plain", title: "پراید ۱۳۱" }]);
    detail({ plain: "پراید ۱۳۱ مدل ۹۰" });
    const done = await doneOf(def!);
    // No role cue → unknown stance → no wrong-side penalty, still exact.
    expect(done.results.map((r) => r.sourceAdId)).toEqual(["plain"]);
    expect(done.results[0].matchKind).toBe("exact");
  });

  it("default hunt still demotes dealer ads (no S4 regression)", async () => {
    const def = resolveHuntDefinition({ query: "پراید" });
    listings([
      { sourceAdId: "seller", title: "پراید ۱۳۱" },
      { sourceAdId: "dealer", title: "خریدار پراید" },
    ]);
    detail({
      seller: "پراید ۱۳۱ مدل ۹۰",
      dealer: "خریدار پراید هستیم",
    });
    const done = await doneOf(def!);
    const ids = done.results.map((r) => r.sourceAdId);
    expect(ids.indexOf("seller")).toBeLessThan(ids.indexOf("dealer"));
  });
});

describe("R7 defeasible absence — counter-evidence defeats the universal (DeepSeek P2)", () => {
  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
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
  async function doneOf(def: HuntDefinition) {
    const events: HuntEvent[] = [];
    await runPipeline(def, (e) => events.push(e));
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    return done;
  }
  function kindsOf(done: { results: Array<{ sourceAdId: string; matchKind: string }> }) {
    return Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
  }

  it("R6 h7: partial negation «دو تیکه رنگ و باقیش بی رنگ» is present → rejected", async () => {
    const def = resolveHuntDefinition({ query: "ماشین بدون رنگ" });
    expect(def!.absentAttributes).toEqual(["رنگ"]);
    listings([
      { sourceAdId: "partial", title: "ماشین پراید ۱۳۱" },
      { sourceAdId: "clean", title: "ماشین پراید ۱۱۱" },
    ]);
    detail({
      partial: "ماشین دو تیکه رنگ و باقیش بی رنگ",
      clean: "ماشین پراید بدون رنگ",
    });
    const kinds = kindsOf(await doneOf(def!));
    expect(kinds["partial"]).toBeUndefined(); // rejected, not shown
    expect(kinds["clean"]).toBe("exact");
  });

  it("R6 h12: «دور رنگ» implied-present caps to near, never exact", async () => {
    const def = resolveHuntDefinition({ query: "ماشین بدون تصادف" });
    listings([
      { sourceAdId: "repaint", title: "ماشین پراید ۱۳۲" },
      { sourceAdId: "clean", title: "ماشین پراید ۱۴۱" },
    ]);
    detail({
      repaint: "ماشین شاسیا سالم بدون ضربه دور رنگ جهت زیبایی",
      clean: "ماشین پراید بدون رنگ",
    });
    const done = await doneOf(def!);
    const kinds = kindsOf(done);
    expect(kinds["repaint"]).toBe("near"); // was: false exact
    expect(kinds["clean"]).toBe("exact");
    // And the repaint ranks below the clean car.
    const ids = done.results.map((r) => r.sourceAdId);
    expect(ids.indexOf("clean")).toBeLessThan(ids.indexOf("repaint"));
  });

  it("negated bodywork («بدون نیاز به صافکاری») is not implied-present", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    // Supports absence (or unknown) — never counter-evidence.
    expect(assessAbsencePolarity("ماشین بدون نیاز به صافکاری", "تصادف").polarity).not.toBe("implied");
    expect(assessAbsencePolarity("ماشین بدون نیاز به صافکاری", "تصادف").polarity).not.toBe("present");
  });

  it("plain absence and unknown keep their old verdicts", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    expect(assessAbsencePolarity("پراید بدون رنگ", "رنگ").polarity).toBe("absent");
    expect(assessAbsencePolarity("پراید مدل ۹۰", "رنگ").polarity).toBe("unknown");
    expect(assessAbsencePolarity("پراید رنگ شده", "رنگ").polarity).toBe("present");
    expect(assessAbsencePolarity("بی رنگ", "تصادف").polarity).toBe("absent"); // synonym bridge kept
  });
});

describe("R7-redteam — adversarial review fixes (2026-10-18)", () => {
  function listings(rows: Array<{ sourceAdId: string; title: string }>) {
    mockSearchLists.mockResolvedValueOnce({
      listings: rows.map((r) => summary({ ...r })),
      hasMore: false,
    });
  }
  function detail(descById: Record<string, string>, slugById: Record<string, string> = {}) {
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: descById[id] ?? "",
      images: [],
      categorySlug: slugById[id] ?? "",
    }));
  }
  async function doneOf(def: HuntDefinition) {
    const events: HuntEvent[] = [];
    await runPipeline(def, (e) => events.push(e));
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error("no done event");
    return done;
  }
  function kindsOf(done: { results: Array<{ sourceAdId: string; matchKind: string }> }) {
    return Object.fromEntries(done.results.map((r) => [r.sourceAdId, r.matchKind]));
  }

  it("P0: «بدون ضربه دور رنگ» for attr رنگ is implied → near, never exact", async () => {
    const def = resolveHuntDefinition({ query: "ماشین بدون رنگ" });
    expect(def!.absentAttributes).toEqual(["رنگ"]);
    listings([
      { sourceAdId: "repaint", title: "ماشین پراید ۱۳۱" },
      { sourceAdId: "clean", title: "ماشین پراید ۱۱۱" },
    ]);
    detail({
      repaint: "ماشین شاسیا سالم بدون ضربه، دور رنگ جهت زیبایی",
      clean: "ماشین پراید بدون رنگ",
    });
    const kinds = kindsOf(await doneOf(def!));
    // The R7 suite only covered attr تصادف, where the synonym bridge masked
    // the span swallowing the repaint. For attr رنگ the repaint must cap.
    expect(kinds["repaint"]).toBe("near");
    expect(kinds["clean"]).toBe("exact");
  });

  it("P0: the «خریدار یخچال» buyer ad survives a misleading slug (S4 flagship)", async () => {
    const def = resolveHuntDefinition({ query: "خریدار یخچال" });
    expect(def!.roleMode).toBe("seek-buyer");
    listings([{ sourceAdId: "buyerad", title: "خریدار یخچال هستیم" }]);
    detail(
      { buyerad: "خریدار یخچال هستیم قیمت توافقی" },
      { buyerad: "home-kitchen" }
    );
    const kinds = kindsOf(await doneOf(def!));
    // Old code: head خریدار unknown → slug furniture vs appliance → rejected,
    // defeating the very ads the seek-buyer product decision wants.
    expect(kinds["buyerad"]).toBe("exact");
  });

  it("P1: «بدون رنگ و صافکاری» ≡ «بدون رنگ، بدون صافکاری» (negation distributes)", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    expect(assessAbsencePolarity("ماشین بدون رنگ و صافکاری", "رنگ").polarity).toBe("absent");
    expect(assessAbsencePolarity("ماشین بدون رنگ، بدون صافکاری", "رنگ").polarity).toBe("absent");
    // Distribution only fires for implied words after و — «بدون رنگ و شاسی
    // سالم» keeps its chassis claim (no inversion).
    expect(assessAbsencePolarity("ماشین بدون رنگ و شاسی سالم", "رنگ").polarity).toBe("absent");
  });

  it("P1: «بی ضربه دور رنگ» keeps its repaint (negation governs ضربه only)", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    expect(assessAbsencePolarity("ماشین بی ضربه دور رنگ", "رنگ").polarity).toBe("implied");
    // «بدون دور رنگ» is a no-repaint claim → unknown/near, not false exact.
    expect(assessAbsencePolarity("ماشین بدون دور رنگ", "رنگ").polarity).toBe("unknown");
  });

  it("P1: item-first service query («یخچال تعمیر») does not kill the service ad", async () => {
    const def = resolveHuntDefinition({ query: "یخچال تعمیر" });
    listings([
      { sourceAdId: "service", title: "تعمیر یخچال در محل" },
      { sourceAdId: "goods", title: "یخچال فریزر نو" },
      { sourceAdId: "unrelated", title: "مبل راحتی" },
    ]);
    detail({
      service: "تعمیر یخچال در محل با ضمانت",
      goods: "یخچال فریزر نو",
      unrelated: "مبل راحتی",
    });
    const kinds = kindsOf(await doneOf(def!));
    expect(kinds["service"]).not.toBeUndefined(); // was: kind:domain rejected
    expect(kinds["goods"]).not.toBeUndefined(); // S3: target goods demoted, not rejected
    expect(kinds["unrelated"]).toBeUndefined(); // truly unrelated → rejected
  });

  it("P2: «شش تیکه رنگ» is present-direct (number words through ده)", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    expect(assessAbsencePolarity("ماشین شش تیکه رنگ", "رنگ").polarity).toBe("present");
    expect(assessAbsencePolarity("ماشین ده تیکه رنگ", "رنگ").polarity).toBe("present");
  });

  it("P2: «یخچال میخوام قیمت توافقی» is a buyer ad, not an offer", async () => {
    const { assessListingRole } = await import("./semantics");
    expect(assessListingRole("یخچال میخوام قیمت توافقی").role).toBe("buyer-seeking");
    // …but a sell verb keeps it a seller.
    expect(assessListingRole("یخچال میخوام بفروشم قیمت توافقی").role).toBe("product");
    // R7-doublecheck: «نمیخوام» (I don't want) is not a buyer declaration…
    expect(assessListingRole("یخچال نمیخوام قیمت توافقی").role).not.toBe("buyer-seeking");
    // …and the plural counts.
    expect(assessListingRole("یخچال میخوایم قیمت توافقی").role).toBe("buyer-seeking");
  });

  it("R7-doublecheck: «بدون رنگ و صافکاری شده» keeps its counter-evidence", async () => {
    const { assessAbsencePolarity } = await import("./semantics");
    // «صافکاری شده» after و is POSITIVE (done) — the negator must not
    // distribute over it. Was: false absent → exact. Must be: implied → near.
    expect(assessAbsencePolarity("ماشین بدون رنگ و صافکاری شده", "رنگ").polarity).toBe("implied");
    expect(assessAbsencePolarity("ماشین بدون رنگ و نقاشی شده", "رنگ").polarity).toBe("implied");
    // …while the genuinely-negated form still distributes.
    expect(assessAbsencePolarity("ماشین بدون رنگ و صافکاری", "رنگ").polarity).toBe("absent");
  });
});
