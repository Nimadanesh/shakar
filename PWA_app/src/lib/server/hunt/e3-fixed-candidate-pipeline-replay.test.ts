import { beforeEach, expect, it, vi } from "vitest";
import type { Candidate, HuntDefinition, HuntStats } from "./pipeline";
import { resolveHuntDefinition } from "./definition";
import { assessListingRole, assessModelSpecificity, assessQueryIntent, rolesClash } from "./semantics";
import { queryKindForDef } from "./kindLexicon";

vi.mock("../divar/divarClient", () => ({
  divarProvider: {
    name: "fixed-e3-fixture",
    searchLists: vi.fn(),
    getDetail: vi.fn(),
  },
}));
vi.mock("./slugCapture", () => ({
  flushSlugCaptures: vi.fn(async () => ({
    attempted: 0,
    written: 0,
    failed: 0,
    buffered: 0,
  })),
}));

import { divarProvider } from "../divar/divarClient";
import { confirmCandidates } from "./pipeline";

const mockGetDetail = vi.mocked(divarProvider.getDetail);

const fixtureDetails: Record<string, { title: string; description: string; categorySlug: string }> = {
  "gaiCb1F-": {
    title: "تولید انحصاری پیانو طرح آکوستیک ست کامل 160 میلیون",
    description: "پشت پیانو شبیه به آکوستیک زده شده. دستگاه داخلی این پیانو برای آموزشات اولیه مناسبه و خود دستگاه داخلی رو میشه هرزمان عوض کنید و یاماها بذارید.",
    categorySlug: "piano-keyboard",
  },
  "gaZze3Z1": {
    title: "پیانو اکوستیک m2 یاماها",
    description: "پیانو مکانیکی یاماها مدل m2. قطعات کاملا اورجینال هستش تعمیر یا تعویض نشده است.",
    categorySlug: "piano-keyboard",
  },
  "gaZzOCha": {
    title: "فروش پیانو آکوستیک و دیجیتال",
    description: "فروش انواع پیانو آکوستیک و دیجیتال. ارسال به سراسر ایران و مشاوره تخصصی.",
    categorySlug: "piano-keyboard",
  },
  "gaZb-8lt": {
    title: "پیانو یاماها SLP-48 طرح آکوستیک",
    description: "کاملا نو هستش و نهایت 50 بار استفاده شده. SLP-48 طرح آکوستیک یاماها.",
    categorySlug: "piano-keyboard",
  },
  "gaZnujck": {
    title: "پیانو اکوستیک ژاپنی یاماها مدل u10",
    description: "پیانو مکانیکی یاماها مدل u10. قطعات کاملا اورجینال هستش تعمیر یا تعویض نشده است.",
    categorySlug: "piano-keyboard",
  },
  "Qa0_1GLb": {
    title: "وارد کننده مستقیم پیانو آکوستیک و دیجیتال یاماها",
    description: "انواع پیانو های دیجیتال یاماها P YDP CLP. پیانو آکوستیک دیواری یاماها U YU YUS. پیانو آکوستیک رویال یاماها GB1K C1 C2X C3X.",
    categorySlug: "piano-keyboard",
  },
  "gaZvu9P8": {
    title: "ست کف پایی و کفی صندوق ماشین تارا،بسیار تمیز ونو",
    description: "سلام. ست کف پایی تارا و کفی صندوق عقب. چند روز روی ماشین بوده. ماشین رو فروختم گفتم این رو هم کسی استفاده کنه.",
    categorySlug: "parts-accessories",
  },
  "gaYfZnPP": {
    title: "کفی مبلی نیسانی",
    description: "کفی مبلی مخصوص نیسان دوگانه دستی",
    categorySlug: "parts-accessories",
  },
};

function definition(query: string): HuntDefinition {
  const def = resolveHuntDefinition({
    query,
    include: [],
    exclude: [],
    should: [],
    city: "all",
    category: "all",
    priceMin: "",
    priceMax: "",
    transaction: "",
    condition: "",
  });
  if (!def) throw new Error("Fixture query did not resolve: " + query);
  return def;
}

function emptyStats(count: number): HuntStats {
  return {
    adsSeen: count,
    titleRejected: 0,
    dupsCollapsed: 0,
    candidates: count,
    detailsChecked: 0,
    confirmed: 0,
    stale: false,
    nearMiss: 0,
    rejectedNoMatch: 0,
    rejectedSample: [],
    mizanShadow: [],
    mizanRejected: 0,
  };
}

function candidates(ids: string[]): Candidate[] {
  return ids.map((sourceAdId, index) => {
    const detail = fixtureDetails[sourceAdId];
    return {
      sourceAdId,
      title: detail.title,
      price: null,
      city: "تهران",
      titleStrength: ids.length - index,
      needsDetailReview: false,
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MIZAN_SHADOW = "0";
  process.env.HUNT_MAX_DETAILS = "100";
  mockGetDetail.mockImplementation(async (sourceAdId) => {
    const item = fixtureDetails[sourceAdId];
    if (!item) throw new Error("Unexpected source ID: " + sourceAdId);
    return {
      sourceAdId,
      title: item.title,
      price: null,
      city: "تهران",
      description: item.description,
      images: [],
      categorySlug: item.categorySlug,
      stale: false,
    };
  });
});

it("replays full detail scoring on the same fixed P01–P06, K01 and AMB01 records", async () => {
  const cases = [
    { query: "پیانو اکوستیک", ids: ["gaiCb1F-", "gaZze3Z1", "gaZzOCha", "gaZb-8lt", "gaZnujck", "Qa0_1GLb"] },
    { query: "کفی ماشین", ids: ["gaZvu9P8", "gaYfZnPP"] },
  ];
  const results: Array<{ query: string; results: Array<Record<string, unknown>> }> = [];

  for (const scenario of cases) {
    const input = candidates(scenario.ids);
    const stats = emptyStats(input.length);
    const def = definition(scenario.query);
    const output = await confirmCandidates(input, def, stats);
    const diagnostics = scenario.ids.map((sourceAdId) => {
      const fixture = fixtureDetails[sourceAdId];
      const combined = `${fixture.title} ${fixture.description}`;
      const queryRole = assessQueryIntent(def.include.join(" "), def.category, def.transaction);
      const listingRole = assessListingRole(combined);
      const identity = assessModelSpecificity(
        def.include,
        combined,
        def.category,
        queryKindForDef(def.include, def.serviceIntent ?? false, def.category),
        def.query,
        fixture.title
      );
      return {
        sourceAdId,
        queryRole,
        listingRole,
        roleClash: rolesClash(queryRole, listingRole, def.transaction === "buy"),
        identity,
      };
    });
    results.push({
      query: scenario.query,
      diagnostics,
      results: output.map((item, index) => ({
        rank: index + 1,
        sourceAdId: item.sourceAdId,
        title: item.title,
        matchKind: item.matchKind,
        score: item.score,
        missingInfo: item.missingInfo,
        demotedBy: item.demotedBy ?? null,
      })),
    });
  }

  const piano = results.find((item) => item.query === "پیانو اکوستیک")?.results ?? [];
  const mats = results.find((item) => item.query === "کفی ماشین")?.results ?? [];
  const ambiguous = mats.find((item) => item.sourceAdId === "gaYfZnPP");
  const floorMat = mats.find((item) => item.sourceAdId === "gaZvu9P8");

  if (process.env.E3_REPLAY_MODE === "baseline") {
    expect(ambiguous, "baseline guard should hard-reject the ambiguous cue").toBeUndefined();
  } else {
    expect(process.env.E3_REPLAY_MODE).toBe("current");
    expect(ambiguous, "current full pipeline should retain the ambiguous listing for honest near/unknown handling").toBeDefined();
  }

  expect(piano.find((item) => item.sourceAdId === "gaiCb1F-")?.matchKind).not.toBe("exact");
  expect(piano.find((item) => item.sourceAdId === "gaZb-8lt")?.matchKind).not.toBe("exact");
  expect(floorMat?.matchKind).toBe("exact");

  const outputPath = process.env.E3_PIPELINE_REPLAY_OUTPUT;
  if (outputPath) await (await import("node:fs/promises")).writeFile(outputPath, JSON.stringify({
    kind: "e3-fixed-candidate-detail-scoring-replay",
    mode: process.env.E3_REPLAY_MODE,
    sourceCommit: process.env.E3_REPLAY_SOURCE_COMMIT ?? "unspecified",
    results,
    scopeWarning: "Fixed candidate detail scoring/ranking only. Retrieval, title-phase scoring, dedupe, and live ranking allocation are not replayed. Fixture descriptions are sanitized evidence excerpts, not complete raw source details.",
  }, null, 2), "utf8");
  console.log("E3_FIXED_CANDIDATE_PIPELINE_REPLAY=" + JSON.stringify(results));
});
