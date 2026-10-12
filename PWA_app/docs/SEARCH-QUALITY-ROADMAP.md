# Search Quality Engine Roadmap

Status date: 2026-10-09
Repository: `Nimadanesh/shakar`
Scope: `PWA_app/src/lib/server/hunt/**`, search-only normalization/interpretation/provider code, and directly related search tests/docs. No UI, non-search product behavior, auth, billing, quotas, Radar/Kamin semantics, or deployment configuration changes unless a search-quality fix demonstrably requires a narrowly scoped change and is explicitly reviewed.

## Operating contract

- Every implementation step is isolated on `feat/search-quality-engine-v1`; `main` remains the rollback point.
- Keep each step small, testable, and independently revertible.
- Do not add Laya or make an LLM a required dependency. No OpenRouter key is needed for the initial deterministic phases.
- Preserve public API shapes, streaming event contracts, cache/settlement behavior, hunt quotas, and UI behavior.
- A step is complete only after code review, relevant tests, typecheck, and an explicit report. Do not claim live quality improvement from unit tests alone.
- Never treat an absent attribute in an ad as proof that the attribute is absent in reality.
- Never let a synonym expansion turn a related-but-distinct product into an exact identity match.

## Baseline facts observed in source

- Current main at start: `bb27c76928602572a525b8ea0b61378ea475f0ab` (2026-10-09; latest commit message reports 498 tests passed, 1 skipped, and typecheck green; these are commit-reported results, not a fresh run in this session).
- Search flow already has cursor-based Divar retrieval, category/city/price interpretation, title scoring, near-duplicate collapse, detail verification, MUST/SHOULD/MUST-NOT/UNKNOWN verdicts, and explainable score fields.
- `persianNormalize.ts` currently uses a global bidirectional synonym index. High-risk groups include apartment/unit/suite, piano/keyboard, refrigerator/freezer, and cooler/split AC. The code comment itself acknowledges category context for keyboard, but the matcher does not enforce that context.
- Ranking currently prioritizes title evidence over description evidence with fixed weights; unknown mandatory terms are penalized, and exact matches are sorted before near matches. This is a useful baseline, but its quality is not yet validated against a labeled query/ad set.
- The current shortlist and detail budget can affect recall: only the top title-strength candidates receive detail fetches. Any ranking change must test whether relevant ads are pushed outside this budget.
- Search quality docs record previous live incidents. Their fixes must be preserved as regression tests; historical anecdotes are not a substitute for a repeatable evaluation set.

## Roadmap — ordered gates

### Step 1 — Source audit and rollback boundary (current)
- Record the current main SHA and create this isolated branch.
- Map the query → interpretation → Divar retrieval → candidate filtering/dedup → detail verification → ranking flow.
- Identify high-risk quality defects and define the evaluation protocol.
- Exit gate: roadmap committed; no production code changed; rollback is simply returning to main.

### Step 2 — Build a repeatable search-quality benchmark (implemented; execution pending) (implemented; execution pending)
- Added `src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, with 13 deterministic Persian query cases and human-authored graded candidate labels (0–3).
- Coverage: Persian spelling/Arabic-keyboard variants, plural/ZWNJ, exact model identifiers, category collisions, negation, preference-vs-MUST, city/district, price, condition, transaction, unknown attributes, ambiguity, and reposts.
- Added metric helpers for Precision@K, Recall@K (with the judged-pool denominator explicit), and nDCG@K; added tests for metric arithmetic, dataset integrity, slice coverage, and current normalization anchors.
- This is a seed benchmark, not yet a statistically representative dataset. It does not claim production Precision/Recall and does not automatically grade live Divar results. Expand labels with reviewed real-result judgments before claiming user-level quality.
- Exit gate: run focused test, full test, typecheck and lint in a real Node environment; intentionally perturb metric/fixture behavior to confirm regression tests fail. Then record a baseline report before Step 3 changes.

### Step 3 — Fix synonym semantics without sacrificing recall
- Replace global synonym equivalence with explicit concept metadata: canonical concept, aliases, related-but-not-equivalent concepts, applicable categories, and confidence/expansion policy.
- Exact aliases may normalize to one concept. Related concepts (e.g. suite vs apartment, fridge vs freezer, piano vs keyboard) must not become bidirectional exact matches by default.
- Keep expansion for candidate retrieval distinct from mandatory matching. An expanded retrieval term must not automatically become a MUST requirement or proof of exact relevance.
- Add tests for both positive aliases and hard negatives, including category-sensitive keyboard meanings.
- Exit gate: known false-positive fixtures are rejected while spelling/morphology recall fixtures still pass.

### Step 4 — Canonical intent and deterministic constraint audit
- Verify parsing of MUST, SHOULD, MUST-NOT, UNKNOWN; city/district; price min/max; transaction; condition; category; model identifiers; and negation scope.
- Rules remain deterministic for numbers, Persian digits, negation, known entities, city/category, and explicit filters.
- Preserve UNKNOWN for unmentioned or unverified attributes. Resolve ambiguous wording conservatively rather than inventing a user intent.
- Exit gate: parser fixture suite passes, with conflict and ambiguity cases explicitly represented.

### Step 5 — Multi-query candidate retrieval (only where justified)
- Measure current Divar query semantics, cursor behavior, category/city scope, cache effects, and page ordering using reproducible probes.
- Add controlled alternate retrieval queries only when the benchmark proves a recall gap. Fuse candidates by stable ad ID, deduplicate without collapsing distinct sellers/items, and retain retrieval provenance.
- Do not add an embedding database or paid external service in this phase. Semantic retrieval is deferred until evidence shows deterministic retrieval is insufficient.
- Exit gate: measurable recall gain with no unacceptable false-positive or latency regression; provider contract and pagination regression tests pass.

### Step 6 — Calibrated, explainable ranking
- Compare the existing score against benchmark baselines before changing weights.
- Rank on concept identity, mandatory evidence, exact model/variant, category, location, explicit price compatibility, condition/transaction contradictions, preferences, freshness, and evidence quality.
- Missing information is UNKNOWN, not a negative fact. Explicit contradictions remain hard exclusions; SHOULD absence does not penalize.
- Protect the detail-fetch budget: compare relevant-result recall before and after shortlisting.
- Exit gate: ranking improves Precision@5 / nDCG@10 against baseline and does not regress critical category slices or core invariants.

### Step 7 — Live user evaluation and telemetry review
- With the user's help, run a fixed set of real queries against the deployed test environment, record anonymized query IDs and result IDs, and label top results relevant / near / irrelevant.
- Compare the same queries against the baseline commit where feasible. Review real zero-result reports, false positives, missing relevant ads, duplicates, latency, stale results, and provider errors.
- Use existing Supabase/Railway logs only if needed and authorized. Do not log secrets or unnecessary personal data. No schema/deployment changes without an explicit necessity and review.
- Exit gate: written before/after report with query count, category coverage, Precision@5, latency, failures, and unresolved limitations. User feedback is required; the assistant must not fabricate user tests.

### Step 8 — Regression hardening and final polish
- Run the complete test, lint, typecheck, and build suite.
- Review all changed files against scope boundaries; confirm no UI or unrelated behavior changed.
- Verify branch diff, rollback instructions, deployment-safe behavior, and a concise operational handoff.
- Exit gate: all checks reported truthfully, no unresolved critical regressions, and user approval before production merge/deploy.

## Quality definitions

- Precision@5 = relevant results among the first five / number of results returned among the first five.
- Recall@10 = relevant known benchmark ads returned in the first ten / all relevant benchmark ads available in that benchmark's candidate pool. State this denominator explicitly.
- nDCG@10 = rank-sensitive graded relevance score over the first ten.
- Zero-result rate = benchmark queries with no results / total benchmark queries.
- Hard-negative false-positive rate = explicitly irrelevant hard-negative ads that enter the evaluated top-k / evaluated hard-negative ads.
- Latency = end-to-end hunt duration, reported as median and p95 when sample size permits.

## Session handoff

Current completed work: Step 1 source audit and roadmap; Step 2 benchmark fixture, metric helpers, and tests committed on `feat/search-quality-engine-v1`. Baseline commit: `bb27c76928602572a525b8ea0b61378ea475f0ab`.
Step 2 validation still requires running focused/full tests, typecheck, and lint in a Node environment. Do not change production ranking or synonym behavior until the benchmark's execution results are recorded.
