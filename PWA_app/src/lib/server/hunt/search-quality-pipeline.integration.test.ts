import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

import type { HuntDefinition } from "./pipeline";
import type { ListingDetail, ListingSummary } from "../divar/provider";

// Mock only the provider boundary + city resolution. Never mock runPipeline
// or its ranking internals. Taxonomy values mirror the real file so outgoing
// provider-query assertions are meaningful on both main and PR #9.
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
    vehicles: "vehicles",
    "real-estate": "real-estate",
    music: "leisure-hobbies",
    mobile: "electronic-devices",
    home: "home-kitchen",
  },
  LEAF_CATEGORY: {
    carLight: "light",
    mobilePhones: "mobile-phones",
    apartmentSell: "apartment-sell",
    apartmentRent: "apartment-rent",
    tvProjector: "tv-projector",
  },
  resolveCityId: vi.fn(async (slug: string) => (slug === "all" ? null : "1")),
}));

import { divarProvider } from "../divar/divarClient";
import { evaluateRanking, SEARCH_QUALITY_BENCHMARK } from "./search-quality-benchmark";
import { runPipeline } from "./pipeline";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

const K = 3;

function toDef(caseId: string): HuntDefinition {
  const c = SEARCH_QUALITY_BENCHMARK.find((x) => x.id === caseId);
  if (!c) throw new Error(`missing case ${caseId}`);
  const txn = c.intent.transaction === "rent" || c.intent.transaction === "buy" ? c.intent.transaction : "";
  const cond = c.intent.condition === "new" || c.intent.condition === "used" ? c.intent.condition : "";
  return {
    query: c.query,
    include: [...c.intent.must],
    exclude: [...c.intent.mustNot],
    should: [...c.intent.should],
    city: c.intent.city ?? "all",
    category: c.intent.category ?? "all",
    priceMin: c.intent.priceMin != null ? String(c.intent.priceMin) : "",
    priceMax: c.intent.priceMax != null ? String(c.intent.priceMax) : "",
    transaction: txn,
    condition: cond,
  };
}

function isIntentionalDupe(caseId: string, candId: string): boolean {
  return caseId === "duplicates-repost" && (candId === "dup-a1" || candId === "dup-a1-repost");
}

async function runCase(caseId: string) {
  const c = SEARCH_QUALITY_BENCHMARK.find((x) => x.id === caseId);
  if (!c) throw new Error(`missing case ${caseId}`);
  const def = toDef(caseId);
  const listings: ListingSummary[] = c.candidates.map((cand) => ({
    sourceAdId: cand.id,
    title: cand.title,
    price: (cand.price ?? null) as number | null,
    city: "تهران",
    // Unique test-only dedup metadata so independent synthetic candidates
    // are never collapsed. Intentional reposts share one key.
    district: isIntentionalDupe(caseId, cand.id) ? "test-dup-canonical" : `test-${cand.id}`,
  }));
  const details = new Map<string, ListingDetail>(
    c.candidates.map((cand) => [
      cand.id,
      {
        sourceAdId: cand.id,
        title: cand.title,
        price: (cand.price ?? null) as number | null,
        city: "تهران",
        district: isIntentionalDupe(caseId, cand.id) ? "test-dup-canonical" : `test-${cand.id}`,
        description: cand.description,
        images: [],
        categorySlug: "",
      },
    ]),
  );
  mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
  mockGetDetail.mockImplementation(async (id: string) => {
    const d = details.get(id);
    if (!d) throw new Error(`unexpected detail ${id}`);
    return d;
  });
  const callIndex = mockSearchLists.mock.calls.length;
  const { results, stats } = await runPipeline(def, () => {});
  const providerQuery = mockSearchLists.mock.calls[callIndex]?.[0] as
    | { categorySlug: string; cityId: string; keywords: string[] }
    | undefined;
  // Canonical-entity labels: the intentional repost must not count twice in
  // the relevance denominator. Production dedup keeps the first (newest).
  const labels: Record<string, number> = {};
  for (const cand of c.candidates) {
    if (caseId === "duplicates-repost" && cand.id === "dup-a1-repost") continue;
    labels[cand.id] = cand.relevance;
  }
  const rankedIds = results.map((r) => r.sourceAdId);
  const metrics = evaluateRanking(rankedIds, labels, K);
  const kinds: Record<string, { matchKind: string; missingInfo: string[] }> = {};
  for (const r of results) kinds[r.sourceAdId] = { matchKind: r.matchKind, missingInfo: [...r.missingInfo] };
  const relevantIds = c.candidates.filter((x) => x.relevance >= 2).map((x) => x.id);
  const canonicalRelevant = relevantIds.filter((id) => labels[id] !== undefined);
  const missingRelevant = canonicalRelevant.filter((id) => !rankedIds.includes(id));
  const irrelevantTop = rankedIds.slice(0, K).filter((id) => (labels[id] ?? 0) === 0);
  return { def, results, stats, rankedIds, labels, metrics, kinds, missingRelevant, irrelevantTop, providerQuery };
}

function kindOf(res: Awaited<ReturnType<typeof runCase>>, id: string): string | undefined {
  return res.kinds[id]?.matchKind;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("search-quality pipeline integration (real runPipeline, mocked provider)", () => {
  it("norm-apartment-alef: exact spelling variant stays exact; suite is not exact", async () => {
    const res = await runCase("norm-apartment-alef");
    expect(kindOf(res, "norm-a1")).toBe("exact");
    expect(kindOf(res, "norm-a2")).not.toBe("exact");
  });

  it("norm-arabic-yeh-plural: adjacent electronics rejected", async () => {
    const res = await runCase("norm-arabic-yeh-plural");
    expect(kindOf(res, "norm-b1")).toBe("exact");
    expect(res.rankedIds).not.toContain("norm-b2");
  });

  it("collision-piano-keyboard: genuine acoustic first; keyboard/design not exact", async () => {
    const res = await runCase("collision-piano-keyboard");
    expect(kindOf(res, "coll-a1")).toBe("exact");
    expect(res.rankedIds[0]).toBe("coll-a1");
    expect(kindOf(res, "coll-a2")).not.toBe("exact");
    expect(kindOf(res, "coll-a-live5")).not.toBe("exact");
    expect(res.kinds["coll-a-live5"]?.missingInfo).toContain("آکوستیک");
  });

  it("collision-fridge-freezer: standalone freezer is near with must-missing", async () => {
    const res = await runCase("collision-fridge-freezer");
    expect(kindOf(res, "coll-b1")).toBe("exact");
    expect(kindOf(res, "coll-b2")).toBe("near");
    expect(res.kinds["coll-b2"]?.missingInfo).toContain("یخچال");
    // Service/buyer live fixtures are measured honestly (present) without
    // claiming the pipeline distinguishes service/direction (it does not).
    expect(res.rankedIds).toContain("coll-b-live5");
    expect(res.rankedIds).toContain("coll-b-live2");
  });

  it("model-iphone-exact: exact model first; wrong variant not exact", async () => {
    const res = await runCase("model-iphone-exact");
    expect(res.rankedIds[0]).toBe("model-a1");
    expect(kindOf(res, "model-a1")).toBe("exact");
    expect(kindOf(res, "model-a3")).not.toBe("exact");
  });

  it("negation-no-first-floor: must-not still hard-rejects", async () => {
    const res = await runCase("negation-no-first-floor");
    expect(kindOf(res, "neg-a1")).toBe("exact");
    expect(res.rankedIds).not.toContain("neg-a2");
    expect(res.rankedIds).toContain("neg-a3");
  });

  it("preference-not-mandatory: should boosts but never filters; wrong entity dies", async () => {
    const res = await runCase("preference-not-mandatory");
    expect(kindOf(res, "pref-a1")).toBe("exact");
    expect(kindOf(res, "pref-a2")).toBe("exact");
    expect(res.rankedIds).not.toContain("pref-a3");
  });

  it("location-city-district: relevant apartments incl. vahed alias stay exact", async () => {
    const res = await runCase("location-city-district");
    expect(kindOf(res, "loc-a1")).toBe("exact");
    expect(kindOf(res, "loc-a-live3")).toBe("exact");
    expect(kindOf(res, "loc-a-live5")).toBe("exact");
    expect(res.providerQuery).toMatchObject({ cityId: "1" });
  });

  it("price-max: structured bounds keep in-range + unknown, drop over-budget", async () => {
    const res = await runCase("price-max");
    expect(res.rankedIds).toEqual(["price-a1", "price-a3"]);
    expect(kindOf(res, "price-a1")).toBe("exact");
    expect(kindOf(res, "price-a3")).toBe("exact");
  });

  it("condition-new: explicit contradiction rejected, unknown stays", async () => {
    const res = await runCase("condition-new");
    expect(kindOf(res, "cond-a1")).toBe("exact");
    expect(res.rankedIds).not.toContain("cond-a2");
    expect(kindOf(res, "cond-a3")).toBe("exact");
  });

  it("transaction-rent: provider receives rent leaf; mocked pool cannot prove geo filtering", async () => {
    const res = await runCase("transaction-rent");
    expect(res.rankedIds).toContain("txn-a1");
    expect(res.providerQuery).toMatchObject({ categorySlug: "apartment-rent" });
  });

  it("unknown-elevator: confirmed exact, unstated near", async () => {
    const res = await runCase("unknown-elevator");
    expect(kindOf(res, "unk-a1")).toBe("exact");
    expect(kindOf(res, "unk-a2")).toBe("near");
    expect(res.rankedIds).toContain("unk-a3");
  });

  it("ambiguity-home: controlled pool yields no false confidence", async () => {
    const res = await runCase("ambiguity-home");
    // must=[خانه] has no textual evidence in apartment/villa fixtures;
    // the pipeline honestly returns nothing rather than guessing.
    expect(res.rankedIds).toEqual([]);
  });

  it("duplicates-repost: real dedup collapses the repost; canonical metrics apply", async () => {
    const res = await runCase("duplicates-repost");
    expect(res.stats.dupsCollapsed).toBe(1);
    expect(res.rankedIds).toContain("dup-a1");
    expect(res.rankedIds).not.toContain("dup-a1-repost");
  });

  it("service-product-fridge: related freezer near with must-missing; wrong appliance out", async () => {
    const res = await runCase("service-product-fridge");
    expect(kindOf(res, "srv-p1")).toBe("exact");
    expect(kindOf(res, "srv-p3")).toBe("near");
    expect(res.kinds["srv-p3"]?.missingInfo).toContain("یخچال");
    expect(res.rankedIds).not.toContain("srv-p4");
    // Unresolved limitation: no service-vs-product distinction, so the
    // service ad is measured as returned rather than asserted absent.
    expect(res.rankedIds).toContain("srv-p2");
  });

  it("direction-buyer-seller-fridge: seller exact; buyer measured, not claimed fixed", async () => {
    const res = await runCase("direction-buyer-seller-fridge");
    expect(kindOf(res, "dir-s1")).toBe("exact");
    expect(res.rankedIds).toContain("dir-b1");
    expect(res.rankedIds).toContain("dir-u1");
  });

  it("exact-related-cooler: split stays related-near, heater out", async () => {
    const res = await runCase("exact-related-cooler");
    expect(kindOf(res, "cool-e1")).toBe("exact");
    expect(kindOf(res, "cool-r1")).toBe("near");
    expect(res.kinds["cool-r1"]?.missingInfo).toContain("کولر");
    expect(res.rankedIds).not.toContain("cool-w1");
  });

  it("negation-digital-piano: digital excluded, design ambiguous-near", async () => {
    const res = await runCase("negation-digital-piano");
    expect(kindOf(res, "negp-e1")).toBe("exact");
    expect(res.rankedIds).not.toContain("negp-h1");
    expect(kindOf(res, "negp-n1")).toBe("near");
  });

  it("emits an actual-engine per-case/per-slice report (not baseline metrics)", async () => {
    const perCase: Record<
      string,
      {
        rankedIds: string[];
        pAt3: number;
        rAt3: number | null;
        ndcgAt3: number;
        missingRelevant: string[];
        irrelevantTop: string[];
        kinds: Record<string, { matchKind: string; missingInfo: string[] }>;
        dupsCollapsed: number;
        providerQuery?: { categorySlug: string; cityId: string; keywords: string[] };
      }
    > = {};
    const perSlice = new Map<string, { p: number[]; r: number[]; n: number[]; cases: number }>();
    for (const c of SEARCH_QUALITY_BENCHMARK) {
      const res = await runCase(c.id);
      perCase[c.id] = {
        rankedIds: res.rankedIds,
        pAt3: Number(res.metrics.precisionAtK.toFixed(4)),
        rAt3: res.metrics.recallAtK === null ? null : Number(res.metrics.recallAtK.toFixed(4)),
        ndcgAt3: Number(res.metrics.ndcgAtK.toFixed(4)),
        missingRelevant: res.missingRelevant,
        irrelevantTop: res.irrelevantTop,
        kinds: res.kinds,
        dupsCollapsed: res.stats.dupsCollapsed,
        providerQuery: res.providerQuery,
      };
      const agg = perSlice.get(c.slice) ?? { p: [], r: [], n: [], cases: 0 };
      agg.p.push(res.metrics.precisionAtK);
      if (res.metrics.recallAtK !== null) agg.r.push(res.metrics.recallAtK);
      agg.n.push(res.metrics.ndcgAtK);
      agg.cases += 1;
      perSlice.set(c.slice, agg);
    }
    const perSliceReport: Record<string, { cases: number; pAt3: number; rAt3: number | null; ndcgAt3: number }> = {};
    for (const [slice, agg] of perSlice) {
      const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
      perSliceReport[slice] = {
        cases: agg.cases,
        pAt3: Number(avg(agg.p).toFixed(4)),
        rAt3: agg.r.length === 0 ? null : Number(avg(agg.r).toFixed(4)),
        ndcgAt3: Number(avg(agg.n).toFixed(4)),
      };
    }
    console.log("PIPELINE_INTEGRATION_REPORT=" + JSON.stringify({ k: K, perSlice: perSliceReport, perCase }));
    const reportPath =
      process.env.PIPELINE_REPORT_PATH ??
      "C:/Users/parsme/AppData/Local/Temp/opencode/pipeline-report.json";
    writeFileSync(reportPath, JSON.stringify({ k: K, perSlice: perSliceReport, perCase }, null, 2), "utf-8");
    expect(Object.keys(perCase).length).toBe(SEARCH_QUALITY_BENCHMARK.length);
  });
});
