/**
 * Portable ranking metrics for mocked-pipeline evaluation.
 *
 * Relationship to `search-quality-benchmark.ts`: that module's
 * `evaluateRanking` intentionally uses a FIXED-K precision denominator
 * (returning fewer than K results scores `relevantReturned / K`). That
 * contract is preserved untouched. THIS module answers a different
 * question — "of what the pipeline actually returned, how much was
 * relevant?" — and is used only by the mocked recall harness, never by
 * production code.
 *
 * Denominators (explicit):
 * - precisionAtK: relevant (grade >= 2) in the returned top slice divided
 *   by the ACTUAL number returned in that slice, i.e. min(K, returned).
 *   Empty results have no items to judge → null (NOT 0: returning nothing
 *   for a pigeon query is correct behavior and must not score like a
 *   five-item all-irrelevant list).
 * - recallAtK: relevant returned / all judged-relevant in the pool.
 *   A pool with no relevant items → null (same convention as the benchmark).
 *   Empty results against a non-empty relevant pool → 0 (total miss).
 * - ndcgAtK: graded `2^grade - 1 / log2(rank+1)` over the returned slice
 *   against the ideal pool ordering sliced to K. Empty → 0.
 */

export interface ActualRankingMetrics {
  readonly precisionAtK: number | null;
  readonly recallAtK: number | null;
  readonly ndcgAtK: number;
  /** Actually returned items in the evaluated slice (<= K). */
  readonly returned: number;
  readonly relevantReturned: number;
  readonly relevantInPool: number;
}

export function evaluateRankingActual(
  rankedIds: readonly string[],
  labels: Readonly<Record<string, number>>,
  k = 5
): ActualRankingMetrics {
  const safeK = Math.max(1, Math.floor(k));
  const top = rankedIds.slice(0, safeK);
  const grade = (id: string): number => labels[id] ?? 0;
  const relevantReturned = top.filter((id) => grade(id) >= 2).length;
  const relevantInPool = Object.values(labels).filter((g) => g >= 2).length;
  const dcg = top.reduce((sum, id, i) => sum + ((2 ** grade(id) - 1) / Math.log2(i + 2)), 0);
  const idealGrades = Object.values(labels).sort((a, b) => b - a).slice(0, safeK);
  const idcg = idealGrades.reduce((sum, g, i) => sum + ((2 ** g - 1) / Math.log2(i + 2)), 0);
  return {
    precisionAtK: top.length === 0 ? null : relevantReturned / top.length,
    recallAtK: relevantInPool === 0 ? null : relevantReturned / relevantInPool,
    ndcgAtK: idcg === 0 ? 0 : dcg / idcg,
    returned: top.length,
    relevantReturned,
    relevantInPool,
  };
}

export interface PoolCandidate {
  readonly id: string;
  readonly relevance: number;
  /**
   * Set for an intentional repost of another candidate: the repost shares
   * the pipeline's dupKey (same title/price/city/district) with its
   * canonical id, so `collapseDupes` keeps exactly one. The pool counts
   * the underlying listing ONCE to avoid inflating denominators.
   */
  readonly repostOf?: string;
}

/**
 * Build the graded label pool for one fixture, excluding intentional
 * reposts. First occurrence of a duplicate id wins; reposts are reported
 * separately so tests can assert the dedupe policy explicitly.
 */
export function buildLabelPool(candidates: readonly PoolCandidate[]): {
  readonly labels: Record<string, number>;
  readonly skippedReposts: string[];
} {
  const labels: Record<string, number> = {};
  const skippedReposts: string[] = [];
  for (const cand of candidates) {
    if (cand.repostOf !== undefined) {
      skippedReposts.push(cand.id);
      continue;
    }
    if (labels[cand.id] === undefined) {
      labels[cand.id] = cand.relevance;
    }
  }
  return { labels, skippedReposts };
}
