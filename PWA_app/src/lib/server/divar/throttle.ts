import "server-only";

import { ProviderError, type ProviderErrorClass } from "./provider";

/**
 * Throttled executor (M3, blueprint §4): ALL provider traffic goes through
 * this single FIFO queue — strictly sequential, one request per second
 * max (~60 req/min/IP), 8s timeout per attempt, ONE retry on transient
 * failures only. Never spin-retry against the quota: a 429 is reported
 * immediately so the pipeline can show «دیوار فعلاً شلوغه».
 */

export type RequestKind = "list" | "detail" | "meta";

const MIN_INTERVAL_MS = 1000;
const ATTEMPT_TIMEOUT_MS = 8000;
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
};

/** Snapshot for instrumentation (M4 gray-zone logging, ops). */
export function getIpHealth(): IpHealth {
  return { ...health };
}

function record(result: "ok" | "rateLimited429" | "forbidden403" | "timeout" | "networkError" | "server5xx") {
  health.total += 1;
  const now = new Date().toISOString();
  if (result === "ok") {
    health.ok += 1;
    return;
  }
  health[result] += 1;
  health.lastErrorAt = now;
  if (result === "rateLimited429") health.last429At = now;
  if (result === "forbidden403") health.last403At = now;
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

export function divarFetch(
  url: string,
  opts: { method: "GET" | "POST"; body?: unknown; kind: RequestKind }
): Promise<unknown> {
  const run = async (): Promise<unknown> => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastStartAt));
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
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw new ProviderError("upstream-down", "Divar unreachable");
  };

  const p = chain.then(run, run);
  // Keep the chain alive even if this request fails.
  chain = p.catch(() => undefined);
  return p;
}
