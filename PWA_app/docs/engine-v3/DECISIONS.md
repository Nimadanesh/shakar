# Binding Decisions — Engine V3

This is the decision ledger. Add new decisions with date, status, evidence, alternatives considered, and consequences. Supersede old decisions explicitly; do not silently rewrite them.

## D001 — Real-user relevance is the primary objective
**Status:** Binding

Optimize the quality of the top results a professional Divar user sees, with special attention to top-5 relevance, critical false positives, and relevant ads wrongly excluded. Do not optimize for passing tests alone, model novelty, result volume, or architecture elegance.

## D002 — Keep V3 isolated
**Status:** Binding

All V3 source and documentation changes occur on `engine_v3`. Never commit V3 work to `main`, deploy it, or mutate production/staging services without separate explicit authorization. Preserve existing branches, pinned candidates, captures, and evaluation artifacts.

## D003 — Evidence before implementation
**Status:** Binding

For any high-impact change, state the observed failure, the hypothesis, the expected measurable effect, the counter-risk, and the acceptance gate before coding. Prefer the smallest change that can falsify the hypothesis. If evidence is insufficient, measure first.

## D004 — Hard constraints are not ranking preferences
**Status:** Binding

A user-confirmed red line must not be rescued by a high relevance score. A soft preference affects ordering, not eligibility. The engine must distinguish at least:
- satisfied by evidence;
- explicitly violated by evidence;
- unknown / insufficient evidence.

Unknown is not the same as absent, false, or satisfied. Unknown evidence must not silently become a hard rejection or a verified claim. Where a hard constraint cannot be verified, apply a clearly specified conservative policy and make the uncertainty auditable.

## D005 — Preserve recall without contaminating precision
**Status:** Binding

Avoid dropping potentially relevant ads solely because seller text omits a feature. But do not mix wrong-kind or explicitly constraint-violating ads into the primary results just to increase recall. Near/relaxed results must be visibly separated and identify which condition was relaxed.

## D006 — Retrieval, interpretation, verification, ranking, and UX are distinct responsibilities
**Status:** Binding

- Query understanding turns user language into a structured hunt contract.
- Retrieval finds a sufficiently broad candidate pool.
- Verification evaluates ad evidence, including details where justified.
- Hard-constraint enforcement decides eligibility.
- Ranking orders eligible candidates with explainable evidence.
- UX lets the user refine intent and constraints.
Do not use an LLM as an opaque substitute for the whole pipeline.

## D007 — Models earn their place through ablation
**Status:** Binding

Mizan or any external/local LLM is not assumed to improve quality. Compare deterministic baseline vs model-assisted variants on the same frozen cases. A model enters the decision path only if it produces a repeatable net quality gain within acceptable latency, cost, reliability, and failure behavior. Model output cannot bypass hard constraints.

## D008 — Frozen evaluations are immutable evidence
**Status:** Binding

Never rerun completed capture cells merely to obtain a more favorable outcome; never modify pinned candidates, human grades, or mappings in place. New experiments get new IDs, versions, and artifacts. If quotas/errors block an experiment, report the failure honestly and stop rather than inventing a workaround that contaminates comparability.

## D009 — No false claims of verification
**Status:** Binding

Clearly distinguish:
- code inspected;
- tests executed;
- synthetic fixtures passed;
- real Divar retrieval executed;
- human judged;
- comparative improvement measured.
These are different evidence levels. Do not claim live or human quality gains from unit tests alone.

## D010 — Progressive hunt UX is a product hypothesis, not an engine-quality shortcut
**Status:** Binding

The staged flow (free text → initial results → refinement based on actual ads → saved hunt) is promising, but must not be allowed to confound the engine baseline. The architecture should support a structured, editable hunt definition and incremental reruns. Evaluate UX effects separately from retrieval/ranking effects.

## D011 — Prefer controlled, reversible changes
**Status:** Binding

One primary hypothesis per experiment where practical. Keep diffs small, testable, and reversible. Avoid unrelated refactors, dependency churn, broad synonym expansion, or architecture rewrites without measured justification.

## D012 — Human judge is an independent evaluator
**Status:** Binding

The user’s grades and notes are ground-truth evidence about perceived output quality, not automatic technical prescriptions. The agent must analyze why a grade changed and choose the technical response independently. Do not cherry-pick only favorable feedback or pressure the judge to approve a preferred design.


## D013 — Styled imitation is a near-miss, not an exact match
**Status:** Binding

When a listing title explicitly says `طرح X` immediately before a term requested by the hunt, the listing represents a styled/imitation sibling and must be capped to `near`, not treated as exact. If the original query explicitly asks for that same `طرح X`, do not demote it. A description-only comparison must not override a clean advertised title. This rule was introduced after live Divar returned `پیانو دیجیتال یاماها طرح آکوستیک` as exact for `پیانو اکوستیک`.

## D014 — Whole-item hunts must not rank part-only listings as near
**Status:** Binding

A confirmed part/accessory listing is not a relaxed match for a hunt for the whole item. Part markers remain subject-aware: `جک ماشین` and `کمک ماشین پراید` must not enter a whole-car hunt, while a real car listing that merely mentions having a jack remains eligible. Add markers only with a live false-positive and paired clean-subject regression test.

## D015 — Live diagnostics are read-only and bounded
**Status:** Binding

Live observation workflows may retrieve public Divar lists/details, but must bound page/detail budgets, disable Mizan when testing deterministic behavior, avoid service mutations, and buffer slug-capture data only in runner-local temporary storage. Live observations are ungraded snapshots, never precision/nDCG or human-quality claims. Larger allocation experiments must disclose the extra diagnostic fetches separately from each simulated per-arm budget.


## D016 — Buyer-seeking rejection is query-scoped
**Status:** Binding (2026-10-23)

An ad explicitly seeking to buy the target item is a critical role mismatch only when the user is running a product hunt with explicit negative repair/replacement-history constraints. In ordinary product hunts, preserve the existing ranker behavior rather than applying a new global hard rejection. This boundary was chosen after the broader rejection caused two existing transaction-direction tests to fail. Acceptance requires both targeted negative-history rejection and preservation of seller-seeking/ordinary-search controls. Current-head live confirmation remains pending because run 39911832666 timed out; passing portable tests are not a substitute for that live check.
