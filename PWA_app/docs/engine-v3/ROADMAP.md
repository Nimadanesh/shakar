# Engine V3 Roadmap

The roadmap is gated: a phase advances only when its exit criteria are met. Calendar time or code completion alone does not justify advancement.

## Phase 0 — Establish baseline (current)
**Goal:** Know exactly what exists, what is measured, and what must not be disturbed.

Work:
- inspect branch, recent merge, relevant source, test inventory, docs, runtime configuration;
- locate existing frozen human-evaluation datasets, pinned candidates, grades, and known gaps;
- run available local checks only in a controlled environment, recording exact commands and failures;
- define a small fixed smoke suite and a human top-result rubric, reusing prior artifacts where possible;
- produce a prioritized failure/risk register.

Exit gate:
- baseline report cites exact commit and files;
- tests/checks are labelled executed/not executed;
- existing evaluation assets are identified and protected;
- each P0/P1 risk has evidence, impact, and a next measurement or repair.

## Phase 1 — Critical correctness and evidence contract
**Goal:** Eliminate catastrophic mistakes before tuning relevance.

Audit and test:
- correct entity/kind (whole item vs component/accessory);
- query polarity and explicit negation;
- service vs goods intent;
- transaction role/direction;
- price/city/category hard constraints and how unknown data behaves;
- stale/failed detail handling;
- no irrelevant results admitted through empty or malformed query definitions.

Exit gate:
- deterministic regression tests for each proven failure;
- no known critical constraint violation in the fixed adversarial suite;
- false-rejection samples are also audited, not only visible false positives.

## Phase 2 — Retrieval coverage and candidate allocation
**Goal:** Find relevant ads without spending the detail budget on easy but redundant candidates.

Audit:
- Divar query/filter behavior and pagination;
- category-specific retrieval paths and supported filters;
- duplicate collapse and the risk of over-collapsing distinct sellers;
- candidate ordering/diversity before detail fetch;
- detail budget allocation and coverage gaps;
- incomplete/stale/partial retrieval reporting.

Exit gate:
- fixed queries show measurable relevant-candidate coverage improvement or a clearly justified tradeoff;
- no silent claim that a partial sample represents the whole market;
- request volume, latency, rate limits, and failure handling remain acceptable.

## Phase 3 — Ranking by evidence
**Goal:** Make the best genuinely relevant ads appear first.

Work:
- define explainable score features and a frozen evaluation rubric;
- separate eligibility from ranking;
- evaluate exact/near/unknown evidence behavior;
- compare changes using paired queries and human grades;
- inspect both false positives and false negatives.

Exit gate:
- improvement on the chosen top-5 metric across the fixed suite, not a single anecdotal query;
- no regression in critical-error rate;
- no major scenario-specific regressions hidden by an average.

## Phase 4 — Controlled decision-model experiments
**Goal:** Use Mizan/LLMs only where they measurably outperform simpler logic.

Work:
- define a labeled ambiguity set;
- compare deterministic-only, Mizan-assisted, and optional cheap-LLM fallback variants;
- log confidence, disagreements, latency, and failure behavior;
- keep model access fail-safe and hard constraints outside model authority.

Exit gate:
- repeatable gain over baseline, acceptable runtime/cost, and a documented fallback;
- otherwise keep the model in shadow or remove it from the critical path.

## Phase 5 — Progressive hunt workflow integration
**Goal:** Let users refine hunts after seeing actual market results without destabilizing the engine.

Work:
- start with free text and an honest initial result set;
- infer editable structured fields but require user confirmation where ambiguity matters;
- show live counts and condition-level deltas only when backed by valid retrieval/statistics;
- distinguish hard constraints, preferences, unknown evidence, and relaxed/near results;
- support reversible changes and transparent zero-result recovery;
- preserve a stable definition version for every hunt run.

Exit gate:
- users can identify why results changed and reverse the change;
- result quality is not worse than the fixed engine baseline;
- UX evaluation is separate from engine-ranking evaluation.

## Phase 6 — Contest rehearsal and adversarial evaluation
**Goal:** Reduce surprises from unseen judge queries.

Work:
- create hidden/held-out adversarial cases across categories and intents;
- include typo/morphology, synonyms, wrong-kind, negation, incomplete details, price/city, service intent, transaction direction, and sparse inventory;
- test repeated queries and failure modes;
- perform red-team review of the top results and rejected samples;
- prepare a concise demo/repro protocol.

Exit gate:
- no unresolved critical failure without explicit mitigation;
- metrics and limitations are reproducible;
- a rollback-safe release candidate is selected.

## Priority rule

When time or compute is constrained, prioritize:
1. catastrophic irrelevant top results and hard-constraint violations;
2. false negatives / retrieval coverage;
3. top-5 ordering;
4. latency and reliability;
5. progressive UX polish.

Reorder only when new evidence shows a higher expected contest impact.
