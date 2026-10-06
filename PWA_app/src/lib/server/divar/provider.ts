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
  /** Free-text keywords (normalized Persian). */
  keywords: string[];
  /** e.g. { transaction: "rent" } — provider-level filters when available. */
  attributes?: Record<string, string>;
  /** 0-based page. The executor caps list pages per hunt (pipeline §3). */
  page: number;
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
}

export interface ListingProvider {
  readonly name: string;
  searchLists(q: ListingQuery): Promise<{
    listings: ListingSummary[];
    hasMore: boolean;
    /** Opaque cursor for the next page (pagination_data). */
    nextCursor?: unknown;
  }>;
  getDetail(sourceAdId: string): Promise<ListingDetail>;
}

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
