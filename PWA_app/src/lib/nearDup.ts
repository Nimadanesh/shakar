/**
 * nearDup — repost deduplication key (docs/output-quality.md flaw #4).
 *
 * The problem: Divar sellers delete and repost the same ad to bump it.
 * Without dedup, the hunter sees "the same piano" 3 times as 3 results —
 * power users hate this, and it dilutes trust in ranking.
 *
 * The key: normalized title + price + city + district. Seller identity
 * would be the ideal signal, but the provider never supplies it
 * (ListingSummary has no seller field — bug #18, round 4). City+district
 * is the honest proxy: same title+price in the same district is far more
 * likely one seller's repost than two sellers' coincidence.
 *
 * HONEST LIMITATION: false positives remain possible — two different
 * sellers with the same popular item at the same round price in the same
 * district WILL collapse. This is documented in output-quality.md flaw #4.
 * Do not claim this is fixed until seller identity is available.
 *
 * Used by M4's pipeline AFTER matching, BEFORE ranking: collapse dups in
 * fetch order (newest first), keep the first = newest (bug #19, round 4).
 */
import { normalizeForMatch } from "./persianNormalize";

/** Canonical form of a title for dup comparison (no stemming — strict). */
export function canonicalTitle(title: string): string {
  return normalizeForMatch(title).replace(/\s+/g, " ").trim();
}

/**
 * Dedup key for an ad. Same title + same price + same city + same district
 * = same ad, even across different ad ids (reposts).
 *
 * NOTE (bug #18): sellerId was the original third signal, but no caller
 * ever provided it — the provider has no seller field. It was dead weight
 * that made every ad look like every other seller's ad. Replaced by
 * city+district, which the provider DOES supply.
 */
export function dupKey(
  title: string,
  price: string | null,
  city?: string | null,
  district?: string | null
): string {
  return [canonicalTitle(title), price ?? "?", city ?? "?", district ?? "?"].join("|");
}

/** True if two ads are the same listing reposted. */
export function isRepost(
  a: { title: string; price: string | null; city?: string | null; district?: string | null },
  b: { title: string; price: string | null; city?: string | null; district?: string | null }
): boolean {
  return (
    dupKey(a.title, a.price, a.city, a.district) ===
    dupKey(b.title, b.price, b.city, b.district)
  );
}
