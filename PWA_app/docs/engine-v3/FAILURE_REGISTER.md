# Engine V3 — Prioritized Failure Register

Updated: 2026-10-22
Scope: hypotheses for the current source baseline, not claims of confirmed defects.

## Operating rule

Every entry starts as a hypothesis. Promote it to a confirmed failure only with a reproducible current-code/live-output trace. Do not change the engine merely because a historical report named the area. Use small reversible experiments, same candidate pools for before/after, and explicit counter-risk checks. Frozen R1 captures, grades, mappings, and pinned candidates remain read-only.

## Ranked hypotheses

| Priority | Failure family | Evidence signal | Why it matters | Next proof |
|---|---|---|---|---|
| P0 | Service intent / wrong listing role | Last-known R2 review targeted S3 because service-intent grades were weak for both engines; current repo source has deterministic service, role-clash, repair-service, and service-target checks. Current behavior has not yet been revalidated against a fixed adversarial set. | A query like «تعمیر یخچال» must find service offers, not rank broken appliances for sale as exact service matches. | Run current deterministic pipeline against a fixed set of service offers, broken-item listings, buyer-collecting-broken listings, wrong-appliance offers, and ambiguous listings. Inspect verdict reasons and top-K, not only test exit status. |
| P1 | Transaction direction | Last-known R2 review targeted S4; direction had been weak in both engines. Current code contains role/direction logic, but no fresh paired evaluation was run in CI. | A user seeking buyers must not be shown sellers as if they satisfy the hunt, and vice versa. | Fixed paired cases for seeking buyer/seller, offering goods, seeking service, and ambiguous role; assert direction and candidate eligibility separately. |
| P1 | Product identity / sibling variant | Prior R2 review described S1 variant detection as an A-side strength; it is a valuable regression guard, not evidence that all variant cases are solved. | «پیانو اکوستیک» must not treat «پیانوی طرح اکوستیک» as exact acoustic identity; similar part/whole confusions can swamp top results. | Pair positive acoustic-piano ads with explicit design/simulated variants and inspect top-5, exact/near verdict, and false rejection. Add «کفی ماشین» vs whole-car adversarial pair. |
| P1 | Hard constraints under UNKNOWN evidence | Project contract requires UNKNOWN to remain distinct from satisfied/violated; CI currently does not run three external-data research harnesses. | Missing detail must not satisfy a MUST or prove a MUST-NOT; hard constraints cannot be silently softened. | Portable tests for missing/stale detail and absence ambiguity; only run the historical gates after their frozen inputs are safely available. |
| P2 | Recall and detail-budget starvation | Pipeline docs describe shortlist/detail budgets and title-first candidate allocation. No current CI test establishes recall below the retained shortlist. | A relevant ad with weak title evidence may never reach detail verification. | Fixed candidate pool with relevant ads deliberately placed at low title scores; measure candidate coverage and top-5 before changing budgets. |
| P2 | Global synonym overreach | Historical roadmap flags bidirectional global synonym groups such as piano/keyboard and fridge/freezer; current normalizer must be checked against actual active groups. | Recall improvements can become false-positive explosions when related products are treated as identities. | Context-specific paired tests: positive synonym case plus near-neighbor negative for each proposed group. No global synonym additions without an ablation. |
| P2 | Mizan runtime/decision role | Current mizan.ts documents log-only/shadow authority; effective behavior depends on runtime configuration and service availability. | A model that silently changes deletions or adds latency without repeatable gain would violate the architecture contract. | Inspect current route/config and runtime traces; verify no deletion authority. Do not make Mizan a required dependency. |

## First experiment recommendation

**Start with P0 service-intent correctness, but do not add more unit fixtures reflexively.**

The current code already has mocked-provider pipeline tests for repairer-vs-fridge-for-sale ranking, provider-form morphology, a fridge needing repair, false service cues such as «در محل», «نیازمند تعمیرکار», the «تعمیری» query guard, and wrong-appliance service-target binding. Those tests passed in the portable suite. The historical R2 concern is therefore not a missing basic unit test; it is whether live retrieval, the candidate/detail budget, or current real listing language still defeats the intended behavior.

### Experiment E3-SERVICE-ROLE-01

1. First read the latest available R2 handoff/results and map any observed bad top results to the existing service-intent tests and pipeline stages. The public evaluation repo currently exposes only the older Phase 1 artifacts, so use the last-known R2 notes cautiously.
2. Preserve all frozen R1 captures, pinned candidates, grades, mappings, and denominators. Do not rerun a completed cell.
3. If the R2 artifacts identify a concrete failure, trace whether it is query intent, provider candidate recall, title-phase prioritization, detail verification, service-target binding, or final ranking. Avoid changing the layer that is not responsible.
4. If the existing R2 evidence cannot be recovered, first use the current portable tests and source trace to define one new, separately versioned read-only observation plan; do not overwrite historical artifacts or imply it is paired with the old candidate pool.
5. If a deterministic failure reproduces, make the smallest patch at the responsible stage and rerun the same fixtures plus the full portable suite.
6. Only after the failure is localized, plan a fresh human comparison on a separately identified sample. Do not rerun or alter frozen R1 cells, pins, grades, mappings, or denominators.

### Evidence required to accept a fix

- Targeted fixture assertions pass.
- Full portable test suite, typecheck, and build pass.
- Any lint debt is reported separately; unrelated UI errors are not swept into this experiment.
- Before/after use the same candidates and the same scoring denominator.
- No increase in critical false positives on the paired negative cases.
- Human top-5 grades are required before claiming real-world quality improvement.

## Current limits

- Run #6 proves portable test/typecheck/build execution only; it does not prove search quality.
- Three historical data-dependent harnesses remain NOT RUN because their frozen inputs are outside the repo.
- Last-known project context says R1a grades were joined 138/138 with mean nDCG@5 A=0.5007, B=0.5539; R1b had not been started/reported. A later R2 review had 12 questions around S3, S4, and S1. Verify latest handoff before acting on these numbers.
