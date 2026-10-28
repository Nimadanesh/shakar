import { canonicalizeForMatch } from "./persian-canonicalize.ts";

export interface FrozenHuntQuery {
  readonly huntId: string;
  readonly query: string;
}
export interface FrozenTitleAd {
  readonly huntId: string;
  readonly position: number;
  readonly title: string;
  readonly adToken: string;
}
export interface Bm25Document {
  readonly huntId: string;
  readonly position: number;
  readonly token: string;
  readonly title: string;
  readonly terms: readonly string[];
}
export interface Bm25RankedToken {
  readonly token: string;
  readonly score: number;
}
export interface DenseScoreEntry {
  readonly token: string;
  readonly score: number;
}
export interface FusedRankedToken {
  readonly token: string;
  readonly score: number;
  readonly bm25Rank: number | null;
  readonly denseRank: number | null;
}
export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
export const RRF_K = 60;

/**
 * Canonicalizes queries and titles with the Stage 2 canonicalizer.
 * The C9a observed-token set comes from frozen hunt queries and titles;
 * candidate document terms are title-only (never descriptions).
 */
export function canonicalizeFrozenCorpus(
  hunts: readonly FrozenHuntQuery[],
  ads: readonly FrozenTitleAd[],
): { readonly documents: readonly Bm25Document[]; readonly queryTerms: ReadonlyMap<string, readonly string[]> } {
  const observedSurfaceTokens = new Set<string>();
  for (const text of [...hunts.map((hunt) => hunt.query), ...ads.map((ad) => ad.title)]) {
    for (const token of canonicalizeForMatch(text).tokens) observedSurfaceTokens.add(token);
  }
  const documents = ads.map((ad): Bm25Document => ({
    huntId: ad.huntId,
    position: ad.position,
    token: ad.adToken,
    title: ad.title,
    terms: canonicalizeForMatch(ad.title, { corpusTokens: observedSurfaceTokens }).tokens,
  }));
  const queryTerms = new Map<string, readonly string[]>();
  for (const hunt of hunts) {
    queryTerms.set(hunt.huntId, canonicalizeForMatch(hunt.query, { corpusTokens: observedSurfaceTokens }).tokens);
  }
  return { documents, queryTerms };
}

/** Okapi BM25; IDF = ln(1 + (N - df + 0.5) / (df + 0.5)). */
export function scoreBm25(
  queryTerms: readonly string[],
  document: Pick<Bm25Document, "terms">,
  corpus: readonly Pick<Bm25Document, "terms">[],
  k1 = BM25_K1,
  b = BM25_B,
): number {
  if (corpus.length === 0 || queryTerms.length === 0) return 0;
  const averageLength = corpus.reduce((sum, item) => sum + item.terms.length, 0) / corpus.length;
  const documentLength = document.terms.length;
  const frequencies = new Map<string, number>();
  for (const term of document.terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const uniqueQueryTerms = new Set(queryTerms);
  let score = 0;
  for (const term of uniqueQueryTerms) {
    const tf = frequencies.get(term) ?? 0;
    if (tf === 0) continue;
    const df = corpus.reduce((count, item) => count + (item.terms.includes(term) ? 1 : 0), 0);
    const idf = Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5));
    const lengthNorm = 1 - b + b * (averageLength > 0 ? documentLength / averageLength : 0);
    score += idf * (tf * (k1 + 1)) / (tf + k1 * lengthNorm);
  }
  return score;
}

/**
 * Uses IDF and average length from the full title corpus. Every candidate is
 * returned, including zero-score titles. Stable ties preserve frozen position.
 */
export function rankBm25(
  queryTerms: readonly string[],
  candidates: readonly Bm25Document[],
  corpus: readonly Bm25Document[],
): Bm25RankedToken[] {
  return candidates
    .map((document, index) => ({
      token: document.token,
      score: scoreBm25(queryTerms, document, corpus),
      position: document.position,
      index,
    }))
    .sort((a, b) => b.score - a.score || a.position - b.position || a.index - b.index)
    .map(({ token, score }) => ({ token, score }));
}

/** Returns huntId -> all tokens ordered by BM25, ready for JSON export. */
export function rankFrozenTitlesByHunt(
  hunts: readonly FrozenHuntQuery[],
  ads: readonly FrozenTitleAd[],
): Record<string, string[]> {
  const { documents, queryTerms } = canonicalizeFrozenCorpus(hunts, ads);
  const output: Record<string, string[]> = {};
  for (const hunt of hunts) {
    const candidates = documents.filter((document) => document.huntId === hunt.huntId);
    output[hunt.huntId] = rankBm25(queryTerms.get(hunt.huntId) ?? [], candidates, documents)
      .map((entry) => entry.token);
  }
  return output;
}

function firstRanks(tokens: readonly string[]): Map<string, number> {
  const ranks = new Map<string, number>();
  tokens.forEach((token, index) => {
    if (!ranks.has(token)) ranks.set(token, index + 1);
  });
  return ranks;
}
function denseOrder(entries: readonly DenseScoreEntry[]): string[] {
  return entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.token);
}

/**
 * RRF is ranking-only: returns the union of BM25 and dense tokens, no cutoff.
 * Dense entries must come from an encoder that uses "query: " for queries and
 * "passage: " for titles when the selected model requires E5 prefixes.
 */
export function fuseBm25WithDense(
  bm25Rankings: Readonly<Record<string, readonly string[]>>,
  denseRankings: Readonly<Record<string, readonly DenseScoreEntry[]>>,
): Record<string, FusedRankedToken[]> {
  const huntIds = [...new Set([...Object.keys(bm25Rankings), ...Object.keys(denseRankings)])].sort();
  const output: Record<string, FusedRankedToken[]> = {};
  for (const huntId of huntIds) {
    const bm25 = firstRanks(bm25Rankings[huntId] ?? []);
    const dense = firstRanks(denseOrder(denseRankings[huntId] ?? []));
    const tokens = new Set([...bm25.keys(), ...dense.keys()]);
    output[huntId] = [...tokens].map((token) => {
      const bm25Rank = bm25.get(token) ?? null;
      const denseRank = dense.get(token) ?? null;
      const score = (bm25Rank === null ? 0 : 1 / (RRF_K + bm25Rank)) +
        (denseRank === null ? 0 : 1 / (RRF_K + denseRank));
      return { token, score, bm25Rank, denseRank };
    }).sort((a, b) =>
      b.score - a.score ||
      (a.bm25Rank ?? Number.POSITIVE_INFINITY) - (b.bm25Rank ?? Number.POSITIVE_INFINITY) ||
      (a.denseRank ?? Number.POSITIVE_INFINITY) - (b.denseRank ?? Number.POSITIVE_INFINITY) ||
      a.token.localeCompare(b.token)
    );
  }
  return output;
}
