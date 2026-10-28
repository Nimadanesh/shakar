# Stage 3 — Short-Query Model (Approval Required)

**Status:** design proposal only — no implementation authorized  
**Branch:** `engine_v2_research`  
**Input contract:** frozen `draft-contracts-70.json`; no contract edits

## Problem and goal

The current plan preserves long entity phrases, but a long phrase can miss live ads whose titles use only the core service/product term. Add short queries as an *incremental recall pass*: retain every existing base and narrow query unchanged, and append a small, deterministic short-query candidate when the contract explicitly supports it. More search requests are acceptable; weakening relevance gates or changing grading is not.

## Contract fields eligible to propose a short term

1. **Entity:** `entity.values` and `entity.sourcePhrase` remain the authoritative subject wording. Split alternatives only with the existing exact delimiter ` یا `; do not rewrite or delete the resulting long base phrases.
2. **Transaction evidence:** for a service contract only, `transactions.status === "confirmed"`, `transactions.values` includes `"service"`, and non-empty `transactions.sourcePhrase` may nominate a short service term. Example evidence already present: H06 `لوله‌بازکنی`; H07 `قالی‌شویی`.
3. **Slots:** a slot may only nominate a short term when `polarity="must"`, `hardness="hard"`, and `status="confirmed"`; exclude `condition`, `location`, `category`, and `price`. Never derive a query term from `mustNot`, soft, or unknown information. Slot values are OR alternatives, not an implicit AND. This is a source-eligibility rule, not permission to change current narrow-query construction.

## Proposed first increment (small and auditable)

- **Pass A — service-core term:** for each service entity alternative, consider the confirmed `transactions.sourcePhrase` as one short-query candidate only when its canonical tokens are present in that alternative's entity wording. Trim whitespace and canonicalize for comparison; preserve the original Persian phrase as query text.
- Keep every current long base query and every current narrow query exactly as-is. Append the short candidate after that entity alternative's existing entries; preserve deterministic ordering and log its source field and decision.
- Do not generate a candidate if the source is missing/unconfirmed, canonical overlap fails, it duplicates an existing query after canonicalization, or it is empty. Deduplicate without deleting or replacing any long query.
- Do not put city names, service-area words, prices, categories, conditions, preferences, or exclusions into query text. The approved city-ID filter remains independent and unchanged.
- Do not change the contract schema or `draft-contracts-70.json`. This first increment deliberately tests the explicit service-term source; broader commodity short-term rules require a separate model revision and approval.

## Falsifiable prediction and acceptance gate

**Prediction:** with only the additive service-core pass enabled, H06 gains a search for `لوله‌بازکنی` and H07 gains a search for `قالی‌شویی`; all pre-existing long queries remain byte-for-byte present and in their prior relative order. On the architect's live replay, this should recover at least one previously missed Stage 1 grade-2/3 live listing for H06 or H07 without removing a previously retrieved listing. This prediction is falsified if either short query is not emitted, a long query disappears/changes, or neither hunt gains a qualifying live graded listing.

**Required evidence before acceptance:** unit tests proving both short candidates are emitted, long phrases are preserved, exclusions/unknown/soft slots do not leak into queries, and duplicates are suppressed; then TypeScript, ESLint, and Stage 3 CI green on the exact head. Finally, the architect runs the approved live probe and inspects H06/H07 retrieval artifacts against frozen Stage 1 grades. Automated green is necessary but not sufficient.

## Approval boundary

This document is the only deliverable in this step. **Do not implement, run a live replay, modify contracts, or begin another component until the architect explicitly approves this model.**
