"use client";

/**
 * Shared ad-detail resolution cache (navid 2026-10-08 perf surgery).
 *
 * Three views each fanned out N identical GET /api/ads/[token] requests on
 * mount — FavoriteAdsList, the /archive cross-tab search, and
 * useFavoriteTitles — each with its own private Map, so opening one view
 * after another re-downloaded the same N ads (2N, 3N round trips).
 *
 * One module-level cache: concurrent requests for the same token share a
 * single in-flight fetch; resolved details live 10 minutes (the server
 * already caches Divar details 60 min — this just stops the client from
 * re-asking). Keyed by the Divar token (sourceAdId).
 */

export interface ResolvedAdDetail {
  title: string;
  price: number | null;
  priceText?: string;
  city: string;
  thumbnail: string | null;
  /** True when the ad is gone/unavailable — callers render honestly. */
  failed: boolean;
}

const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { data: ResolvedAdDetail; at: number }>();
const inflight = new Map<string, Promise<ResolvedAdDetail>>();

async function fetchDetail(token: string): Promise<ResolvedAdDetail> {
  try {
    const res = await fetch(`/api/ads/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error("unavailable");
    const json = (await res.json()) as {
      ok: boolean;
      data?: {
        title?: string;
        price?: number | null;
        priceText?: string;
        city?: string;
        images?: string[];
      };
    };
    if (!json.ok || !json.data) throw new Error("unavailable");
    const d = json.data;
    return {
      title: d.title ?? "",
      price: d.price ?? null,
      priceText: d.priceText,
      city: d.city ?? "",
      thumbnail: d.images?.[0] ?? null,
      failed: false,
    };
  } catch {
    return { title: "", price: null, city: "", thumbnail: null, failed: true };
  }
}

/** Resolve one ad's detail, sharing in-flight requests and cached results. */
export function resolveAdDetail(token: string): Promise<ResolvedAdDetail> {
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && now - hit.at < TTL_MS) return Promise.resolve(hit.data);
  const ongoing = inflight.get(token);
  if (ongoing) return ongoing;
  const p = fetchDetail(token).then((data) => {
    cache.set(token, { data, at: Date.now() });
    inflight.delete(token);
    return data;
  });
  inflight.set(token, p);
  return p;
}

/** Resolve many tokens at once — still one request per token, shared. */
export function resolveAdDetails(tokens: string[]): Promise<Map<string, ResolvedAdDetail>> {
  const unique = [...new Set(tokens)];
  return Promise.all(unique.map(async (t) => [t, await resolveAdDetail(t)] as const)).then(
    (entries) => new Map(entries)
  );
}
