#!/usr/bin/env node
/**
 * Stage 3 research replay CLI. Run from PWA_app with Node 24+:
 *   node --experimental-strip-types scripts/stage3-replay.mjs [output-dir]
 *
 * All search and detail reads are live, sequential, paced, and uncached.
 * This script deliberately imports no code from src/lib/server.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import approvedContracts from "../src/lib/engine-v2-research/data/draft-contracts-70.json" with { type: "json" };
import gradesData from "../src/lib/engine-v2-research/data/stage1-grades-70.json" with { type: "json" };
import frozenCityMap from "../src/lib/engine-v2-research/divar-cities.json" with { type: "json" };
import { deriveStage3QueryPlan } from "../src/lib/engine-v2-research/stage3-query-plan.ts";
import { executeStage3QueryPlan } from "../src/lib/engine-v2-research/stage3-executor.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DETAIL_URL = "https://api.divar.ir/v8/posts-v2/web/";
const USER_AGENT = "ShekarResearch/1.0";
const DETAIL_TIMEOUT_MS = 8_000;
const DETAIL_MIN_INTERVAL_MS = 1_000;
const DETAIL_JITTER_MAX_MS = 250;
const DETAIL_RETRY_DELAY_MS = 1_000;
const DETAIL_RATE_LIMIT_BASE_MS = 60_000;
const DETAIL_RATE_LIMIT_MAX_MS = 600_000;

function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function textValue(value) {
  return typeof value === "string" ? value : null;
}

function parseDetailSections(payload) {
  const root = record(payload);
  return root && Array.isArray(root.sections) ? root.sections : null;
}

/** Extract the specified detail fields without importing the server client. */
export function extractDetailFields(payload) {
  const sections = parseDetailSections(payload);
  if (!sections) return { title: null, description: null, listData: [], categorySlug: null };
  let title = null;
  let description = null;
  let categorySlug = null;
  const listData = [];

  for (const sectionValue of sections) {
    const section = record(sectionValue);
    if (!section || !Array.isArray(section.widgets)) continue;
    if (section.section_name === "TITLE") {
      for (const widgetValue of section.widgets) {
        const widget = record(widgetValue);
        const data = record(widget?.data);
        if (widget?.widget_type === "LEGEND_TITLE_ROW" && data) {
          title = textValue(data.title);
          if (title !== null) break;
        }
      }
    } else if (section.section_name === "DESCRIPTION") {
      for (const widgetValue of section.widgets) {
        const widget = record(widgetValue);
        const data = record(widget?.data);
        if (widget?.widget_type === "DESCRIPTION_ROW" && data) {
          description = textValue(data.text);
          if (description !== null) break;
        }
      }
    } else if (section.section_name === "LIST_DATA") {
      for (const widgetValue of section.widgets) {
        const widget = record(widgetValue);
        const data = record(widget?.data);
        if (widget?.widget_type === "UNEXPANDABLE_ROW" && data) {
          listData.push({ title: textValue(data.title), value: textValue(data.value) });
        }
      }
    } else if (section.section_name === "BREADCRUMB") {
      for (const widgetValue of section.widgets) {
        const widget = record(widgetValue);
        if (widget?.widget_type !== "BREADCRUMB") continue;
        const data = record(widget.data);
        const parentItems = data?.parent_items;
        if (!Array.isArray(parentItems) || parentItems.length === 0) continue;
        const last = record(parentItems[parentItems.length - 1]);
        const action = record(last?.action);
        const payload = record(action?.payload);
        const searchData = record(payload?.search_data);
        const formData = record(searchData?.form_data);
        const form = record(formData?.data);
        const category = record(form?.category);
        const str = record(category?.str);
        categorySlug = textValue(str?.value);
        if (categorySlug) break;
      }
    }
  }
  return { title, description, listData, categorySlug };
}

function defaultSleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * A single fresh detail read. No cache, stale fallback, or server-client import.
 * The caller serializes reads and shares the pacing clock across detail tokens.
 */
export async function readDetailLive(token, state, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const timeoutMs = options.timeoutMs ?? DETAIL_TIMEOUT_MS;
  const minIntervalMs = options.minRequestIntervalMs ?? DETAIL_MIN_INTERVAL_MS;
  const jitterMaxMs = options.jitterMaxMs ?? DETAIL_JITTER_MAX_MS;
  const retryDelayMs = options.transientRetryDelayMs ?? DETAIL_RETRY_DELAY_MS;
  const rateLimitBaseMs = options.rateLimitBaseMs ?? DETAIL_RATE_LIMIT_BASE_MS;
  const rateLimitMaxMs = options.rateLimitMaxMs ?? DETAIL_RATE_LIMIT_MAX_MS;
  let transientRetried = false;
  let rateLimitStreak = 0;
  let attempt = 0;

  while (true) {
    if (state.lastRequestAt !== null && state.lastRequestAt !== undefined) {
      const jitter = Math.max(0, Math.floor(random() * (jitterMaxMs + 1)));
      const waitMs = Math.max(0, state.lastRequestAt + minIntervalMs + jitter - now());
      if (waitMs > 0) {
        state.events.push({ type: "detail-delay", token, delayMs: waitMs, reason: "request-pacing" });
        await sleep(waitMs);
      }
    }

    attempt += 1;
    state.lastRequestAt = now();
    state.events.push({ type: "detail-request", token, attempt });
    let response;
    try {
      response = await fetchImpl(DETAIL_URL + encodeURIComponent(token), {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      if (!transientRetried) {
        transientRetried = true;
        state.events.push({ type: "detail-retry", token, attempt, delayMs: retryDelayMs, reason: error instanceof Error ? error.name : "network-error" });
        await sleep(retryDelayMs);
        continue;
      }
      state.events.push({ type: "detail-response", token, attempt, status: null, sectionsPresent: false, classification: "unclassified", reason: "network-error" });
      return { token, classification: "unclassified", status: null, sectionsPresent: false, reason: "network-error", detail: null };
    }

    state.events.push({ type: "detail-http-response", token, attempt, status: response.status });
    if (response.status === 429) {
      rateLimitStreak += 1;
      const delayMs = Math.min(rateLimitBaseMs * (2 ** (rateLimitStreak - 1)), rateLimitMaxMs);
      state.events.push({ type: "detail-rate-limit", token, attempt, status: 429, delayMs });
      await sleep(delayMs);
      continue;
    }

    if (response.status === 408 || response.status >= 500) {
      if (!transientRetried) {
        transientRetried = true;
        state.events.push({ type: "detail-retry", token, attempt, status: response.status, delayMs: retryDelayMs, reason: "transient-http-error" });
        await sleep(retryDelayMs);
        continue;
      }
      state.events.push({ type: "detail-response", token, attempt, status: response.status, sectionsPresent: false, classification: "unclassified", reason: "transient-http-error" });
      return { token, classification: "unclassified", status: response.status, sectionsPresent: false, reason: "transient-http-error", detail: null };
    }

    if (response.status === 404 || response.status === 410) {
      state.events.push({ type: "detail-response", token, attempt, status: response.status, sectionsPresent: false, classification: "expired", reason: "gone-status" });
      return { token, classification: "expired", status: response.status, sectionsPresent: false, reason: "gone-status", detail: null };
    }

    if (response.status !== 200) {
      state.events.push({ type: "detail-response", token, attempt, status: response.status, sectionsPresent: false, classification: "unclassified", reason: "unexpected-status" });
      return { token, classification: "unclassified", status: response.status, sectionsPresent: false, reason: "unexpected-status", detail: null };
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      state.events.push({ type: "detail-response", token, attempt, status: 200, sectionsPresent: false, classification: "unclassified", reason: "invalid-json" });
      return { token, classification: "unclassified", status: 200, sectionsPresent: false, reason: "invalid-json", detail: null };
    }
    const sections = parseDetailSections(payload);
    const sectionsPresent = sections !== null && sections.length > 0;
    const classification = sectionsPresent ? "live" : "unclassified";
    const reason = sectionsPresent ? "http-200-sections-present" : "http-200-no-sections";
    state.events.push({ type: "detail-response", token, attempt, status: 200, sectionsPresent, classification, reason });
    return {
      token,
      classification,
      status: 200,
      sectionsPresent,
      reason,
      detail: sectionsPresent ? extractDetailFields(payload) : null,
    };
  }
}

function goodTokenRecords(records) {
  return records.filter((item) => Number.isInteger(item.grade) && item.grade >= 1 && item.grade <= 3);
}

/** Join only by (huntId, token); a token's grade in another hunt is irrelevant. */
export function findMissingGoodTokens(grades, pools) {
  const poolTokensByHunt = new Map(pools.map((pool) => [pool.huntId, new Set(pool.listings.map((listing) => listing.token))]));
  return goodTokenRecords(grades).filter((item) => !poolTokensByHunt.get(item.huntId)?.has(item.token));
}

export function buildReplayArtifacts({ plan, executorResult, allHuntIds, grades, detailResults, incremental = false }) {
  const poolByHunt = new Map(executorResult.pools.map((pool) => [pool.huntId, pool]));
  const poolFiles = Object.fromEntries(allHuntIds.map((huntId) => {
    const pool = poolByHunt.get(huntId);
    return [huntId, {
      huntId,
      deltaOnly: incremental,
      complete: pool?.complete ?? false,
      incompleteReasons: pool?.incompleteReasons ?? ["no-queued-query-produced-pool"],
      tokens: (pool?.listings ?? []).map((listing) => listing.token),
      listings: pool?.listings ?? [],
    }];
  }));

  const queuedEntries = plan.entries.filter((entry) => entry.status === "queued");
  const queryStopEvents = executorResult.events.filter((event) => event.type === "page-stop");
  const requestEvents = executorResult.events.filter((event) => event.type === "request");
  const detailRequestEvents = detailResults.flatMap((result) => result.events).filter((event) => event.type === "detail-request");
  const detailEvents = detailResults.flatMap((result) => result.events);
  const retrievalReport = {
    generatedAt: new Date().toISOString(),
    search: {
      planSummary: plan.summary,
      queuedQueryCount: queuedEntries.length,
      requestCount: requestEvents.length,
      pagesRead: requestEvents.length,
      rateLimit429Count: executorResult.events.filter((event) => event.type === "rate-limit" && event.status === 429).length,
      delays: executorResult.events.filter((event) => event.type === "delay"),
      queryStops: queryStopEvents,
      events: executorResult.events,
      stoppedByCircuitBreaker: executorResult.stoppedByCircuitBreaker,
      incompleteHunts: [...poolByHunt.values()].filter((pool) => !pool.complete).map((pool) => ({ huntId: pool.huntId, reasons: pool.incompleteReasons })),
    },
    detail: {
      requestCount: detailRequestEvents.length,
      rateLimit429Count: detailEvents.filter((event) => event.type === "detail-rate-limit").length,
      events: detailEvents,
    },
  };

  const dropped = [];
  for (const event of executorResult.events) {
    if (event.type === "listing-deduplicated") dropped.push({ huntId: event.huntId, token: event.token ?? null, queryOrder: event.queryOrder, page: event.page, reason: event.reason ?? "duplicate-token-within-hunt" });
    else if (event.type === "listing-skipped") dropped.push({ huntId: event.huntId, token: event.token ?? null, queryOrder: event.queryOrder, page: event.page, reason: event.reason ?? "listing-skipped" });
  }
  const sizeDistribution = allHuntIds.map((huntId) => {
    const pool = poolByHunt.get(huntId);
    const requests = requestEvents.filter((event) => event.huntId === huntId).length;
    const pages = requests;
    return { huntId, uniqueTokens: pool?.listings.length ?? 0, requests, pages, complete: pool?.complete ?? false, incompleteReasons: pool?.incompleteReasons ?? ["no-queued-query-produced-pool"] };
  });
  const cityDistribution = allHuntIds.map((huntId) => {
    const listings = poolByHunt.get(huntId)?.listings ?? [];
    const counts = {};
    for (const listing of listings) {
      const city = typeof listing.city === "string" && listing.city.trim() ? listing.city.trim() : "(missing)";
      counts[city] = (counts[city] ?? 0) + 1;
    }
    return { huntId, totalListings: listings.length, cityCounts: counts };
  });

  /** @type {Record<string, string[]>} */
  const overlapInputs = {};
  for (const [huntId, pool] of poolByHunt) {
    for (const listing of pool.listings) {
      overlapInputs[listing.token] ??= [];
      if (!overlapInputs[listing.token].includes(huntId)) overlapInputs[listing.token].push(huntId);
    }
  }

  const missingGood = findMissingGoodTokens(grades, [...poolByHunt.values()]);
  const detailsByKey = new Map(detailResults.map((result) => [result.huntId + "\u0000" + result.token, result]));
  const missingGoodClassified = missingGood.map((item) => {
    const detail = detailsByKey.get(item.huntId + "\u0000" + item.token);
    return {
      huntId: item.huntId,
      token: item.token,
      grade: item.grade,
      classification: detail?.classification ?? "unclassified",
      status: detail?.status ?? null,
      sectionsPresent: detail?.sectionsPresent ?? false,
      reason: detail?.reason ?? "detail-read-not-attempted",
      detail: detail?.detail ?? null,
    };
  });
  const classified = missingGoodClassified.filter((item) => item.classification === "live" || item.classification === "expired");
  const unclassified = missingGoodClassified.filter((item) => item.classification === "unclassified");
  const missingGoodReport = {
    method: "per-hunt (huntId, token) join; grade 1-3 only; each missing good token read at most once per hunt, live/no-cache",
    missingGoodTokenCount: missingGood.length,
    liveButMissedCount: classified.filter((item) => item.classification === "live").length,
    expiredCount: classified.filter((item) => item.classification === "expired").length,
    unclassifiedCount: unclassified.length,
    replayIncompleteDueToUnclassifiedDetails: unclassified.length > 0,
    items: missingGoodClassified,
  };

  return {
    poolFiles,
    retrievalReport,
    dropLog: { count: dropped.length, items: dropped },
    sizeDistribution,
    cityDistribution,
    overlapInputs,
    missingGoodReport,
  };
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function runStage3Replay(options = {}) {
  const outputDir = resolve(options.outputDir ?? join(ROOT, "..", "stage3-replay-output"));
  const fetchImpl = options.fetchImpl ?? fetch;
  const plan = options.plan ?? deriveStage3QueryPlan(approvedContracts.contracts, frozenCityMap.cities);
  const onEvent = options.onEvent;
  const incrementalStatePath = join(outputDir, "incremental-state.json");
  let previousState = { version: 1, hunts: {} };
  try {
    const parsed = JSON.parse(await readFile(incrementalStatePath, "utf8"));
    if (parsed && parsed.version === 1 && parsed.hunts && typeof parsed.hunts === "object") previousState = parsed;
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
  }
  const knownTokensByHunt = Object.fromEntries(Object.entries(previousState.hunts).map(([huntId, state]) => [
    huntId,
    state && Array.isArray(state.knownTokens) ? state.knownTokens.filter((token) => typeof token === "string") : [],
  ]));
  const executorResult = await (options.executePlan ?? executeStage3QueryPlan)(plan, {
    fetchImpl,
    maxPagesPerQuery: 5,
    onEvent,
    knownTokensByHunt,
  });

  // Preserve the same hunt-scoped token identity as the frozen human grades.
  const pools = executorResult.pools;
  const grades = options.grades ?? gradesData.records;
  const missingGood = findMissingGoodTokens(grades, pools);
  const detailState = { lastRequestAt: null, events: [] };
  const detailResults = [];
  for (const item of missingGood) {
    const result = await readDetailLive(item.token, detailState, {
      fetchImpl,
      now: options.now,
      sleep: options.sleep,
      random: options.random,
    });
    detailResults.push({ huntId: item.huntId, grade: item.grade, ...result, events: detailState.events.splice(0) });
    // Carry forward the pacing timestamp, but do not carry old events.
  }

  const allHuntIds = options.allHuntIds ?? approvedContracts.contracts.map((contract) => contract.huntId);
  const artifacts = buildReplayArtifacts({
    plan,
    executorResult,
    allHuntIds,
    grades,
    detailResults,
    incremental: Object.values(previousState.hunts).some((state) =>
      state && Array.isArray(state.knownTokens) && state.knownTokens.length > 0
    ),
  });
  await mkdir(outputDir, { recursive: true });
  const nextHunts = { ...previousState.hunts };
  for (const pool of pools) {
    const prior = nextHunts[pool.huntId];
    const known = new Set([
      ...(prior && Array.isArray(prior.knownTokens) ? prior.knownTokens : []),
      ...pool.listings.map((listing) => listing.token),
    ]);
    const overlap = executorResult.events.find((event) => event.type === "overlap-stop" && event.huntId === pool.huntId);
    nextHunts[pool.huntId] = {
      lastReadAt: new Date().toISOString(),
      knownTokens: [...known],
      lastOverlapToken: overlap?.token ?? null,
      lastRunComplete: pool.complete,
      lastRunIncompleteReasons: pool.incompleteReasons,
    };
  }
  await writeJson(incrementalStatePath, { version: 1, hunts: nextHunts });
  const paths = {
    pools: join(outputDir, "hunt-pools.json"),
    retrievalReport: join(outputDir, "retrieval-report.json"),
    dropLog: join(outputDir, "drop-log.json"),
    sizeDistribution: join(outputDir, "size-distribution.json"),
    cityDistribution: join(outputDir, "city-distribution.json"),
    overlapInputs: join(outputDir, "overlap-inputs.json"),
    missingGood: join(outputDir, "missing-good-classification.json"),
    incrementalState: incrementalStatePath,
    summary: join(outputDir, "summary.json"),
  };
  await Promise.all([
    writeJson(paths.pools, artifacts.poolFiles),
    writeJson(paths.retrievalReport, artifacts.retrievalReport),
    writeJson(paths.dropLog, artifacts.dropLog),
    writeJson(paths.sizeDistribution, artifacts.sizeDistribution),
    writeJson(paths.cityDistribution, artifacts.cityDistribution),
    writeJson(paths.overlapInputs, artifacts.overlapInputs),
    writeJson(paths.missingGood, artifacts.missingGoodReport),
  ]);
  const summary = {
    outputDir,
    paths,
    huntCount: allHuntIds.length,
    unmappedCitySlugs: plan.unmappedCitySlugs,
    ...(plan.unmappedCitySlugs.length > 0 ? { cityMapWarning: `No frozen Divar numeric IDs for city slugs: ${plan.unmappedCitySlugs.join(", ")}` } : {}),
    incompleteHunts: artifacts.sizeDistribution.filter((item) => !item.complete).map((item) => item.huntId),
    searchRequests: artifacts.retrievalReport.search.requestCount,
    detailRequests: artifacts.retrievalReport.detail.requestCount,
    dropCount: artifacts.dropLog.count,
    missingGoodTokenCount: artifacts.missingGoodReport.missingGoodTokenCount,
    liveButMissedCount: artifacts.missingGoodReport.liveButMissedCount,
    expiredCount: artifacts.missingGoodReport.expiredCount,
    unclassifiedCount: artifacts.missingGoodReport.unclassifiedCount,
    replayIncompleteDueToUnclassifiedDetails: artifacts.missingGoodReport.replayIncompleteDueToUnclassifiedDetails,
    incremental: Object.values(previousState.hunts).some((state) =>
      state && Array.isArray(state.knownTokens) && state.knownTokens.length > 0
    ),
    incrementalNote: Object.values(previousState.hunts).some((state) =>
      state && Array.isArray(state.knownTokens) && state.knownTokens.length > 0
    )
      ? "Hunt pools contain only tokens newly found after the last read; the complete known-token set is stored in incremental-state.json."
      : "Full replay; hunt pools are not marked delta-only.",
  };
  await writeJson(paths.summary, summary);
  return summary;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const outputDir = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : resolve(process.cwd(), process.argv[2])) : undefined;
  try {
    const summary = await runStage3Replay({ outputDir });
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } catch (error) {
    process.stderr.write("Stage 3 replay failed: " + (error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
