import { describe, expect, it } from "vitest";
import type { Stage3QueryPlan, Stage3QueryPlanEntry } from "./stage3-query-plan";
import { executeStage3QueryPlan } from "./stage3-executor";

function entry(overrides: Partial<Stage3QueryPlanEntry> = {}): Stage3QueryPlanEntry {
  return {
    order: 1,
    huntId: "H01",
    kind: "base",
    entityAlternativeIndex: 0,
    hardSlotValues: [],
    query: "دوچرخه کوهستان",
    city_ids: ["1"],
    status: "queued",
    reason: "ready",
    ...overrides,
  };
}

function plan(entries: Stage3QueryPlanEntry[]): Stage3QueryPlan {
  return {
    entries,
    unmappedCitySlugs: [],
    summary: {
      baseQueries: entries.filter((item) => item.kind === "base").length,
      narrowQueries: entries.filter((item) => item.kind === "narrow" && item.status === "queued").length,
      skippedDuplicate: entries.filter((item) => item.status === "skipped-duplicate").length,
      emittedQueries: entries.filter((item) => item.status === "queued").length,
    },
  };
}

function response(
  listWidgets: unknown[],
  pagination: Record<string, unknown> = { has_next_page: false },
  status = 200,
): Response {
  return new Response(JSON.stringify({ list_widgets: listWidgets, pagination }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function postRow(
  token: string,
  title = "آگهی آزمایشی",
  price: string | null = "۵۰۰,۰۰۰ تومان",
  city = "تهران",
): Record<string, unknown> {
  return {
    widget_type: "POST_ROW",
    data: {
      title,
      middle_description_text: price,
      action: { payload: { token, web_info: { title, city_persian: city } } },
    },
  };
}

describe("Stage 3 polite Divar executor", () => {
  it("sends the derived query and city IDs with minimal headers, and parses POST_ROW fields", async () => {
    let sentUrl: RequestInfo | URL | undefined;
    let sentInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      sentUrl = input;
      sentInit = init;
      return response([postRow("token-a", "دوچرخه", "۵۰۰,۰۰۰ تومان", "تهران")]);
    };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl,
      endpoint: "https://example.test/search",
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(sentUrl).toBe("https://example.test/search");
    expect(sentInit?.method).toBe("POST");
    expect(sentInit?.headers).toEqual({ Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ShekarResearch/1.0" });
    const body = JSON.parse(String(sentInit?.body));
    expect(body.city_ids).toEqual(["1"]);
    expect(body.search_data.form_data.data.query.str.value).toBe("دوچرخه کوهستان");
    expect(result.pools[0].listings).toEqual([{
      token: "token-a",
      title: "دوچرخه",
      price: "۵۰۰,۰۰۰ تومان",
      city: "تهران",
    }]);
    expect(result.pools[0].complete).toBe(true);
  });

  it("delivers every event synchronously through onEvent in the same order and retains the returned event array", async () => {
    const delivered: import("./stage3-executor").Stage3ExecutorEvent[] = [];
    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl: async () => response([postRow("live-token")]),
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      onEvent: (event) => { delivered.push(event); },
    });

    expect(delivered).toEqual(result.events);
    expect(delivered).toHaveLength(result.events.length);
    expect(delivered[0]?.type).toBe("request");
    expect(delivered.some((event) => event.type === "listing-retained" && event.token === "live-token")).toBe(true);
    delivered.forEach((event, index) => {
      expect(event).toBe(result.events[index]);
    });
  });

  it("logs POST_ROW entries without a usable token as skipped without making the hunt incomplete", async () => {
    const missingTokenRow = {
      widget_type: "POST_ROW",
      data: {
        title: "ردیف بدون توکن",
        action: { payload: { web_info: { title: "ردیف بدون توکن" } } },
      },
    };
    const blankTokenRow = {
      widget_type: "POST_ROW",
      data: { action: { payload: { token: "   " } } },
    };
    const nonPostRow = { widget_type: "TEXT_ROW", data: {} };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl: async () => response([missingTokenRow, blankTokenRow, nonPostRow, postRow("valid-token")]),
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(result.events.filter((event) => event.type === "listing-skipped")).toEqual([
      { type: "listing-skipped", huntId: "H01", queryOrder: 1, page: 0, reason: "missing-token" },
      { type: "listing-skipped", huntId: "H01", queryOrder: 1, page: 0, reason: "missing-token" },
    ]);
    expect(result.pools[0].listings.map((listing) => listing.token)).toEqual(["valid-token"]);
    expect(result.pools[0].complete).toBe(true);
    expect(result.pools[0].incompleteReasons).toEqual([]);
  });

  it("paces requests at least one second apart plus jitter and logs the delay", async () => {
    let clock = 0;
    const delays: number[] = [];
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return response([postRow("token-" + calls)]);
    };

    const result = await executeStage3QueryPlan(plan([
      entry({ order: 1, query: "اول" }),
      entry({ order: 2, query: "دوم", entityAlternativeIndex: 1 }),
    ]), {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => { delays.push(ms); clock += ms; },
      random: () => 0.5,
      minRequestIntervalMs: 1_000,
      jitterMaxMs: 200,
    });

    expect(delays).toEqual([1_100]);
    expect(result.events.some((event) => event.type === "delay" && event.reason === "request-pacing" && event.delayMs === 1_100)).toBe(true);
    expect(calls).toBe(2);
  });

  it("treats an AbortSignal timeout as transient and retries only once", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      if (calls === 1) {
        const timeout = new Error("request timed out");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      return response([postRow("timeout-recovered")]);
    };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl,
      sleep: async () => undefined,
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      requestTimeoutMs: 8_000,
    });

    expect(calls).toBe(2);
    expect(result.events.find((event) => event.type === "retry")?.reason).toBe("timeout");
    expect(result.pools[0].complete).toBe(true);
  });

  it("retries one transient network failure, then succeeds", async () => {
    let calls = 0;
    const delays: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary network failure");
      return response([postRow("token-a")]);
    };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl,
      sleep: async (ms) => { delays.push(ms); },
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      transientRetryDelayMs: 7,
    });

    expect(calls).toBe(2);
    expect(delays).toContain(7);
    expect(result.events.filter((event) => event.type === "retry")).toHaveLength(1);
    expect(result.events.some((event) => event.type === "delay" && event.reason === "transient-retry" && event.delayMs === 7)).toBe(true);
    expect(result.pools[0].complete).toBe(true);
  });

  it("backs off exponentially on 429 and opens the circuit at the configured failure threshold", async () => {
    let calls = 0;
    const delays: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return response([], {}, 429);
    };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl,
      sleep: async (ms) => { delays.push(ms); },
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      rateLimitBaseMs: 10,
      rateLimitMaxMs: 15,
      circuitFailureThreshold: 3,
      circuitOpenMs: 60,
    });

    expect(calls).toBe(3);
    expect(delays).toEqual([10, 15]);
    expect(result.events.filter((event) => event.type === "rate-limit")).toHaveLength(3);
    expect(result.events.filter((event) => event.type === "circuit-open")).toHaveLength(1);
    expect(result.stoppedByCircuitBreaker).toBe(true);
    expect(result.pools[0].complete).toBe(false);
    expect(result.pools[0].incompleteReasons).toContain("circuit-open");
  });

  it("caps pagination at five pages and marks a truncated query incomplete", async () => {
    let calls = 0;
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return response([postRow("token-" + calls)], { has_next_page: true, data: { cursor: "c" + calls } });
    };

    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl,
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      maxPagesPerQuery: 5,
    });

    expect(calls).toBe(5);
    expect(bodies[0]).not.toHaveProperty("pagination_data");
    expect(bodies[1].pagination_data).toEqual({ cursor: "c1" });
    expect(bodies[4].pagination_data).toEqual({ cursor: "c4" });
    expect(result.events.find((event) => event.type === "page-stop")?.reason).toBe("page-cap");
    expect(result.events.find((event) => event.type === "page-stop")?.page).toBe(4);
    expect(result.pools[0].complete).toBe(false);
    expect(result.pools[0].incompleteReasons).toContain("page-cap");
  });

  it("stops incomplete when Divar advertises another page without a cursor", async () => {
    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl: async () => response([postRow("cursorless")], { has_next_page: true }),
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(result.pools[0].listings.map((listing) => listing.token)).toEqual(["cursorless"]);
    expect(result.events.find((event) => event.type === "page-stop")?.reason).toBe("missing-cursor");
    expect(result.pools[0].complete).toBe(false);
    expect(result.pools[0].incompleteReasons).toContain("missing-cursor");
  });

  it("deduplicates tokens per hunt across queries and logs each duplicate removal", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return calls === 1
        ? response([postRow("shared-token"), postRow("unique-a")])
        : response([postRow("shared-token"), postRow("unique-b")]);
    };

    const result = await executeStage3QueryPlan(plan([
      entry({ order: 1, query: "اول" }),
      entry({ order: 2, query: "دوم", entityAlternativeIndex: 1 }),
    ]), {
      fetchImpl,
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(result.pools[0].listings.map((listing) => listing.token)).toEqual([
      "shared-token", "unique-a", "unique-b",
    ]);
    expect(result.events.filter((event) => event.type === "listing-deduplicated")).toEqual([
      expect.objectContaining({ token: "shared-token", reason: "duplicate-token-within-hunt" }),
    ]);
    expect(result.events.filter((event) => event.type === "listing-retained")).toHaveLength(3);
  });

  it("treats an empty first page as a valid empty result", async () => {
    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl: async () => response([], { has_next_page: true, data: { cursor: "ignored" } }),
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(result.pools[0].listings).toEqual([]);
    expect(result.pools[0].complete).toBe(true);
    expect(result.events.find((event) => event.type === "page-stop")?.reason).toBe("empty-page");
  });

  it("marks network endings incomplete and marks queued hunts after an open circuit incomplete", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new Error("network unavailable");
    };

    const result = await executeStage3QueryPlan(plan([
      entry({ order: 1, huntId: "H01" }),
      entry({ order: 2, huntId: "H02", query: "دوم" }),
      entry({ order: 3, huntId: "H03", query: "سوم" }),
      entry({ order: 4, huntId: "H04", query: "چهارم" }),
    ]), {
      fetchImpl,
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
      transientRetryDelayMs: 0,
      circuitFailureThreshold: 5,
      circuitOpenMs: 60,
    });

    expect(result.stoppedByCircuitBreaker).toBe(true);
    expect(calls).toBe(5);
    expect(result.pools.find((pool) => pool.huntId === "H01")?.incompleteReasons).toContain("network-error");
    expect(result.pools.find((pool) => pool.huntId === "H04")?.incompleteReasons).toContain("circuit-open");
    expect(result.events.filter((event) => event.type === "request").length).toBe(calls);
    expect(result.events.some((event) => event.type === "circuit-open")).toBe(true);
  });

  it("marks non-transient HTTP errors incomplete after one response", async () => {
    let calls = 0;
    const result = await executeStage3QueryPlan(plan([entry()]), {
      fetchImpl: async () => {
        calls += 1;
        return response([], {}, 400);
      },
      minRequestIntervalMs: 0,
      jitterMaxMs: 0,
    });

    expect(calls).toBe(1);
    expect(result.pools[0].complete).toBe(false);
    expect(result.pools[0].incompleteReasons).toContain("http-error");
  });
});
