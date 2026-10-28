# Stage 4a — BM25, RRF, and dense-score interface

Status: implementation only; real dense model evaluation belongs to Stage 4b on the architect's VM.

## BM25 corpus and canonicalization

- Query text comes from the 70 frozen hunt definitions.
- Candidate documents are **titles only** from frozen-pool-titles.json; descriptions and ad bodies are not indexed.
- Both query and title terms use the Stage 2 canonicalizeForMatch implementation. The observed-token set for the C9a guard is built from the frozen hunt queries and frozen titles.
- IDF and average document length are computed over the complete frozen title corpus (1,399 title rows). Each hunt is ranked only against the frozen candidate rows belonging to that hunt.
- Formula: Okapi BM25, k1=1.2, b=0.75, with ln(1 + (N - df + 0.5)/(df + 0.5)) IDF. Query terms are unique; term frequency is counted in the title. All candidates are returned, including zero-score candidates; ties retain frozen displayed position.
- This is a deterministic baseline, not a relevance judgment or a dense-model result.

## JSON baseline CLI

From PWA_app with Node 24+:

    node --experimental-strip-types scripts/stage4a-bm25-rankings.mjs > stage4a-bm25-rankings.json

Output shape is { "H01": ["token-in-rank-1", "..."], "...": [...] }. The order is ranking order; tokens are identifiers, not grades. For evaluation, resolve a token to its frozen row within the same huntId, recover that row's original position, and join the human grade using (huntId, position). Do not join by position in the ranked list, and do not pool grades across hunts. Ambiguous grades are excluded from relevance metrics and counted separately. Grades 1, 2, and 3 are relevant; grade 0 is not relevant.

## Dense score interface for Stage 4b

fuseBm25WithDense accepts denseRankings[huntId] as an array of { token, score } entries. Higher score means more similar. The fusion code sorts these entries by score descending, assigns 1-based ranks, then computes RRF with the unadjusted k=60. Dense scores are inputs only; this TypeScript module does not load models, encode text, or cache embeddings.

The supplied dense scores must be produced by the real encoder evaluation. For E5, the encoder contract is exactly "query: {hunt query}" and "passage: {title}"; a run without these prefixes is an ablation and must be labeled separately. The MiniLM control follows its own model encoding contract. Synthetic dense inputs in unit tests verify plumbing and arithmetic only; they are not evidence for dense retrieval value.

## Fusion invariant

For each hunt, RRF returns the union of all unique tokens in the BM25 list and the supplied dense list. It only orders candidates; it has no top-N truncation, relevance threshold, hard filter, or deletion path. If a token occurs in both lists, its RRF score is 1/(60 + bm25Rank) + 1/(60 + denseRank); ranks start at 1. A token present in one list receives only that list's contribution.

## Scope boundary

No ONNX dependency, real model execution, embedding cache, vector database, ANN index, retrieval filter, or Stage 4b evaluation was added. Dense retention/removal and the unique-dense-recall gate remain for the architect's real-model experiment.
