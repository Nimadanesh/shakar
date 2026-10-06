import "server-only";

import { ProviderError, type ProviderErrorClass } from "./provider";

/**
 * Throttled executor (M3, blueprint §4): ALL provider traffic goes through
 * this single FIFO queue — strictly sequential, ~1 request/second with
 * jitter (never metronomic), 8s timeout per attempt, ONE retry on transient
 * failures only.
 *
 * Anti-footprint posture (the polite client is the invisible client):
 * - Jittered intervals: request timing never looks machine-regular.
 * - 429 → exponential cooldown (60s → 10min max): we back off instead of
 *   hammering, and the pipeline shows the honest «دیوار فعلاً شلوغه» copy.
 * - Circuit breaker: 5 consecutive failures open the circuit for 60s —
 *   a ban/restriction becomes a normal, recoverable state, not a death
 *   spiral of retries.
 * - No identity leaks: the only headers we send are Content-Type, Accept
 *   and a single static UA. No app name, no user ids, no token rotation.
 *
 * What this deliberately does NOT do: proxy rotation for ban evasion,
 * UA/fingerprint spoofing, CAPTCHA bypass. Those are abuse-evasion, they
 * don't survive contact with a real abuse team, and they create new risk.
 * The protection is: small footprint + shared cache + graceful degrade.
 *
 * QUALITY INVARIANT (never weaken): coalescing and caching DEDUPLICATE
 * identical upstream work — every caller receives the COMPLETE response.
 * We never sample, truncate pages, skip details, or silently drop a failed
 * fetch to save time. An ad that exists on Divar must reach the pipeline;
 * a failed detail fetch is "unknown", never a silent drop (M4 enforces
 * this). Latency is spent on UX (honest loading states), never taken
 * from result quality. A fast hunt that misses ads loses the user; a
 * slow hunt that finds them keeps them.
 */

export type RequestKind = "list" | "detail" | "meta";

const BASE_INTERVAL_MS = 1000;
const JITTER_MS = 800;
const ATTEMPT_TIMEOUT_MS = 8000;
const RETRY_PAUSE_MS = 1500;

const COOLDOWN_BASE_MS = 60_000;
const COOLDOWN_MAX_MS = 10 * 60_000;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Safari/537.36";

export interface IpHealth {
  startedAt: string;
  total: number;
  ok: number;
  rateLimited429: number;
  forbidden403: number;
  timeout: number;
  networkError: number;
  server5xx: number;
  last429At: string | null;
  last403At: string | null;
  lastErrorAt: string | null;
  /** 429 backoff currently in effect (null when none). */
  coolingDownUntil: string | null;
  /** Circuit breaker open until (null when closed). */
  circuitOpenUntil: string | null;
  consecutiveFailures: number;
}

const health: IpHealth = {
  startedAt: new Date().toISOString(),
  total: 0,
  ok: 0,
  rateLimited429: 0,
  forbidden403: 0,
  timeout: 0,
  networkError: 0,
  server5xx: 0,
  last429At: null,
  last403At: null,
  lastErrorAt: null,
  coolingDownUntil: null,
  circuitOpenUntil: null,
  consecutiveFailures: 0,
};

/** Snapshot for instrumentation (M4 gray-zone logging, ops). */
export function getIpHealth(): IpHealth {
  const now = Date.now();
  return {
    ...health,
    coolingDownUntil: cooldownUntil > now ? new Date(cooldownUntil).toISOString() : null,
    circuitOpenUntil: circuitOpenUntil > now ? new Date(circuitOpenUntil).toISOString() : null,
  };
}

function record(result: "ok" | "rateLimited429" | "forbidden403" | "timeout" | "networkError" | "server5xx") {
  health.total += 1;
  const now = new Date().toISOString();
  if (result === "ok") {
    health.ok += 1;
    health.consecutiveFailures = 0;
    consecutive429 = 0;
    return;
  }
  health[result] += 1;
  health.consecutiveFailures += 1;
  health.lastErrorAt = now;
  if (result === "rateLimited429") {
    health.last429At = now;
    consecutive429 += 1;
    cooldownUntil =
      Date.now() +
      Math.min(COOLDOWN_BASE_MS * 2 ** (consecutive429 - 1), COOLDOWN_MAX_MS);
  }
  if (result === "forbidden403") health.last403At = now;
  if (health.consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  }
}

function classifyStatus(status: number): { retryable: boolean; errorClass: ProviderErrorClass } {
  if (status === 429) return { retryable: false, errorClass: "rate-limited" };
  if (status === 403) return { retryable: false, errorClass: "upstream-down" };
  if (status >= 500) return { retryable: true, errorClass: "upstream-down" };
  return { retryable: false, errorClass: "bad-request" };
}

async function attempt(
  url: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const { retryable, errorClass } = classifyStatus(res.status);
      const err = new ProviderError(errorClass, `Divar HTTP ${res.status}`, res.status);
      err.retryable = retryable;
      throw err;
    }
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    const err = new ProviderError(
      aborted ? "timeout" : "upstream-down",
      aborted ? "Divar request timed out" : `Divar network error: ${(e as Error).message}`
    );
    err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// The single FIFO chain — every provider request joins this queue.
let chain: Promise<unknown> = Promise.resolve();
let lastStartAt = 0;
let cooldownUntil = 0;
let circuitOpenUntil = 0;
let consecutive429 = 0;

// In-flight request coalescing: identical requests that arrive while one
// is already running ATTACH to it instead of queueing a duplicate.
// 50 users asking for the same list at the same second = 1 upstream
// request, and all 50 receive the identical complete response.
// Quality-neutral by construction: this removes duplicate WORK, never
// duplicate RESULTS. Different bodies (e.g. pagination cursors) are
// different keys and are never merged.
const inFlight = new Map<string, Promise<unknown>>();

function requestKey(url: string, opts: { method: string; body?: unknown }): string {
  return `${opts.method}:${url}:${opts.body !== undefined ? JSON.stringify(opts.body) : ""}`;
}

export function divarFetch(
  url: string,
  opts: { method: "GET" | "POST"; body?: unknown; kind: RequestKind }
): Promise<unknown> {
  const key = requestKey(url, opts);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const run = async (): Promise<unknown> => {
    const now = Date.now();
    // A ban/restriction is a normal state: fail fast, recover on the timer.
    if (now < circuitOpenUntil) {
      throw new ProviderError("upstream-down", "Divar circuit open (cooling down)");
    }
    if (now < cooldownUntil) {
      throw new ProviderError("rate-limited", "Divar cooldown after 429");
    }
    // Jittered interval — never metronomic.
    const interval = BASE_INTERVAL_MS + Math.random() * JITTER_MS;
    const wait = Math.max(0, interval - (now - lastStartAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastStartAt = Date.now();

    for (let attemptNo = 0; attemptNo < 2; attemptNo++) {
      try {
        const json = await attempt(url, { method: opts.method, body: opts.body });
        record("ok");
        return json;
      } catch (e) {
        const perr = e instanceof ProviderError ? e : null;
        const retryable = perr?.retryable === true;
        const errorClass = perr?.errorClass ?? "upstream-down";
        const status = perr?.status;
        if (status === 429) record("rateLimited429");
        else if (status === 403) record("forbidden403");
        else if (errorClass === "timeout") record("timeout");
        else if (status !== undefined && status >= 500) record("server5xx");
        else record("networkError");

        if (!retryable || attemptNo === 1) throw e;
        // One retry only, brief pause — never a spin.
        await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
      }
    }
    throw new ProviderError("upstream-down", "Divar unreachable");
  };

  const p = chain.then(run, run);
  // Keep the chain alive even if this request fails.
  chain = p.catch(() => undefined);
  // Register for coalescing; release when settled (success or failure —
  // a failed request must not poison later identical requests).
  inFlight.set(key, p);
  const release = () => {
    if (inFlight.get(key) === p) inFlight.delete(key);
  };
  p.then(release, release);
  return p;
}
