import type { Stage3QueryPlan, Stage3QueryPlanEntry } from "./stage3-query-plan";

const DIVAR_SEARCH_URL = "https://api.divar.ir/v8/postlist/w/search";
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;
const REQUEST_JITTER_MAX_MS = 250;
const TRANSIENT_RETRY_DELAY_MS = 1_000;
const RATE_LIMIT_BASE_MS = 60_000;
const RATE_LIMIT_MAX_MS = 10 * 60_000;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;
const MAX_PAGES_PER_QUERY = 5;

export interface Stage3Listing {
  readonly token: string;
  readonly title: string;
  readonly price: string | null;
  readonly city: string | null;
}

export type Stage3StopReason =
  | "no-next-page"
  | "empty-page"
  | "missing-cursor"
  | "page-cap"
  | "rate-limited"
  | "circuit-open"
  | "network-error"
  | "http-error"
  | "invalid-json";

export interface Stage3ExecutorEvent {
  readonly type:
    | "request"
    | "delay"
    | "response"
    | "retry"
    | "rate-limit"
    | "circuit-open"
    | "page-stop"
    | "listing-retained"
    | "listing-deduplicated"
    | "listing-skipped";
  readonly huntId: string;
  readonly queryOrder: number;
  readonly page?: number;
  readonly attempt?: number;
  readonly status?: number;
  readonly delayMs?: number;
  readonly token?: string;
  readonly reason?: string;
}

export interface Stage3HuntPool {
  readonly huntId: string;
  readonly listings: readonly Stage3Listing[];
  readonly complete: boolean;
  readonly incompleteReasons: readonly string[];
}

export interface Stage3ExecutorResult {
  readonly pools: readonly Stage3HuntPool[];
  readonly events: readonly Stage3ExecutorEvent[];
  readonly stoppedByCircuitBreaker: boolean;
}

export interface Stage3ExecutorOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly endpoint?: string;
  readonly requestTimeoutMs?: number;
  readonly minRequestIntervalMs?: number;
  readonly jitterMaxMs?: number;
  readonly transientRetryDelayMs?: number;
  readonly rateLimitBaseMs?: number;
  readonly rateLimitMaxMs?: number;
  readonly circuitFailureThreshold?: number;
  readonly circuitOpenMs?: number;
  readonly maxPagesPerQuery?: number;
}

interface ParsedPage {
  readonly listings: readonly Stage3Listing[];
  readonly hasNextPage: boolean;
  readonly nextCursor: unknown;
}

type RequestOutcome =
  | { readonly kind: "ok"; readonly page: ParsedPage }
  | { readonly kind: "stop"; readonly reason: Stage3StopReason };

interface MutablePool {
  huntId: string;
  listings: Stage3Listing[];
  seenTokens: Set<string>;
  complete: boolean;
  incompleteReasons: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parsePostRows(payload: unknown): ParsedPage | null {
  const root = asRecord(payload);
  if (!root) return null;
  const widgets = Array.isArray(root.list_widgets) ? root.list_widgets : [];
  const listings: Stage3Listing[] = [];

  for (const item of widgets) {
    const widget = asRecord(item);
    if (!widget || widget.widget_type !== "POST_ROW") continue;
    const data = asRecord(widget.data);
    const action = asRecord(data?.action);
    const actionPayload = asRecord(action?.payload);
    const token = asString(actionPayload?.token);
    if (!data || !token || token.trim() === "") continue;
    const webInfo = asRecord(actionPayload?.web_info);
    listings.push({
      token,
      title: asString(webInfo?.title) ?? asString(data.title) ?? "",
      price: asString(data.middle_description_text),
      city: asString(webInfo?.city_persian),
    });
  }

  const pagination = asRecord(root.pagination);
  return {
    listings,
    hasNextPage: pagination?.has_next_page === true,
    nextCursor: pagination?.data,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Research-only executor. It deliberately has no imports from src/lib/server
 * and never impersonates a browser, bypasses CAPTCHA, or uses a proxy.
 */
export async function executeStage3QueryPlan(
  plan: Stage3QueryPlan,
  options: Stage3ExecutorOptions = {},
): Promise<Stage3ExecutorResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const endpoint = options.endpoint ?? DIVAR_SEARCH_URL;
  const timeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const minIntervalMs = options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
  const jitterMaxMs = options.jitterMaxMs ?? REQUEST_JITTER_MAX_MS;
  const retryDelayMs = options.transientRetryDelayMs ?? TRANSIENT_RETRY_DELAY_MS;
  const rateLimitBaseMs = options.rateLimitBaseMs ?? RATE_LIMIT_BASE_MS;
  const rateLimitMaxMs = options.rateLimitMaxMs ?? RATE_LIMIT_MAX_MS;
  const failureThreshold = options.circuitFailureThreshold ?? CIRCUIT_FAILURE_THRESHOLD;
  const circuitOpenMs = options.circuitOpenMs ?? CIRCUIT_OPEN_MS;
  const pageCap = options.maxPagesPerQuery ?? MAX_PAGES_PER_QUERY;

  const events: Stage3ExecutorEvent[] = [];
  const poolByHunt = new Map<string, MutablePool>();
  let lastRequestAt: number | null = null;
  let consecutiveFailures = 0;
  let rateLimitStreak = 0;
  let circuitOpenUntil: number | null = null;
  let stoppedByCircuitBreaker = false;

  const poolFor = (huntId: string): MutablePool => {
    const existing = poolByHunt.get(huntId);
    if (existing) return existing;
    const created: MutablePool = {
      huntId,
      listings: [],
      seenTokens: new Set<string>(),
      complete: true,
      incompleteReasons: [],
    };
    poolByHunt.set(huntId, created);
    return created;
  };

  const log = (event: Stage3ExecutorEvent): void => {
    events.push(event);
  };

  const markIncomplete = (pool: MutablePool, reason: string): void => {
    pool.complete = false;
    if (!pool.incompleteReasons.includes(reason)) pool.incompleteReasons.push(reason);
  };

  const openCircuit = (entry: Stage3QueryPlanEntry, page: number): void => {
    circuitOpenUntil = now() + circuitOpenMs;
    stoppedByCircuitBreaker = true;
    log({
      type: "circuit-open",
      huntId: entry.huntId,
      queryOrder: entry.order,
      page,
      delayMs: circuitOpenMs,
      reason: `${consecutiveFailures}-consecutive-failures`,
    });
  };

  const pacedRequest = async (
    entry: Stage3QueryPlanEntry,
    pageNumber: number,
    cursor: unknown,
  ): Promise<RequestOutcome> => {
    let transientRetried = false;
    let attempt = 0;

    while (true) {
      if (circuitOpenUntil !== null && now() < circuitOpenUntil) {
        return { kind: "stop", reason: "circuit-open" };
      }

      if (lastRequestAt !== null) {
        const jitter = Math.max(0, Math.floor(random() * (jitterMaxMs + 1)));
        const waitMs = Math.max(0, lastRequestAt + minIntervalMs + jitter - now());
        if (waitMs > 0) {
          log({ type: "delay", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, delayMs: waitMs, reason: "request-pacing" });
          await sleep(waitMs);
        }
      }

      attempt += 1;
      lastRequestAt = now();
      const body: Record<string, unknown> = {
        city_ids: entry.city_ids ?? [],
        search_data: {
          form_data: {
            data: { query: { str: { value: entry.query } } },
          },
        },
      };
      if (cursor !== undefined && cursor !== null) body.pagination_data = cursor;

      log({ type: "request", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, attempt });
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        consecutiveFailures += 1;
        rateLimitStreak = 0;
        if (consecutiveFailures >= failureThreshold) openCircuit(entry, pageNumber);
        if (!transientRetried && !stoppedByCircuitBreaker) {
          transientRetried = true;
          log({ type: "retry", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, attempt, delayMs: retryDelayMs, reason: isAbortError(error) ? "timeout" : "transient-network-error" });
          await sleep(retryDelayMs);
          continue;
        }
        return { kind: "stop", reason: stoppedByCircuitBreaker ? "circuit-open" : "network-error" };
      }

      log({ type: "response", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, attempt, status: response.status });

      if (response.status === 429) {
        consecutiveFailures += 1;
        rateLimitStreak += 1;
        log({ type: "rate-limit", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, attempt, status: 429, reason: "http-429" });
        if (consecutiveFailures >= failureThreshold) {
          openCircuit(entry, pageNumber);
          return { kind: "stop", reason: "circuit-open" };
        }
        const cooldownMs = Math.min(rateLimitBaseMs * (2 ** (rateLimitStreak - 1)), rateLimitMaxMs);
        log({ type: "delay", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, delayMs: cooldownMs, reason: "http-429-exponential-backoff" });
        await sleep(cooldownMs);
        continue;
      }

      if (!response.ok) {
        consecutiveFailures += 1;
        rateLimitStreak = 0;
        if (consecutiveFailures >= failureThreshold) openCircuit(entry, pageNumber);
        const transient = response.status === 408 || response.status >= 500;
        if (transient && !transientRetried && !stoppedByCircuitBreaker) {
          transientRetried = true;
          log({ type: "retry", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, attempt, status: response.status, delayMs: retryDelayMs, reason: "transient-http-error" });
          await sleep(retryDelayMs);
          continue;
        }
        return { kind: "stop", reason: stoppedByCircuitBreaker ? "circuit-open" : "http-error" };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        consecutiveFailures += 1;
        rateLimitStreak = 0;
        if (consecutiveFailures >= failureThreshold) openCircuit(entry, pageNumber);
        return { kind: "stop", reason: stoppedByCircuitBreaker ? "circuit-open" : "invalid-json" };
      }
      const parsed = parsePostRows(payload);
      if (!parsed) {
        consecutiveFailures += 1;
        rateLimitStreak = 0;
        if (consecutiveFailures >= failureThreshold) openCircuit(entry, pageNumber);
        return { kind: "stop", reason: stoppedByCircuitBreaker ? "circuit-open" : "invalid-json" };
      }

      consecutiveFailures = 0;
      rateLimitStreak = 0;
      return { kind: "ok", page: parsed };
    }
  };

  const entries = plan.entries.filter((entry) => entry.status === "queued");
  const processedOrders = new Set<number>();
  for (const entry of entries) {
    const pool = poolFor(entry.huntId);
    if (stoppedByCircuitBreaker) {
      markIncomplete(pool, "circuit-open");
      continue;
    }

    let cursor: unknown = undefined;
    let queryStopReason: Stage3StopReason = "no-next-page";
    let queryIncomplete = false;
    let lastPageNumber = 0;

    for (let pageNumber = 0; pageNumber < pageCap; pageNumber += 1) {
      lastPageNumber = pageNumber;
      const outcome = await pacedRequest(entry, pageNumber, cursor);
      if (outcome.kind === "stop") {
        queryStopReason = outcome.reason;
        queryIncomplete = true;
        break;
      }

      const page = outcome.page;
      for (const listing of page.listings) {
        if (pool.seenTokens.has(listing.token)) {
          log({ type: "listing-deduplicated", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, token: listing.token, reason: "duplicate-token-within-hunt" });
          continue;
        }
        pool.seenTokens.add(listing.token);
        pool.listings.push(listing);
        log({ type: "listing-retained", huntId: entry.huntId, queryOrder: entry.order, page: pageNumber, token: listing.token });
      }

      if (page.listings.length === 0) {
        queryStopReason = "empty-page";
        break;
      }
      if (!page.hasNextPage) {
        queryStopReason = "no-next-page";
        break;
      }
      if (pageNumber === pageCap - 1) {
        queryStopReason = "page-cap";
        queryIncomplete = true;
        break;
      }
      if (page.nextCursor === undefined || page.nextCursor === null) {
        queryStopReason = "missing-cursor";
        queryIncomplete = true;
        break;
      }
      cursor = page.nextCursor;
    }

    log({ type: "page-stop", huntId: entry.huntId, queryOrder: entry.order, page: lastPageNumber, reason: queryStopReason });
    if (queryIncomplete) markIncomplete(pool, queryStopReason);
    processedOrders.add(entry.order);
    if (stoppedByCircuitBreaker) {
      markIncomplete(pool, "circuit-open");
      break;
    }
  }

  if (stoppedByCircuitBreaker) {
    for (const entry of entries) {
      if (!processedOrders.has(entry.order)) markIncomplete(poolFor(entry.huntId), "circuit-open");
    }
  }

  const pools = [...poolByHunt.values()].map((pool) => ({
    huntId: pool.huntId,
    listings: pool.listings,
    complete: pool.complete,
    incompleteReasons: pool.incompleteReasons,
  }));
  return { pools, events, stoppedByCircuitBreaker };
}
