/**
 * nearDup — repost deduplication key (docs/output-quality.md flaw #4).
 *
 * The problem: Divar sellers delete and repost the same ad to bump it.
 * Without dedup, the hunter sees "the same piano" 3 times as 3 results —
 * power users hate this, and it dilutes trust in ranking.
 *
 * The key: normalized title + price + seller. Reposts keep the same title
 * and price; only the ad id changes. This is v1 (cheap, effective);
 * image-hash dedup is a later, expensive step (see output-quality.md).
 *
 * Used by M4's pipeline AFTER matching, BEFORE ranking: collapse dups,
 * keep the newest.
 */
import { normalizeForMatch } from "./persianNormalize";

/** Canonical form of a title for dup comparison (no stemming — strict). */
export function canonicalTitle(title: string): string {
  return normalizeForMatch(title).replace(/\s+/g, " ").trim();
}

/**
 * Dedup key for an ad. Same title + same price (+ same seller when known)
 * = same ad, even across different ad ids (reposts).
 */
export function dupKey(
  title: string,
  price: string | null,
  sellerId?: string | null
): string {
  return [canonicalTitle(title), price ?? "?", sellerId ?? "?"].join("|");
}

/** True if two ads are the same listing reposted. */
export function isRepost(
  a: { title: string; price: string | null; sellerId?: string | null },
  b: { title: string; price: string | null; sellerId?: string | null }
): boolean {
  return dupKey(a.title, a.price, a.sellerId) === dupKey(b.title, b.price, b.sellerId);
}
