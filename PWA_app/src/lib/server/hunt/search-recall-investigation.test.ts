import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

import type { HuntDefinition, HuntEvent } from "./pipeline";
import type { ListingDetail, ListingSummary } from "../divar/provider";

// Real collection/confirmation stages under test; only the provider
// boundary (plus city resolution) is mocked. No live Divar traffic.
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
    music: "leisure-hobbies",
    home: "home-kitchen",
  },
  LEAF_CATEGORY: {
    apartmentSell: "apartment-sell",
    apartmentRent: "apartment-rent",
  },
  resolveCityId: vi.fn(async () => "1"),
}));

import { divarProvider } from "../divar/divarClient";
import { collectCandidates, confirmCandidates } from "./pipeline";
import { evaluateRanking } from "./search-quality-benchmark";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

interface FixtureCandidate {
  id: string;
  title: string;
  description: string;
  price?: number | null;
  relevance: 0 | 1 | 2 | 3;
}

interface RecallCase {
  id: string;
  slice: string;
  def: HuntDefinition;
  candidates: FixtureCandidate[];
}

function def(over: Partial<HuntDefinition> = {}): HuntDefinition {
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

// Human-reviewed fixtures. Labels: 3/2 relevant, 1 near/uncertain,
// 0 irrelevant. Relevance is judged by intent, never by token overlap.
const CASES: RecallCase[] = [
  {
    id: "intent-service-vs-product",
    slice: "intent",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "srv-prod", title: "یخچال ساید سالم", description: "فروش فوری", relevance: 3 },
      { id: "srv-svc", title: "تعمیر یخچال در محل", description: "سرویس فوری", relevance: 0 },
      { id: "srv-rel", title: "فریزر صندوقی", description: "مناسب مغازه", relevance: 1 },
    ],
  },
  {
    id: "intent-buyer-vs-seller",
    slice: "intent",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "dir-sell", title: "فروش یخچال سالم", description: "قیمت مناسب", relevance: 3 },
      { id: "dir-buy", title: "خریدار یخچال سالم خراب سوخته", description: "نقدی", relevance: 0 },
      { id: "dir-unknown", title: "یخچال", description: "تماس بگیرید", relevance: 2 },
    ],
  },
  {
    id: "collision-piano-keyboard",
    slice: "entity-collision",
    def: def({ query: "پیانو", include: ["پیانو"], category: "music" }),
    candidates: [
      { id: "pk-exact", title: "پیانو یاماها", description: "سالم", relevance: 3 },
      { id: "pk-key", title: "کیبورد آموزشی", description: "مناسب شروع", relevance: 0 },
      { id: "pk-sound", title: "کیبورد آموزشی", description: "دارای صدای پیانو", relevance: 1 },
    ],
  },
  {
    id: "collision-fridge-freezer",
    slice: "entity-collision",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "fr-exact", title: "یخچال فریزر سالم", description: "سالم", relevance: 3 },
      { id: "fr-freezer", title: "فریزر صندوقی بدون برفک", description: "مناسب مغازه", relevance: 1 },
    ],
  },
  {
    id: "model-variant-precision",
    slice: "model-identifier",
    def: def({ query: "آیفون ۱۳ پرو", include: ["آیفون", "۱۳", "پرو"], category: "mobile" }),
    candidates: [
      { id: "md-exact", title: "آیفون ۱۳ پرو ۲۵۶ گیگ", description: "سالم", relevance: 3 },
      { id: "md-max", title: "آیفون ۱۳ پرو مکس", description: "۱۲۸ گیگ", relevance: 1 },
      { id: "md-base", title: "آیفون ۱۳ معمولی", description: "۱۲۸ گیگ", relevance: 0 },
    ],
  },
  {
    id: "description-only-district",
    slice: "location-attribute",
    def: def({
      query: "آپارتمان نوساز سعادت آباد",
      include: ["آپارتمان", "نوساز", "سعادت", "آباد"],
      category: "real-estate",
      city: "tehran",
    }),
    candidates: [
      {
        id: "loc-both",
        title: "اپارتمان ۱۰۰ متری نوساز سعادت آباد",
        description: "طبقه سوم",
        relevance: 3,
      },
      {
        id: "loc-desc",
        title: "اپارتمان ۱۰۰ متری نوساز",
        description: "آپارتمان نوساز در سعادت آباد، طبقه سوم",
        relevance: 3,
      },
      { id: "loc-other", title: "اپارتمان نوساز در کرج", description: "طبقه دوم", relevance: 0 },
    ],
  },
  {
    id: "spelling-variants",
    slice: "normalization",
    def: def({ query: "آپارتمان ۹۰ متری", include: ["آپارتمان"], category: "real-estate" }),
    candidates: [
      { id: "sp-alef", title: "اپارتمان ۹۰ متری نوساز", description: "واحد مسکونی", relevance: 3 },
      { id: "sp-suite", title: "سوئیت ۹۰ متری", description: "مناسب اقامت کوتاه", relevance: 1 },
      { id: "sp-shop", title: "مغازه ۹۰ متری", description: "بر خیابان", relevance: 0 },
    ],
  },
  {
    id: "negation-digital",
    slice: "negation",
    def: def({
      query: "پیانو آکوستیک نه دیجیتال",
      include: ["پیانو", "آکوستیک"],
      exclude: ["دیجیتال"],
      category: "music",
    }),
    candidates: [
      { id: "neg-exact", title: "پیانو آکوستیک یاماها", description: "مدل دیواری", relevance: 3 },
      { id: "neg-digi", title: "پیانو دیجیتال آکوستیک", description: "صدای آکوستیک", relevance: 0 },
      { id: "neg-design", title: "پیانو طرح آکوستیک", description: "رنگ سفارشی", relevance: 1 },
    ],
  },
  {
    id: "ambiguity-home",
    slice: "ambiguity",
    def: def({ query: "خونه نقلی", include: ["خانه"], should: ["نقلی"], city: "tehran" }),
    candidates: [
      { id: "amb-a1", title: "آپارتمان ۶۰ متری تهران", description: "فروش", relevance: 2 },
      { id: "amb-a3", title: "ویلا در شمال", description: "قیمت مناسب", relevance: 0 },
    ],
  },
  {
    id: "unknown-elevator",
    slice: "unknown",
    def: def({ query: "آپارتمان آسانسوردار", include: ["آپارتمان", "آسانسور"], category: "real-estate" }),
    candidates: [
      { id: "unk-yes", title: "آپارتمان", description: "آسانسور دارد", relevance: 3 },
      { id: "unk-silent", title: "آپارتمان ۸۰ متری", description: "پارکینگ دارد", relevance: 1 },
      { id: "unk-no", title: "آپارتمان", description: "بدون آسانسور", relevance: 0 },
    ],
  },
  {
    id: "duplicates-repost",
    slice: "duplicates",
    def: def({ query: "موبایل آیفون ۱۳", include: ["موبایل", "آیفون", "۱۳"], category: "mobile" }),
    candidates: [
      { id: "dup-a1", title: "آیفون ۱۳ تمیز", description: "۲۵۶ گیگ", relevance: 3 },
      // Same title/price/city/district, different id: one underlying listing.
      { id: "dup-a1-repost", title: "آیفون ۱۳ تمیز", description: "۲۵۶ گیگ", relevance: 3, price: null },
      { id: "dup-a2", title: "آیفون ۱۳ پرو", description: "۱۲۸ گیگ", relevance: 1 },
    ],
  },
  {
    id: "zero-result",
    slice: "zero-result",
    def: def({ query: "زرافه برقی ناموجود", include: ["زرافه", "برقی", "ناموجود"] }),
    candidates: [
      { id: "z-pigeon", title: "کفتر مسابقه‌ای اصیل", description: "کفتر مسابقه‌ای", relevance: 0 },
    ],
  },
  {
    id: "top100-budget-ceiling",
    slice: "budget",
    def: def({ query: "گوشی", include: ["گوشی"], category: "mobile" }),
    candidates: Array.from({ length: 105 }, (_, k) => ({
      id: `b${k}`,
      title: "گوشی سالم",
      description: "گوشی",
      relevance: 3 as const,
    })),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

interface StageReport {
  caseId: string;
  rankedIds: string[];
  kinds: Record<string, string>;
  missingRelevant: string[];
  irrelevantTop: string[];
  pAt5: number;
  rAt10: number | null;
  ndcgAt10: number;
  providerKeywords: string[];
  dupsCollapsed: number;
  detailsChecked: number;
}

async function runRecallCase(c: RecallCase): Promise<StageReport> {
  const listings: ListingSummary[] = c.candidates.map((cand, k) => ({
    sourceAdId: cand.id,
    title: cand.title,
    price: cand.price ?? null,
    city: "تهران",
    // Unique test-only dedup metadata — except the intentional repost pair.
    district: c.id === "duplicates-repost" && cand.id.startsWith("dup-a1") ? "test-dup" : `test-${c.id}-${k}`,
  }));
  const details = new Map<string, ListingDetail>(
    c.candidates.map((cand, k) => [
      cand.id,
      {
        sourceAdId: cand.id,
        title: cand.title,
        price: cand.price ?? null,
        city: "تهران",
        district: c.id === "duplicates-repost" && cand.id.startsWith("dup-a1") ? "test-dup" : `test-${c.id}-${k}`,
        description: cand.description,
        images: [],
        categorySlug: "",
      },
    ])
  );
  mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
  mockGetDetail.mockImplementation(async (id: string) => {
    const d = details.get(id);
    if (!d) throw new Error(`unexpected detail ${id}`);
    return d;
  });
  const events: HuntEvent[] = [];
  const { candidates, stats } = await collectCandidates(c.def, { emit: (e) => events.push(e) });
  const results = await confirmCandidates(candidates, c.def, stats, (e) => events.push(e));
  const labels: Record<string, number> = {};
  for (const cand of c.candidates) {
    // Intentional repost: one underlying listing, counted once.
    if (c.id === "duplicates-repost" && cand.id === "dup-a1-repost") continue;
    labels[cand.id] = cand.relevance;
  }
  const rankedIds = results.map((r) => r.sourceAdId);
  const metrics = evaluateRanking(rankedIds, labels, 5);
  const metrics10 = evaluateRanking(rankedIds, labels, 10);
  const kinds: Record<string, string> = {};
  for (const r of results) kinds[r.sourceAdId] = r.matchKind;
  const relevantIds = Object.entries(labels)
    .filter(([, g]) => g >= 2)
    .map(([id]) => id);
  return {
    caseId: c.id,
    rankedIds,
    kinds,
    missingRelevant: relevantIds.filter((id) => !rankedIds.includes(id)),
    irrelevantTop: rankedIds.slice(0, 5).filter((id) => (labels[id] ?? 0) === 0),
    pAt5: Number(metrics.precisionAtK.toFixed(4)),
    rAt10: metrics10.recallAtK === null ? null : Number(metrics10.recallAtK.toFixed(4)),
    ndcgAt10: Number(metrics10.ndcgAtK.toFixed(4)),
    providerKeywords: (mockSearchLists.mock.calls[0]?.[0] as { keywords?: string[] } | undefined)?.keywords ?? [],
    dupsCollapsed: stats.dupsCollapsed,
    detailsChecked: stats.detailsChecked,
  };
}

describe("search recall investigation (actual pipeline stages)", () => {
  it("service and buyer wording match textually today (known limitation, not a pass)", async () => {
    const svc = await runRecallCase(CASES.find((c) => c.id === "intent-service-vs-product")!);
    expect(svc.kinds["srv-prod"]).toBe("exact");
    // Textual overlap makes the service ad an exact match: the pipeline
    // has no product/service intent signal. Locked as observed behavior.
    expect(svc.kinds["srv-svc"]).toBe("exact");
    const buy = await runRecallCase(CASES.find((c) => c.id === "intent-buyer-vs-seller")!);
    expect(buy.kinds["dir-sell"]).toBe("exact");
    expect(buy.kinds["dir-buy"]).toBe("exact");
  });

  it("keeps description-only district evidence (recall at title, precision at detail)", async () => {
    const res = await runRecallCase(CASES.find((c) => c.id === "description-only-district")!);
    expect(res.rankedIds).toContain("loc-desc");
    expect(res.kinds["loc-desc"]).toBe("exact");
    expect(res.missingRelevant).toEqual([]);
  });

  it("matches spelling variants while keeping related types distinct-ish", async () => {
    const res = await runRecallCase(CASES.find((c) => c.id === "spelling-variants")!);
    expect(res.kinds["sp-alef"]).toBe("exact");
    expect(res.rankedIds).not.toContain("sp-shop");
  });

  it("model variants are token-blind today (documented, not fixed)", async () => {
    const res = await runRecallCase(CASES.find((c) => c.id === "model-variant-precision")!);
    expect(res.kinds["md-exact"]).toBe("exact");
    // پرو مکس contains every MUST token: exact by overlap, relevance 1.
    expect(res.kinds["md-max"]).toBe("exact");
    expect(res.kinds["md-base"]).toBe("near");
  });

  it("honors negation, ambiguity emptiness, unknown semantics, and dupes", async () => {
    const neg = await runRecallCase(CASES.find((c) => c.id === "negation-digital")!);
    expect(neg.rankedIds).not.toContain("neg-digi");
    expect(neg.rankedIds).toContain("neg-exact");
    const amb = await runRecallCase(CASES.find((c) => c.id === "ambiguity-home")!);
    expect(amb.rankedIds).toEqual([]);
    const unk = await runRecallCase(CASES.find((c) => c.id === "unknown-elevator")!);
    expect(unk.kinds["unk-yes"]).toBe("exact");
    expect(unk.kinds["unk-silent"]).toBe("near");
    const dup = await runRecallCase(CASES.find((c) => c.id === "duplicates-repost")!);
    expect(dup.dupsCollapsed).toBe(1);
    expect(dup.rankedIds).toContain("dup-a1");
    expect(dup.rankedIds).not.toContain("dup-a1-repost");
    const zero = await runRecallCase(CASES.find((c) => c.id === "zero-result")!);
    expect(zero.rankedIds).toEqual([]);
  });

  it("top-100 budget displaces the tail (recall ceiling, documented)", async () => {
    const res = await runRecallCase(CASES.find((c) => c.id === "top100-budget-ceiling")!);
    expect(res.rankedIds).toHaveLength(100);
    expect(res.missingRelevant).toHaveLength(5);
  });

  it("emits a per-case/per-slice actual-pipeline report", async () => {
    const perCase: Record<string, Omit<StageReport, "caseId">> = {};
    const perSlice = new Map<string, { p: number[]; r: number[]; n: number[]; cases: number }>();
    for (const c of CASES) {
      const { caseId: _dropped, ...rest } = await runRecallCase(c);
      perCase[c.id] = rest;
      const agg = perSlice.get(c.slice) ?? { p: [], r: [], n: [], cases: 0 };
      const m5 = evaluateRanking(rest.rankedIds, Object.fromEntries(c.candidates.filter((x) => !(c.id === "duplicates-repost" && x.id === "dup-a1-repost")).map((x) => [x.id, x.relevance])), 5);
      const m10 = evaluateRanking(rest.rankedIds, Object.fromEntries(c.candidates.filter((x) => !(c.id === "duplicates-repost" && x.id === "dup-a1-repost")).map((x) => [x.id, x.relevance])), 10);
      agg.p.push(m5.precisionAtK);
      if (m10.recallAtK !== null) agg.r.push(m10.recallAtK);
      agg.n.push(m10.ndcgAtK);
      agg.cases += 1;
      perSlice.set(c.slice, agg);
    }
    const report: Record<string, { cases: number; pAt5: number; rAt10: number | null; ndcgAt10: number }> = {};
    for (const [slice, agg] of perSlice) {
      const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
      report[slice] = {
        cases: agg.cases,
        pAt5: Number(avg(agg.p).toFixed(4)),
        rAt10: agg.r.length === 0 ? null : Number(avg(agg.r).toFixed(4)),
        ndcgAt10: Number(avg(agg.n).toFixed(4)),
      };
    }
    console.log("RECALL_INVESTIGATION_REPORT=" + JSON.stringify({ k: "P@5/R@10/nDCG@10", perSlice: report, perCase }));
    writeFileSync(
      process.env.RECALL_REPORT_PATH ?? "C:/Users/parsme/AppData/Local/Temp/opencode/recall-report.json",
      JSON.stringify({ k: "P@5/R@10/nDCG@10", perSlice: report, perCase }, null, 2),
      "utf-8"
    );
    expect(Object.keys(perCase).length).toBe(CASES.length);
  });
});
