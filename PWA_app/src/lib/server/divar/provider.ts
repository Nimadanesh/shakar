/**
 * ListingProvider abstraction (M3) — the seam between Shekaar's search
 * pipeline and any listing source. v1 = FirstPartyDivarProvider.
 *
 * SERVER-ONLY. Never import from a client component — the raw provider
 * payloads must never reach the browser. All files in this directory
 * import "server-only" to enforce it at build time.
 */

export interface ListingQuery {
  /** Divar API category value, e.g. "apartment-sell". "" = all categories. */
  categorySlug: string;
  /** Divar numeric city id as string, e.g. "1" (Tehran). "" = all cities. */
  cityId: string;
  priceMin?: number;
  priceMax?: number;
  /** Free-text keywords (normalized Persian) — sent as the API text query. */
  keywords: string[];
  /** e.g. { transaction: "rent" } — provider-level filters when available. */
  attributes?: Record<string, string>;
  /**
   * 0-based logical page (cache key + progress only). Real pagination is
   * cursor-based: pass the previous response's nextCursor here.
   */
  page: number;
  /**
   * Opaque cursor from the previous page's response (Divar's
   * pagination.data). Sent as top-level `pagination_data` — without it
   * every request returns page 0 (finding #1, bug-bounty 2026-10-06).
   */
  cursor?: unknown;
}

export interface ListingSummary {
  /** Divar post token — the stable cross-call identity. */
  sourceAdId: string;
  title: string;
  /** Toman. null = UNKNOWN price (never 0) — unknown-price ads stay in
   *  results with a «قیمت نامشخص» warning per the pre-backend contract. */
  price: number | null;
  /** Raw price text from the card, e.g. "۸۰۰,۰۰۰,۰۰۰ تومان". */
  priceText?: string;
  city: string;
  district?: string;
  thumbnail?: string;
}

export interface ListingDetail extends ListingSummary {
  /** Full description text — critical for the include/exclude rules. */
  description: string;
  images: string[];
  categorySlug: string;
  postedAt?: string;
  /**
   * True when served from stale cache during a Divar restriction — the
   * data may be up to DETAIL_TTL_MS old (price changed, ad deleted).
   * Finding #1 (bug-bounty round 6): a stale detail is NOT verified data;
   * the pipeline must treat it like a failed fetch, never as confirmation.
   */
  stale?: boolean;
}

export interface ListingProvider {
  readonly name: string;
  searchLists(q: ListingQuery): Promise<{
    listings: ListingSummary[];
    hasMore: boolean;
    /** Opaque cursor for the next page (pagination_data). */
    nextCursor?: unknown;
    /** True when served from stale cache during a Divar restriction. */
    stale?: boolean;
  }>;
  getDetail(sourceAdId: string): Promise<ListingDetail>;
}

/**
 * Per-hunt request budgets (blueprint §3 cost cascade). Enforced by M4's
 * pipeline, declared here so the footprint ceiling is visible in one place:
 * a single hunt can never cost more than 20 list pages + 100 details, and
 * the shared TTL cache means concurrent identical hunts cost ~zero extra.
 * 20 pages ≈ 500 ads — the miss-free default (navid 2026-10-06).
 */
export const MAX_LIST_PAGES_PER_HUNT = 20;
export const MAX_DETAILS_PER_HUNT = 100;

/** Failure classes mapped to the blueprint §5 Persian copy. */
export type ProviderErrorClass =
  | "rate-limited"
  | "timeout"
  | "upstream-down"
  | "bad-request";

export class ProviderError extends Error {
  readonly errorClass: ProviderErrorClass;
  readonly status?: number;
  /** Set by the executor: this failure is worth one retry (never for 429). */
  retryable?: boolean;
  constructor(errorClass: ProviderErrorClass, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.errorClass = errorClass;
    this.status = status;
  }
}

/** Untyped JSON from Divar's API — narrowed at each use site. */
export type DivarJson = Record<string, unknown>;
