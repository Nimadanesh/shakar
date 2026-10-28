import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReplayArtifacts,
  extractDetailFields,
  findMissingGoodTokens,
  parseReplayArgs,
  readDetailLive,
  runStage3Replay,
} from "./stage3-replay.mjs";

function detailResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const liveDetail = {
  sections: [
    { section_name: "TITLE", widgets: [{ widget_type: "LEGEND_TITLE_ROW", data: { title: "عنوان آگهی" } }] },
    { section_name: "DESCRIPTION", widgets: [{ widget_type: "DESCRIPTION_ROW", data: { text: "توضیحات کامل آگهی" } }] },
    { section_name: "LIST_DATA", widgets: [{ widget_type: "UNEXPANDABLE_ROW", data: { title: "قیمت", value: "۱۰۰ تومان" } }] },
    { section_name: "BREADCRUMB", widgets: [{
      widget_type: "BREADCRUMB",
      data: { parent_items: [{ action: { payload: { search_data: { form_data: { data: { category: { str: { value: "vehicles" } } } } } } }} ] },
    }] },
  ],
};

describe("Stage 3 replay detail reader", () => {
  it("extracts only the documented section/widget fields including the breadcrumb slug", () => {
    expect(extractDetailFields(liveDetail)).toEqual({
      title: "عنوان آگهی",
      description: "توضیحات کامل آگهی",
      listData: [{ title: "قیمت", value: "۱۰۰ تومان" }],
      categorySlug: "vehicles",
    });
  });

  it("performs a fresh encoded GET with the specified headers and classifies a live 200", async () => {
    let requestedUrl = "";
    let init: RequestInit | undefined;
    const state = { lastRequestAt: null as number | null, events: [] as Record<string, unknown>[] };
    const result = await readDetailLive("token /?", state, {
      fetchImpl: async (url: Parameters<typeof fetch>[0], requestInit: Parameters<typeof fetch>[1]) => {
        requestedUrl = String(url);
        init = requestInit;
        return detailResponse(200, liveDetail);
      },
      now: () => 10_000,
      sleep: async () => {},
      random: () => 0,
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(requestedUrl).toBe("https://api.divar.ir/v8/posts-v2/web/token%20%2F%3F");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ Accept: "application/json", "User-Agent": "ShekarResearch/1.0" });
    expect(init?.cache).toBe("no-store");
    expect(result).toMatchObject({ classification: "live", status: 200, sectionsPresent: true, detail: { title: "عنوان آگهی", categorySlug: "vehicles" } });
  });

  it.each([404, 410])("classifies HTTP %i as expired", async (status) => {
    const state = { lastRequestAt: null as number | null, events: [] as Record<string, unknown>[] };
    const result = await readDetailLive("expired-token", state, {
      fetchImpl: async () => detailResponse(status, {}),
      now: () => 10_000,
      sleep: async () => {},
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });
    expect(result).toMatchObject({ classification: "expired", status, sectionsPresent: false });
  });

  it("keeps non-200 and empty-section responses unclassified, preserving raw status and section presence", async () => {
    const stateA = { lastRequestAt: null as number | null, events: [] as Record<string, unknown>[] };
    const unexpected = await readDetailLive("other-token", stateA, {
      fetchImpl: async () => detailResponse(403, {}),
      now: () => 10_000,
      sleep: async () => {},
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });
    expect(unexpected).toMatchObject({ classification: "unclassified", status: 403, sectionsPresent: false });

    const stateB = { lastRequestAt: null as number | null, events: [] as Record<string, unknown>[] };
    const empty = await readDetailLive("empty-token", stateB, {
      fetchImpl: async () => detailResponse(200, { sections: [] }),
      now: () => 10_000,
      sleep: async () => {},
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });
    expect(empty).toMatchObject({ classification: "unclassified", status: 200, sectionsPresent: false, reason: "http-200-no-sections" });
  });

  it("joins grades by (huntId, token), and emits separate live/expired/unclassified buckets and auditable drops", () => {
    const grades = [
      { huntId: "H01", token: "present", grade: 3 },
      { huntId: "H01", token: "missed-live", grade: 2 },
      { huntId: "H01", token: "missed-expired", grade: 1 },
      { huntId: "H01", token: "missed-unknown", grade: 3 },
      { huntId: "H02", token: "present", grade: 3 },
      { huntId: "H01", token: "wrong", grade: 0 },
    ];
    const pools = [{ huntId: "H01", listings: [{ token: "present", title: "A", price: null, city: "تهران" }], complete: true, incompleteReasons: [] }];
    expect(findMissingGoodTokens(grades, pools)).toEqual([
      { huntId: "H01", token: "missed-live", grade: 2 },
      { huntId: "H01", token: "missed-expired", grade: 1 },
      { huntId: "H01", token: "missed-unknown", grade: 3 },
      { huntId: "H02", token: "present", grade: 3 },
    ]);

    const artifacts = buildReplayArtifacts({
      plan: { entries: [{ order: 1, huntId: "H01", status: "queued", kind: "base" }], summary: { baseQueries: 1, narrowQueries: 0, skippedDuplicate: 0, emittedQueries: 1 } },
      executorResult: {
        pools: [
          { huntId: "H01", listings: [{ token: "present", title: "A", price: null, city: "تهران" }], complete: true, incompleteReasons: [] },
          { huntId: "H02", listings: [], complete: true, incompleteReasons: [] },
        ],
        events: [
          { type: "request", huntId: "H01", queryOrder: 1, page: 0 },
          { type: "page-stop", huntId: "H01", queryOrder: 1, page: 0, reason: "no-next-page" },
          { type: "listing-deduplicated", huntId: "H01", queryOrder: 1, page: 0, token: "present", reason: "duplicate-token-within-hunt" },
          { type: "listing-skipped", huntId: "H01", queryOrder: 1, page: 0, reason: "missing-token" },
        ],
        stoppedByCircuitBreaker: false,
      },
      allHuntIds: ["H01", "H02"],
      grades,
      detailResults: [
        { huntId: "H01", token: "missed-live", grade: 2, classification: "live", status: 200, sectionsPresent: true, reason: "http-200-sections-present", detail: null, events: [] },
        { huntId: "H01", token: "missed-expired", grade: 1, classification: "expired", status: 404, sectionsPresent: false, reason: "gone-status", detail: null, events: [] },
        { huntId: "H01", token: "missed-unknown", grade: 3, classification: "unclassified", status: 403, sectionsPresent: false, reason: "unexpected-status", detail: null, events: [] },
        { huntId: "H02", token: "present", grade: 3, classification: "expired", status: 410, sectionsPresent: false, reason: "gone-status", detail: null, events: [] },
      ],
    });

    expect(artifacts.dropLog.items).toEqual([
      { huntId: "H01", token: "present", queryOrder: 1, page: 0, reason: "duplicate-token-within-hunt" },
      { huntId: "H01", token: null, queryOrder: 1, page: 0, reason: "missing-token" },
    ]);
    expect(artifacts.sizeDistribution[0]).toMatchObject({ huntId: "H01", uniqueTokens: 1, requests: 1, pages: 1 });
    expect(artifacts.cityDistribution[0].cityCounts).toEqual({ "تهران": 1 });
    expect(artifacts.overlapInputs.present).toEqual(["H01"]);
    expect(artifacts.missingGoodReport).toMatchObject({
      liveButMissedCount: 1,
      expiredCount: 2,
      unclassifiedCount: 1,
      replayIncompleteDueToUnclassifiedDetails: true,
    });
  });
});


describe("Stage 3 incremental replay", () => {
  it("persists per-hunt tokens and stops the second mocked replay at known overlap", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "stage3-incremental-"));
    const plan = {
      entries: [{
        order: 1,
        huntId: "H01",
        kind: "base",
        entityAlternativeIndex: 0,
        hardSlotValues: [],
        query: "کفی ماشین",
        city_ids: null,
        status: "queued",
        reason: "ready",
      }],
      summary: { baseQueries: 1, narrowQueries: 0, skippedDuplicate: 0, emittedQueries: 1 },
    };
    const listing = (token: string) => ({
      widget_type: "POST_ROW",
      data: { title: token, action: { payload: { token, web_info: { title: token, city_persian: "تهران" } } } },
    });
    const mockedFetch = (rows: string[]) => async () => new Response(JSON.stringify({
      list_widgets: rows.map(listing),
      pagination: { has_next_page: false },
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    try {
      await runStage3Replay({
        outputDir,
        plan,
        grades: [],
        allHuntIds: ["H01"],
        fetchImpl: mockedFetch(["old-A", "old-B"]),
        now: () => 10_000,
        sleep: async () => {},
        random: () => 0,
      });
      const second = await runStage3Replay({
        outputDir,
        plan,
        grades: [],
        allHuntIds: ["H01"],
        fetchImpl: mockedFetch(["new-C", "old-A"]),
        now: () => 20_000,
        sleep: async () => {},
        random: () => 0,
      });
      const state = JSON.parse(await readFile(join(outputDir, "incremental-state.json"), "utf8"));
      const pools = JSON.parse(await readFile(join(outputDir, "hunt-pools.json"), "utf8"));

      expect(second.searchRequests).toBe(1);
      expect(pools.H01.tokens).toEqual(["new-C"]);
      expect(state.hunts.H01.knownTokens).toEqual(["old-A", "old-B", "new-C"]);
      expect(state.hunts.H01.lastOverlapToken).toBe("old-A");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});


describe("Stage 3 incremental multi-query semantics", () => {
  it("continues later queries after overlap and marks pool output as delta-only", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "stage3-incremental-multi-"));
    const entry = (order: number, query: string) => ({
      order,
      huntId: "H01",
      kind: "base",
      entityAlternativeIndex: 0,
      hardSlotValues: [],
      query,
      city_ids: null,
      status: "queued",
      reason: "ready",
    });
    const plan = {
      entries: [entry(1, "query-one"), entry(2, "query-two")],
      summary: { baseQueries: 2, narrowQueries: 0, skippedDuplicate: 0, emittedQueries: 2 },
    };
    const listing = (token: string) => ({
      widget_type: "POST_ROW",
      data: { title: token, action: { payload: { token, web_info: { title: token, city_persian: "تهران" } } } },
    });
    const mockedFetch = (rows: string[]) => async () => new Response(JSON.stringify({
      list_widgets: rows.map(listing),
      pagination: { has_next_page: false },
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    try {
      await runStage3Replay({
        outputDir,
        plan: { ...plan, entries: [entry(1, "seed")] },
        grades: [],
        allHuntIds: ["H01"],
        fetchImpl: mockedFetch(["old-A"]),
        now: () => 10_000,
        sleep: async () => {},
        random: () => 0,
      });

      const seenQueries: string[] = [];
      const second = await runStage3Replay({
        outputDir,
        plan,
        grades: [],
        allHuntIds: ["H01"],
        fetchImpl: async (_url: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
          const body = JSON.parse(String(init?.body));
          const query = body.search_data.form_data.data.query.str.value;
          seenQueries.push(query);
          return new Response(JSON.stringify({
            list_widgets: (query === "query-one" ? ["old-A"] : ["new-B"]).map(listing),
            pagination: { has_next_page: false },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        },
        now: () => 20_000,
        sleep: async () => {},
        random: () => 0,
      });

      const state = JSON.parse(await readFile(join(outputDir, "incremental-state.json"), "utf8"));
      const pools = JSON.parse(await readFile(join(outputDir, "hunt-pools.json"), "utf8"));
      const summary = JSON.parse(await readFile(join(outputDir, "summary.json"), "utf8"));

      expect(seenQueries).toEqual(["query-one", "query-two"]);
      expect(second.searchRequests).toBe(2);
      expect(pools.H01.tokens).toEqual(["new-B"]);
      expect(pools.H01.deltaOnly).toBe(true);
      expect(state.hunts.H01.knownTokens).toEqual(["old-A", "new-B"]);
      expect(summary.incremental).toBe(true);
      expect(summary.incrementalNote).toContain("complete known-token set is stored in incremental-state.json");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

describe("Stage 3 replay page-cap CLI", () => {
  it("defaults to five pages and accepts both max-pages forms", () => {
    expect(parseReplayArgs([])).toEqual({ outputDir: undefined, maxPagesPerQuery: 5 });
    expect(parseReplayArgs(["--max-pages", "10"])).toEqual({ outputDir: undefined, maxPagesPerQuery: 10 });
    expect(parseReplayArgs(["./out", "--max-pages=10"])).toEqual({ outputDir: "./out", maxPagesPerQuery: 10 });
  });
  it("rejects missing, zero, non-integer, and unknown page-cap options", () => {
    expect(() => parseReplayArgs(["--max-pages"])).toThrow(/positive integer/);
    expect(() => parseReplayArgs(["--max-pages", "0"])).toThrow(/positive integer/);
    expect(() => parseReplayArgs(["--max-pages", "2.5"])).toThrow(/positive integer/);
    expect(() => parseReplayArgs(["--bogus"])).toThrow(/Unknown replay option/);
  });
  it.each([
    { label: "default", options: {}, expected: 5 },
    { label: "explicit ten", options: { maxPagesPerQuery: 10 }, expected: 10 },
  ])("passes $label cap through to the executor", async ({ options, expected }) => {
    const outputDir = await mkdtemp(join(tmpdir(), "stage3-page-cap-"));
    const plan = {
      entries: [{ order: 1, huntId: "H01", kind: "base", entityAlternativeIndex: 0, hardSlotValues: [], query: "کفی ماشین", city_ids: null, status: "queued", reason: "ready" }],
      summary: { baseQueries: 1, narrowQueries: 0, skippedDuplicate: 0, emittedQueries: 1 },
    };
    let receivedCap: number | undefined;
    try {
      const summary = await runStage3Replay({
        outputDir, plan, grades: [], allHuntIds: ["H01"], ...options,
        executePlan: async (_plan: unknown, executorOptions: { maxPagesPerQuery?: number }) => {
          receivedCap = executorOptions.maxPagesPerQuery;
          return { pools: [{ huntId: "H01", listings: [], complete: true, incompleteReasons: [] }], events: [], stoppedByCircuitBreaker: false };
        },
      });
      expect(receivedCap).toBe(expected);
      expect(summary.maxPagesPerQuery).toBe(expected);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
