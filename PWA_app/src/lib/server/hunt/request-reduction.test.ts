import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Candidate, HuntDefinition } from "./pipeline";
import type { ListingSummary } from "../divar/provider";

// Same provider/taxonomy boundary mocks as pipeline.test.ts — the real
// collectCandidates/confirmCandidates run underneath.
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
import {
  canResolveFromTitle,
  collectCandidates,
  confirmCandidates,
  type HuntStats,
} from "./pipeline";
import { matchLabel } from "@/lib/hunt-view-state";

const mockSearchLists = vi.mocked(divarProvider.searchLists);
const mockGetDetail = vi.mocked(divarProvider.getDetail);

function summary(over: Partial<ListingSummary> & { sourceAdId: string }): ListingSummary {
  return { title: "", price: null, city: "تهران", ...over };
}

function mobileDef(over: Partial<HuntDefinition> = {}): HuntDefinition {
  return {
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
    ...over,
  };
}

function freshStats(): HuntStats {
  return {
    adsSeen: 0,
    titleRejected: 0,
    dupsCollapsed: 0,
    candidates: 0,
    detailsChecked: 0,
    confirmed: 0,
    stale: false,
    nearMiss: 0,
    rejectedNoMatch: 0,
    titleOnlyEvaluated: 0,
  };
}

beforeEach(() => {
  // mockReset (not just clearAllMocks): queued mockResolvedValueOnce
  // entries from an early-stopped test must never leak into the next test.
  mockSearchLists.mockReset();
  mockGetDetail.mockReset();
});

function maxTitle(id: string, district?: string): ListingSummary {
  return summary({ sourceAdId: id, title: "گوشی نو آکبند", price: null, district: district ?? `d-${id}` });
}

describe("top-100 saturation early stop", () => {
  function pagesOf(sizes: number[]): void {
    sizes.forEach((size, page) => {
      const listings = Array.from({ length: size }, (_, k) => maxTitle(`p${page}-${k}`));
      const last = page === sizes.length - 1;
      mockSearchLists.mockResolvedValueOnce({
        listings,
        hasMore: !last,
        nextCursor: last ? undefined : `cursor-${page}`,
      });
    });
  }

  it("1. triggers only after 100 eligible unique max-score candidates", async () => {
    // Page 1: 60 max-score. Page 2: 60 more (120 total, all unique).
    pagesOf([60, 60, 60]);
    const { stats } = await collectCandidates(mobileDef(), { maxPages: 5 });
    expect(mockSearchLists).toHaveBeenCalledTimes(2);
    expect(stats.collectionStopReason).toBe("top-k-saturated");
  });

  it("2. later candidates cannot change the selected top-100 IDs", async () => {
    pagesOf([60, 60, 60]);
    const first = await collectCandidates(mobileDef(), { maxPages: 5 });
    // collectCandidates returns every priced candidate fetched so far; the
    // effective shortlist is the first MAX_DETAILS_PER_HUNT after the
    // stable title-strength sort — identical to what confirmCandidates
    // slices. Later ties sort strictly after by fetch order.
    expect(first.candidates.slice(0, 100).map((c) => c.sourceAdId)).toEqual(
      Array.from({ length: 60 }, (_, k) => `p0-${k}`).concat(Array.from({ length: 40 }, (_, k) => `p1-${k}`))
    );
  });

  it("3. full scan and early-stop selection are identical for the same pool", async () => {
    // Seven pages of 15 unique max-score candidates (105 total), then a
    // tail page with a dupe, an exclude hit, an out-of-range price, weak
    // titles, and five more max-score candidates that must all lose to
    // fetch order (they would rank past the first 100).
    const head: ListingSummary[][] = Array.from({ length: 7 }, (_, p) =>
      Array.from({ length: 15 }, (_, k) => maxTitle(`h${p}-${k}`))
    );
    const tail: ListingSummary[] = [
      { ...maxTitle("h0-0"), sourceAdId: "dupe-late" },
      summary({ sourceAdId: "excl", title: "گوشی خراب", district: "d-excl" }),
      summary({ sourceAdId: "oor", title: "گوشی نو آکبند", price: 999999999, district: "d-oor" }),
      ...Array.from({ length: 5 }, (_, k) => maxTitle(`tail-max-${k}`)),
      ...Array.from({ length: 5 }, (_, k) =>
        summary({ sourceAdId: `tail-weak-${k}`, title: "لپ تاپ استوک", district: `d-tw-${k}` })
      ),
    ];
    const feed = (withTail: boolean) => {
      mockSearchLists.mockReset();
      head.forEach((listings, p) => {
        const last = p === head.length - 1;
        const more = withTail ? true : !last;
        mockSearchLists.mockResolvedValueOnce({
          listings,
          hasMore: more,
          nextCursor: more ? `cursor-h${p}` : undefined,
        });
      });
      if (withTail) {
        mockSearchLists.mockResolvedValueOnce({ listings: tail, hasMore: false, nextCursor: undefined });
      }
    };
    feed(false);
    const full = await collectCandidates(mobileDef(), { maxPages: 10 });
    expect(full.stats.collectionStopReason).toBeUndefined();
    expect(mockSearchLists).toHaveBeenCalledTimes(7);
    feed(true);
    const early = await collectCandidates(mobileDef(), { maxPages: 10 });
    expect(early.stats.collectionStopReason).toBe("top-k-saturated");
    // The tail page is never fetched.
    expect(mockSearchLists).toHaveBeenCalledTimes(7);
    expect(early.candidates.map((c) => c.sourceAdId)).toEqual(
      full.candidates.map((c) => c.sourceAdId)
    );
    // The first 100 max-score candidates in fetch order win — nothing later
    // (not even later max-score ties) displaces them.
    const expected = head.flat().slice(0, 100).map((l) => l.sourceAdId);
    expect(early.candidates.slice(0, 100).map((c) => c.sourceAdId)).toEqual(expected);
  });

  it("4. dupes, excludes, prices, unknowns, and ties preserve selection", async () => {
    const listings: ListingSummary[] = [
      maxTitle("a"), // max, district d-a
      maxTitle("a-dupe", "d-a"), // exact dupe key → collapsed, first wins
      maxTitle("a-tie", "d-a-tie"), // same strength, unique key → kept after
      summary({ sourceAdId: "ex", title: "گوشی خراب", district: "d-ex" }),
      summary({ sourceAdId: "oor", title: "گوشی نو آکبند", price: 500, district: "d-oor" }),
      summary({ sourceAdId: "unk", title: "گوشی نو آکبند", price: null, district: "d-unk" }),
      summary({ sourceAdId: "w", title: "لپ تاپ", district: "d-w" }),
    ];
    mockSearchLists.mockResolvedValueOnce({ listings, hasMore: false });
    const def = mobileDef({ exclude: ["خراب"], priceMax: "200" });
    const { candidates, stats } = await collectCandidates(def, { maxPages: 5 });
    const ids = candidates.map((c) => c.sourceAdId);
    expect(ids).toContain("a");
    expect(ids).not.toContain("a-dupe");
    expect(ids).toContain("a-tie");
    expect(ids).not.toContain("ex");
    expect(ids).not.toContain("oor");
    expect(ids).toContain("unk");
    expect(stats.titleRejected).toBe(1);
    expect(stats.dupsCollapsed).toBe(1);
    expect(stats.collectionStopReason).toBeUndefined();
  });

  it("5. without saturation every page is fetched as before", async () => {
    pagesOf([10, 10, 10, 10, 10]);
    // Weak titles never reach max strength (2 for a single MUST).
    mockSearchLists.mockReset();
    const weak = Array.from({ length: 50 }, (_, k) =>
      summary({ sourceAdId: `w${k}`, title: "لپ تاپ استوک", district: `dw-${k}` })
    );
    for (let p = 0; p < 5; p++) {
      mockSearchLists.mockResolvedValueOnce({
        listings: weak.slice(p * 10, p * 10 + 10),
        hasMore: p < 4,
        nextCursor: p < 4 ? `c-${p}` : undefined,
      });
    }
    const { stats } = await collectCandidates(mobileDef(), { maxPages: 5 });
    expect(mockSearchLists).toHaveBeenCalledTimes(5);
    expect(stats.collectionStopReason).toBeUndefined();
  });

  it("6. deepening resumes from the actual last fetched cursor", async () => {
    pagesOf([60, 60, 60]);
    const first = await collectCandidates(mobileDef(), { maxPages: 5 });
    expect(first.stats.collectionStopReason).toBe("top-k-saturated");
    expect(first.endCursor).toBe("cursor-1");
    mockSearchLists.mockResolvedValueOnce({ listings: [maxTitle("deep-0")], hasMore: false });
    await collectCandidates(mobileDef(), { maxPages: 1, startCursor: first.endCursor, startPage: 20 });
    expect(mockSearchLists).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-1", page: 20 })
    );
  });
});

describe("title-only evaluation", () => {
  function candidate(over: Partial<Candidate> & { sourceAdId: string }): Candidate {
    return {
      title: "گوشی نو آکبند",
      price: null,
      city: "تهران",
      titleStrength: 2,
      needsDetailReview: false,
      ...over,
    };
  }

  async function confirm(cands: Candidate[], def: HuntDefinition) {
    const stats = freshStats();
    const confirmed: string[] = [];
    mockGetDetail.mockImplementation(async (id: string) => {
      confirmed.push(id);
      return {
        sourceAdId: id,
        title: id,
        price: null,
        city: "",
        description: "گوشی تمیز اضافه",
        images: [],
        categorySlug: "",
      };
    });
    const results = await confirmCandidates(cands, def, stats, () => {});
    return { results, stats, fetched: confirmed };
  }

  it("7. matches full-detail score, verdict, evidence, and ordering when skippable", async () => {
    const def = mobileDef();
    const cands = [candidate({ sourceAdId: "t1" }), candidate({ sourceAdId: "t2", price: 100 })];
    expect(canResolveFromTitle(cands[0], def)).toBe(true);
    const { results, stats, fetched } = await confirm(cands, def);
    expect(fetched).toEqual([]);
    expect(results).toHaveLength(2);
    // Both exact with identical title evidence; the known-price candidate
    // scores higher via priceKnown — existing final-ranking rule, unchanged.
    expect(results.map((r) => r.sourceAdId)).toEqual(["t2", "t1"]);
    for (const r of results) {
      expect(r.matchKind).toBe("exact");
      expect(r.missingInfo).toEqual([]);
      expect(r.evaluationScope).toBe("title");
      expect(r.detailUnknown).toBeUndefined();
    }
    expect(stats.detailsChecked).toBe(0);
    expect(stats.titleOnlyEvaluated).toBe(2);
  });

  it("8. exclusions, conditions, missing evidence, and ambiguity force detail review", async () => {
    const base = candidate({ sourceAdId: "x" });
    const cases: Array<[string, HuntDefinition, Candidate]> = [
      ["exclude", mobileDef({ exclude: ["خراب"] }), base],
      ["condition-new", mobileDef({ condition: "new" }), base],
      ["condition-used", mobileDef({ condition: "used" }), base],
      ["missing-must", mobileDef(), candidate({ sourceAdId: "m", title: "لپ تاپ" })],
      ["missing-should", mobileDef({ should: ["تمیز"] }), base],
      ["weasel", mobileDef({ include: ["آکوستیک"], category: "music" }), candidate({ sourceAdId: "w", title: "طرح آکوستیک" })],
      ["related", mobileDef({ include: ["یخچال"], category: "home" }), candidate({ sourceAdId: "r", title: "فریزر صندوقی", needsDetailReview: true })],
      ["empty-must", mobileDef({ include: [] }), base],
    ];
    for (const [name, def, cand] of cases) {
      expect(canResolveFromTitle({ ...cand, sourceAdId: `${name}` }, def)).toBe(false);
    }
    const { fetched } = await confirm(
      [candidate({ sourceAdId: "f1", title: "لپ تاپ" })],
      mobileDef()
    );
    expect(fetched).toEqual(["f1"]);
  });

  it("9. progress counts evaluations, detailsChecked counts network calls", async () => {
    const def = mobileDef();
    const cands = [
      ...Array.from({ length: 5 }, (_, k) => candidate({ sourceAdId: `t${k}` })),
      ...Array.from({ length: 7 }, (_, k) => candidate({ sourceAdId: `f${k}`, title: "لپ تاپ" })),
    ];
    const stats = freshStats();
    const seen: Array<{ checked: number; total: number }> = [];
    mockGetDetail.mockImplementation(async (id: string) => ({
      sourceAdId: id,
      title: id,
      price: null,
      city: "",
      description: "…",
      images: [],
      categorySlug: "",
    }));
    await confirmCandidates(cands, def, stats, (e) => {
      if (e.type === "details-batch") seen.push({ checked: e.checked, total: e.total });
    });
    expect(seen).toEqual([
      { checked: 10, total: 12 },
      { checked: 12, total: 12 },
    ]);
    expect(stats.detailsChecked).toBe(7);
    expect(stats.titleOnlyEvaluated).toBe(5);
  });

  it("10. scope and badge never imply a reviewed description", async () => {
    const def = mobileDef();
    const { results } = await confirm([candidate({ sourceAdId: "t1" })], def);
    expect(results[0].evaluationScope).toBe("title");
    expect(matchLabel(results[0])).toBe("تطابق عنوان کامل");
    // A candidate that must be fetched reports the detail scope, even when
    // the verdict is also exact.
    const stats = freshStats();
    mockGetDetail.mockResolvedValueOnce({
      sourceAdId: "f1",
      title: "گوشی سالم",
      price: null,
      city: "",
      description: "گوشی سالم",
      images: [],
      categorySlug: "",
    });
    const fetched = await confirmCandidates(
      [candidate({ sourceAdId: "f1", title: "گوشی سالم", needsDetailReview: true })],
      mobileDef({ exclude: ["خراب"] }),
      stats,
      () => {}
    );
    expect(mockGetDetail).toHaveBeenCalledTimes(1);
    expect(fetched[0].evaluationScope).toBe("detail");
    expect(matchLabel(fetched[0])).toBe("تطابق متنی کامل");
  });
});
