import { beforeEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

import type { HuntDefinition, HuntEvent } from "./pipeline";
import type { ListingDetail, ListingSummary } from "../divar/provider";

// Real collection/confirmation stages under test; only the provider
// boundary (plus city resolution) is mocked. No live Divar traffic: every
// candidate below is a synthetic fixture, never a live observation. Live,
// human-reviewed Divar labels stay in `search-quality-benchmark.ts`.
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
import { buildLabelPool, evaluateRankingActual } from "./recall-metrics";
import { evaluateRanking } from "./search-quality-benchmark";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

interface FixtureCandidate {
  id: string;
  title: string;
  description: string;
  relevance: 0 | 1 | 2 | 3;
  /** Intentional repost of another candidate id (shares its dupKey). */
  repostOf?: string;
  note: string;
}

interface RecallCase {
  id: string;
  slice: string;
  def: HuntDefinition;
  candidates: FixtureCandidate[];
  /** Ids whose detail fetch fails (unverified-detail behavior). */
  detailFails?: readonly string[];
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

// Grades: 3/2 relevant, 1 near/related, 0 irrelevant — judged by intent,
// never by token overlap. Debatable grades carry an explicit rationale.
const CASES: RecallCase[] = [
  {
    // Fixture 1: product query vs service listing.
    id: "product-vs-service",
    slice: "role",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "prod", title: "یخچال ساید سالم", description: "فروش فوری", relevance: 3, note: "Exact product for sale." },
      // Same object domain, wrong listing role: related (1), never exact.
      { id: "svc", title: "تعمیر یخچال", description: "تعمیر در محل، سرویس فوری", relevance: 1, note: "Service offer, not a product listing." },
    ],
  },
  {
    // Fixture 2: product query vs buyer-seeking listing.
    id: "product-vs-buyer",
    slice: "role",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "sell", title: "فروش یخچال سالم", description: "قیمت مناسب", relevance: 3, note: "Exact product for sale." },
      { id: "buy", title: "خریدار یخچال", description: "خریدار یخچال نقدی", relevance: 1, note: "Wanted-to-buy, not a product listing." },
    ],
  },
  {
    // Fixture 3: explicit service-intent query vs service listing.
    id: "service-query-vs-service",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "svc-ok", title: "تعمیر یخچال", description: "تعمیر در محل", relevance: 3, note: "Service offer matching service intent." },
      // Right object, no service evidence («تعمیر» missing → near via MUST).
      { id: "prod-only", title: "یخچال ساید سالم", description: "فروش فوری", relevance: 1, note: "Product when a service was asked for." },
    ],
  },
  {
    // Fixture 4: explicit buyer-intent query vs buyer-seeking listing.
    id: "buyer-query-vs-buyer",
    slice: "role",
    def: def({ query: "خریدار یخچال", include: ["خریدار", "یخچال"], category: "home" }),
    candidates: [
      { id: "buy-ok", title: "خریدار یخچال", description: "خریدار یخچال سوخته", relevance: 3, note: "Wanted-to-buy matching buyer intent." },
      { id: "prod-only", title: "یخچال سالم", description: "فروش فوری", relevance: 1, note: "Object matches, direction unknown." },
    ],
  },
  {
    // Fixture 5: genuine product listing still retrieved.
    id: "genuine-product",
    slice: "role",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "prod", title: "یخچال ساید سالم", description: "فروش فوری", relevance: 3, note: "Control: role logic must not hide it." },
      { id: "other", title: "ماشین لباسشویی", description: "کم‌کارکرد", relevance: 0, note: "Wrong entity, rejected." },
    ],
  },
  {
    // Fixture 6: specific model query vs sibling variant.
    id: "model-vs-sibling",
    slice: "model",
    def: def({ query: "آیفون ۱۳ پرو", include: ["آیفون", "۱۳", "پرو"], category: "mobile" }),
    candidates: [
      { id: "md-exact", title: "آیفون ۱۳ پرو ۲۵۶ گیگ", description: "سالم", relevance: 3, note: "Exact model." },
      // Every query token occurs, yet «مکس» adds unrequested specificity.
      { id: "md-max", title: "آیفون ۱۳ پرو مکس", description: "۱۲۸ گیگ", relevance: 1, note: "Distinct sibling SKU, not exact." },
      { id: "md-base", title: "آیفون ۱۳ معمولی", description: "۱۲۸ گیگ", relevance: 0, note: "Wrong variant." },
    ],
  },
  {
    // Fixture 7: broad model-family query vs more specific variant.
    // Rationale: a broader query is satisfied by a specific family member
    // (family-compatible), so it stays eligible AND exact-capable. The
    // asymmetry is one-directional: extra specificity only caps when the
    // query itself was already specific (fixture 6).
    id: "family-vs-specific",
    slice: "model",
    def: def({ query: "آیفون ۱۳", include: ["آیفون", "۱۳"], category: "mobile" }),
    candidates: [
      { id: "fam", title: "آیفون ۱۳ پرو", description: "۱۲۸ گیگ سالم", relevance: 2, note: "Family member of a broad query." },
      { id: "other", title: "ماشین لباسشویی", description: "کم‌کارکرد", relevance: 0, note: "Wrong entity, rejected." },
    ],
  },
  {
    // Fixture 8: no-repair request vs explicitly unrepaired listing.
    // Regression: the old global «تعمیر» ban rejected this title outright.
    id: "repair-absent-match",
    slice: "polarity",
    def: def({ query: "آیفون ۱۳، بدون تعمیر", include: ["آیفون", "۱۳"], exclude: ["تعمیر"], category: "mobile" }),
    candidates: [
      { id: "no-repair", title: "آیفون ۱۳ بدون تعمیر", description: "سالم و تمیز", relevance: 3, note: "Explicitly satisfies the absence request." },
    ],
  },
  {
    // Fixture 9: no-repair request vs explicitly repaired listing.
    id: "repair-present-contradiction",
    slice: "polarity",
    def: def({ query: "آیفون ۱۳، بدون تعمیر", include: ["آیفون", "۱۳"], exclude: ["تعمیر"], category: "mobile" }),
    candidates: [
      { id: "repaired", title: "آیفون ۱۳", description: "تعمیر شده، سالم", relevance: 0, note: "Explicit contradiction, rejected." },
    ],
  },
  {
    // Fixture 10: no-repair request vs unknown repair history.
    // Phase 1.1 correction: NOT-unknown must NOT satisfy a hard
    // negative-attribute requirement. The candidate stays eligible
    // (recall preserved) but is capped at near — never exact.
    id: "repair-unknown-preserved",
    slice: "polarity",
    def: def({ query: "آیفون ۱۳، بدون تعمیر", include: ["آیفون", "۱۳"], exclude: ["تعمیر"], category: "mobile" }),
    candidates: [
      { id: "silent", title: "آیفون ۱۳", description: "سالم، کارکرد کم", relevance: 2, note: "Relevant product; history unverified, capped at near." },
    ],
  },
  {
    // Fixture 10b: repair vocabulary in an unrelated context.
    // A bare/ambiguous mention («سابقه تعمیر مشخص نیست») establishes
    // neither repair history nor a rejection: eligible, capped at near.
    id: "repair-unrelated-mention",
    slice: "polarity",
    def: def({ query: "آیفون ۱۳، بدون تعمیر", include: ["آیفون", "۱۳"], exclude: ["تعمیر"], category: "mobile" }),
    candidates: [
      { id: "ambiguous", title: "آیفون ۱۳", description: "سالم و تمیز، سابقه تعمیر مشخص نیست", relevance: 2, note: "Mention without polarity evidence; preserved as near." },
    ],
  },
  {
    // Fixture 11a: exact alias inside its valid category.
    id: "alias-valid-category",
    slice: "alias",
    def: def({ query: "آپارتمان نوساز", include: ["آپارتمان"], category: "real-estate" }),
    candidates: [
      { id: "unit", title: "واحد ۸۰ متری نوساز", description: "سند آماده", relevance: 3, note: "واحد is an exact alias in real-estate." },
    ],
  },
  {
    // Fixture 11b: the same alias text without category context.
    // Rationale: expansion is category-gated, so the pipeline cannot know
    // «واحد» means apartment here. The recall cost is explicit (recall 0),
    // not a silent behavior change elsewhere.
    id: "alias-needs-category",
    slice: "alias",
    def: def({ query: "آپارتمان نوساز", include: ["آپارتمان"], category: "all" }),
    candidates: [
      { id: "unit", title: "واحد ۸۰ متری نوساز", description: "سند آماده", relevance: 3, note: "Relevant but unprovable without category." },
    ],
  },
  {
    // Fixture 12: related concepts remain non-exact.
    id: "related-stays-near",
    slice: "related",
    def: def({ query: "آپارتمان", include: ["آپارتمان"], category: "real-estate" }),
    candidates: [
      { id: "suite", title: "سوئیت ۹۰ متری", description: "مناسب اقامت کوتاه", relevance: 1, note: "Related property type, not an exact synonym." },
    ],
  },
  {
    // Fixture 13: unverified detail candidates are kept but never exact.
    id: "unverified-detail",
    slice: "verification",
    def: def({ query: "برنج هندی", include: ["برنج", "هندی"], category: "all" }),
    candidates: [
      { id: "d1", title: "برنج هندی اعلا", description: "unreadable", relevance: 3, note: "Relevant; verification pending." },
    ],
    detailFails: ["d1"],
  },
  {
    // Fixture 14: offered service vs item needing repair (Phase 1.3).
    // need-daewoo is a minimally redacted Phase 1.2 live record (no contact
    // data present): a refrigerator FOR SALE that needs repair — exact for a
    // service query would be a false-exact. need-motor is the same live
    // record with the tail truncated (personal context removed; the
    // distinguishing «باید تعمیر شود» clause is verbatim). offer-ok is the
    // control: a genuine offer stays exact-eligible.
    id: "service-vs-needs-repair",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "need-daewoo", title: "یخچال فریزر دوو", description: "یخچال فریزر دوو-نیاز به تعمیر دارد'سرمایش کم هست", relevance: 1, note: "Live record: item needs repair, not a service offer." },
      { id: "need-motor", title: "یخچال قیمت مناسب", description: "یخچال تمیز است فقط موتورش باید تعمیر شود", relevance: 1, note: "Live distinguishing clause; tail removed (substitution documented)." },
      { id: "offer-ok", title: "تعمیر یخچال در محل", description: "تعمیر یخچال در محل، سرویس فوری", relevance: 3, note: "Genuine service offer matching service intent." },
      { id: "buy-broken", title: "خریدار یخچال سوخته", description: "خریدار یخچال سوخته و خراب نیاز به تعمیر", relevance: 1, note: "Buyer collecting broken units: wanted-to-buy, not a repair service." },
    ],
  },
  {
    // Fixture 15: the same needs-repair record under a broad product query
    // must remain an eligible product result — service logic must not leak
    // into product searches.
    id: "product-keeps-needs-repair",
    slice: "role",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "need-daewoo", title: "یخچال فریزر دوو", description: "یخچال فریزر دوو-نیاز به تعمیر دارد'سرمایش کم هست", relevance: 2, note: "Same record as fixture 14; relevant product for a product query." },
    ],
  },
  {
    // Fixture 16: ambiguous repair language under a service query.
    // No offer evidence and no needs evidence: preserve uncertainty, never
    // assert an exact service match.
    id: "service-ambiguous-preserved",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "amb", title: "یخچال ال جی", description: "یخچال سالم، گارانتی تعمیر دارد", relevance: 1, note: "Unclear role; preserved, never exact." },
    ],
  },
  {
    // Fixture 17: a service ad mentioning a broken customer item must not
    // be misclassified as a product needing repair.
    id: "service-ad-broken-item",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "svc-broken", title: "تعمیر یخچال در محل", description: "تعمیر یخچال سوخته و خراب شما در محل", relevance: 3, note: "Offer context wins over damage words." },
    ],
  },
  {
    // Fixture 18: service offered for the WRONG appliance (Phase 1.4).
    // wm-incidental is SYNTHETIC (the original live full text was not
    // retained — only an 80-char excerpt survives, so no faithful replay of
    // that record is claimed): a washing-machine repair offer with an
    // incidental far-away refrigerator mention. fridge-offer is the
    // same-shape control that must stay exact-eligible.
    id: "service-wrong-target",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "wm-incidental", title: "تعمیر لباسشویی در محل", description: "تعمیر لباسشویی در محل با ضمانت یکساله، یخچال فریزر هم موجود است", relevance: 1, note: "SYNTHETIC: service targets washer; fridge is incidental and far." },
      { id: "fridge-offer", title: "تعمیر یخچال در محل", description: "تعمیر یخچال در محل، سرویس فوری", relevance: 3, note: "Offer explicitly targets the requested appliance." },
    ],
  },
  {
    // Fixture 19: explicitly offering BOTH appliances stays exact-eligible —
    // a multi-service listing must not be demoted for naming two targets.
    id: "service-both-targets",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "both", title: "تعمیر یخچال و لباسشویی در محل", description: "تعمیر یخچال و لباسشویی در محل", relevance: 3, note: "Both targets adjacent to the offer cue." },
    ],
  },
  {
    // Fixture 20: ambiguous multi-appliance mention (SYNTHETIC pattern).
    // The offer cue and the requested target sit in different clauses, so
    // nothing establishes WHICH appliance is serviced: near, never exact.
    id: "service-ambiguous-target",
    slice: "role",
    def: def({ query: "تعمیر یخچال", include: ["تعمیر", "یخچال"], category: "home" }),
    candidates: [
      { id: "amb-multi", title: "تعمیرات تخصصی لوازم خانگی", description: "تعمیرات تخصصی لوازم خانگی در سراسر تهران با ضمانت، یخچال و لباسشویی پذیرفته میشود", relevance: 1, note: "SYNTHETIC: cue and target in different clauses." },
    ],
  },
  {
    // Fixture 21: washer repair query finds the washer offer (row 5).
    id: "service-washer-query",
    slice: "role",
    def: def({ query: "تعمیر لباسشویی", include: ["تعمیر", "لباسشویی"], category: "home" }),
    candidates: [
      { id: "wm-offer", title: "تعمیر لباسشویی در محل", description: "تعمیر لباسشویی در محل با ضمانت", relevance: 3, note: "Requested appliance explicitly serviced." },
    ],
  },
  {
    // Fixture 22: product query vs service ad mentioning the product.
    // Role clash already keeps this near (existing contract, locked here).
    id: "product-vs-service-mention",
    slice: "role",
    def: def({ query: "یخچال", include: ["یخچال"], category: "home" }),
    candidates: [
      { id: "svc-mention", title: "تعمیر لباسشویی در محل", description: "تعمیر لباسشویی در محل، یخچال هم پذیرفته میشود", relevance: 1, note: "Service ad, not a product-for-sale listing." },
    ],
  },
  {
    // Zero-result control: empty output must have defined (null) precision.
    id: "zero-result",
    slice: "zero-result",
    def: def({ query: "زرافه برقی ناموجود", include: ["زرافه", "برقی", "ناموجود"] }),
    candidates: [
      { id: "pigeon", title: "کفتر مسابقه‌ای اصیل", description: "کفتر مسابقه‌ای", relevance: 0, note: "Zero MUST evidence, rejected." },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

interface StageReport {
  caseId: string;
  rankedIds: string[];
  kinds: Record<string, string>;
  detailUnknown: string[];
  missingRelevant: string[];
  irrelevantTop: string[];
  pAt5: number | null;
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
    price: null,
    city: "تهران",
    // Unique test-only dedup metadata — except intentional repost pairs,
    // which share every dupKey field like real reposts.
    district:
      cand.repostOf !== undefined
        ? `test-${c.id}-dup`
        : `test-${c.id}-${k}`,
  }));
  const fails = new Set(c.detailFails ?? []);
  mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
  mockGetDetail.mockImplementation(async (id: string) => {
    if (fails.has(id)) throw new Error(`detail unavailable ${id}`);
    const cand = c.candidates.find((x) => x.id === id);
    if (!cand) throw new Error(`unexpected detail ${id}`);
    const listing = listings.find((x) => x.sourceAdId === id);
    return {
      sourceAdId: id,
      title: cand.title,
      price: null,
      city: "تهران",
      district: listing?.district,
      description: cand.description,
      images: [],
      categorySlug: "",
    } satisfies ListingDetail;
  });
  const events: HuntEvent[] = [];
  const { candidates, stats } = await collectCandidates(c.def, {
    emit: (e) => events.push(e),
  });
  const results = await confirmCandidates(candidates, c.def, stats, (e) =>
    events.push(e)
  );
  // Dedupe policy aligned with the pipeline: an intentional repost shares
  // the underlying listing, so the pool counts it ONCE.
  const { labels } = buildLabelPool(c.candidates);
  const rankedIds = results.map((r) => r.sourceAdId);
  const m5 = evaluateRankingActual(rankedIds, labels, 5);
  const m10 = evaluateRankingActual(rankedIds, labels, 10);
  const kinds: Record<string, string> = {};
  const detailUnknown: string[] = [];
  for (const r of results) {
    kinds[r.sourceAdId] = r.matchKind;
    if (r.detailUnknown === true) detailUnknown.push(r.sourceAdId);
  }
  const relevantIds = Object.entries(labels)
    .filter(([, g]) => g >= 2)
    .map(([id]) => id);
  return {
    caseId: c.id,
    rankedIds,
    kinds,
    detailUnknown,
    missingRelevant: relevantIds.filter((id) => !rankedIds.includes(id)),
    irrelevantTop: rankedIds.slice(0, 5).filter((id) => (labels[id] ?? 0) === 0),
    pAt5: m5.precisionAtK,
    rAt10: m10.recallAtK,
    ndcgAt10: m10.ndcgAtK,
    providerKeywords:
      (mockSearchLists.mock.calls[0]?.[0] as { keywords?: string[] } | undefined)
        ?.keywords ?? [],
    dupsCollapsed: stats.dupsCollapsed,
    detailsChecked: stats.detailsChecked,
  };
}

function get(id: string): RecallCase {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case ${id}`);
  return c;
}

describe("search recall semantics (actual pipeline stages, mocked provider)", () => {
  it("keeps service and buyer-seeking listings eligible but never exact", async () => {
    const svc = await runRecallCase(get("product-vs-service"));
    expect(svc.kinds["prod"]).toBe("exact");
    expect(svc.kinds["svc"]).toBe("near");
    expect(svc.rankedIds).toContain("svc");
    expect(svc.providerKeywords).toEqual(["یخچال"]);

    const buy = await runRecallCase(get("product-vs-buyer"));
    expect(buy.kinds["sell"]).toBe("exact");
    expect(buy.kinds["buy"]).toBe("near");
    expect(buy.rankedIds).toContain("buy");
  });

  it("honors explicit service and buyer intent with exact matches", async () => {
    const svc = await runRecallCase(get("service-query-vs-service"));
    expect(svc.kinds["svc-ok"]).toBe("exact");
    expect(svc.rankedIds).toContain("prod-only");

    const buy = await runRecallCase(get("buyer-query-vs-buyer"));
    expect(buy.kinds["buy-ok"]).toBe("exact");
    expect(buy.rankedIds).toContain("prod-only");

    const genuine = await runRecallCase(get("genuine-product"));
    expect(genuine.kinds["prod"]).toBe("exact");
    expect(genuine.rankedIds).not.toContain("other");
  });

  it("distinguishes offered service from items needing repair (Phase 1.3)", async () => {
    const res = await runRecallCase(get("service-vs-needs-repair"));
    // Live-observed false-exacts: eligible, but never exact for the
    // service intent.
    expect(res.kinds["need-daewoo"]).toBe("near");
    expect(res.kinds["need-motor"]).toBe("near");
    expect(res.rankedIds).toContain("need-daewoo");
    expect(res.rankedIds).toContain("need-motor");
    // Genuine offer control.
    expect(res.kinds["offer-ok"]).toBe("exact");
    // Buyer collecting broken units: wanted-to-buy, never an exact
    // repair-service match, but stays eligible.
    expect(res.kinds["buy-broken"]).toBe("near");
    expect(res.rankedIds).toContain("buy-broken");

    // Same record under a product query stays an eligible product result.
    const prod = await runRecallCase(get("product-keeps-needs-repair"));
    expect(prod.kinds["need-daewoo"]).toBe("exact");

    // Ambiguous role: preserved, never an exact service match.
    const amb = await runRecallCase(get("service-ambiguous-preserved"));
    expect(amb.rankedIds).toContain("amb");
    expect(amb.kinds["amb"]).toBe("near");

    // Service ad mentioning a broken item: still the offer, still exact.
    const svc = await runRecallCase(get("service-ad-broken-item"));
    expect(svc.kinds["svc-broken"]).toBe("exact");
  });

  it("binds service offers to the requested target (Phase 1.4)", async () => {
    const wrong = await runRecallCase(get("service-wrong-target"));
    expect(wrong.kinds["wm-incidental"]).toBe("near");
    expect(wrong.rankedIds).toContain("wm-incidental");
    expect(wrong.kinds["fridge-offer"]).toBe("exact");

    const both = await runRecallCase(get("service-both-targets"));
    expect(both.kinds["both"]).toBe("exact");

    const amb = await runRecallCase(get("service-ambiguous-target"));
    expect(amb.kinds["amb-multi"]).toBe("near");
    expect(amb.rankedIds).toContain("amb-multi");

    const wq = await runRecallCase(get("service-washer-query"));
    expect(wq.kinds["wm-offer"]).toBe("exact");

    const pm = await runRecallCase(get("product-vs-service-mention"));
    expect(pm.kinds["svc-mention"]).toBe("near");
    expect(pm.rankedIds).toContain("svc-mention");
  });

  it("caps sibling variants at near while family matches stay eligible", async () => {
    const res = await runRecallCase(get("model-vs-sibling"));
    expect(res.kinds["md-exact"]).toBe("exact");
    expect(res.kinds["md-max"]).toBe("near");
    expect(res.rankedIds).toContain("md-max");

    const fam = await runRecallCase(get("family-vs-specific"));
    expect(fam.rankedIds).toContain("fam");
    expect(fam.kinds["fam"]).toBe("exact");
    expect(fam.rankedIds).not.toContain("other");
  });

  it("treats repair polarity as absent/present/unknown, never as a word ban", async () => {
    const match = await runRecallCase(get("repair-absent-match"));
    expect(match.rankedIds).toContain("no-repair");
    expect(match.kinds["no-repair"]).toBe("exact");

    const contra = await runRecallCase(get("repair-present-contradiction"));
    expect(contra.rankedIds).not.toContain("repaired");

    // Unknown history: eligible but never exact (Phase 1.1 correction).
    const unknown = await runRecallCase(get("repair-unknown-preserved"));
    expect(unknown.rankedIds).toContain("silent");
    expect(unknown.kinds["silent"]).toBe("near");

    // Bare/ambiguous mention: no rejection, no exact either.
    const ambiguous = await runRecallCase(get("repair-unrelated-mention"));
    expect(ambiguous.rankedIds).toContain("ambiguous");
    expect(ambiguous.kinds["ambiguous"]).toBe("near");
  });

  it("keeps aliases exact in-category, gated without it, and related near", async () => {
    const valid = await runRecallCase(get("alias-valid-category"));
    expect(valid.kinds["unit"]).toBe("exact");

    const gated = await runRecallCase(get("alias-needs-category"));
    expect(gated.rankedIds).not.toContain("unit");
    expect(gated.rAt10).toBe(0);

    const related = await runRecallCase(get("related-stays-near"));
    expect(related.rankedIds).toContain("suite");
    expect(related.kinds["suite"]).toBe("near");
  });

  it("keeps unverified details but never marks them exact", async () => {
    const res = await runRecallCase(get("unverified-detail"));
    expect(res.rankedIds).toContain("d1");
    expect(res.kinds["d1"]).toBe("near");
    expect(res.detailUnknown).toContain("d1");
  });

  it("defines empty results explicitly instead of scoring 0/0", async () => {
    const res = await runRecallCase(get("zero-result"));
    expect(res.rankedIds).toEqual([]);
    expect(res.pAt5).toBeNull();
  });

  it("emits a per-case/per-slice actual-pipeline report to a portable path", async () => {
    const perCase: Record<string, Omit<StageReport, "caseId">> = {};
    const perSlice = new Map<
      string,
      { p: number[]; f: number[]; r: number[]; n: number[]; cases: number }
    >();
    for (const c of CASES) {
      const rep = await runRecallCase(c);
      perCase[c.id] = {
        rankedIds: rep.rankedIds,
        kinds: rep.kinds,
        detailUnknown: rep.detailUnknown,
        missingRelevant: rep.missingRelevant,
        irrelevantTop: rep.irrelevantTop,
        pAt5: rep.pAt5,
        rAt10: rep.rAt10,
        ndcgAt10: rep.ndcgAt10,
        providerKeywords: rep.providerKeywords,
        dupsCollapsed: rep.dupsCollapsed,
        detailsChecked: rep.detailsChecked,
      };
      const { labels } = buildLabelPool(c.candidates);
      const m5 = evaluateRankingActual(rep.rankedIds, labels, 5);
      const f5 = evaluateRanking(rep.rankedIds, labels, 5);
      const m10 = evaluateRankingActual(rep.rankedIds, labels, 10);
      const agg = perSlice.get(c.slice) ?? { p: [], f: [], r: [], n: [], cases: 0 };
      if (m5.precisionAtK !== null) agg.p.push(m5.precisionAtK);
      agg.f.push(f5.precisionAtK);
      if (m10.recallAtK !== null) agg.r.push(m10.recallAtK);
      agg.n.push(m10.ndcgAtK);
      agg.cases += 1;
      perSlice.set(c.slice, agg);
    }
    const report: Record<
      string,
      {
        cases: number;
        /** Fixed-K precision: relevant-in-top-5 / 5 (seed-benchmark contract). */
        pAt5_fixed: number;
        /** Actual-return precision: relevant / min(5, returned), null when empty. */
        pAt5_actual: number | null;
        rAt10: number | null;
        ndcgAt10: number;
      }
    > = {};
    for (const [slice, agg] of perSlice) {
      const avg = (xs: number[]) =>
        xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
      report[slice] = {
        cases: agg.cases,
        pAt5_fixed: Number(
          (
            agg.f.reduce((a, b) => a + b, 0) / (agg.f.length === 0 ? 1 : agg.f.length)
          ).toFixed(4)
        ),
        pAt5_actual: avg(agg.p) === null ? null : Number(avg(agg.p)!.toFixed(4)),
        rAt10: avg(agg.r) === null ? null : Number(avg(agg.r)!.toFixed(4)),
        ndcgAt10: Number((agg.n.reduce((a, b) => a + b, 0) / agg.n.length).toFixed(4)),
      };
    }
    const payload = {
      k: "P@5_fixed + P@min(5,n)/R@10/nDCG@10(actual)",
      perSlice: report,
      perCase,
    };
    const outPath = process.env.RECALL_REPORT_PATH ?? join(tmpdir(), "shakar-recall-report.json");
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    expect(Object.keys(perCase).length).toBe(CASES.length);
  });
});
