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

**Start with P0 service-intent correctness, but verify before changing code.**

Why first: it is a high-severity mismatch between what the user asks to find and what the listing actually offers/seeks. The prior R2 review identified it as a weak area, while the current code already contains several targeted deterministic assessments. The right next move is to discover whether the current implementation still fails and at which stage, not to add another heuristic by reflex.

### Experiment E3-SERVICE-ROLE-01

1. Use a small, explicit fixture set with at least these classes:
   - clearly offered refrigerator repair service;
   - refrigerator listed for sale with a repair-needed disclosure;
   - buyer collecting broken refrigerators;
   - repair service for a different appliance;
   - ambiguous listing with no explicit service/offer signal.
2. Run the same fixed inputs through the current pipeline and record query intent, listing role, repair-service assessment, target binding, verdict, score, and reason.
3. Assert only invariants supported by explicit evidence:
   - a clearly relevant service offer must remain eligible;
   - a broken appliance for sale must not be exact for a repair-service hunt;
   - a wrong-appliance service must not be exact;
   - ambiguity remains UNKNOWN/near rather than fabricated certainty;
   - no item is rejected solely because its description is incomplete.
4. If all pass, do not implement a service heuristic; move to the next failure family or test the actual route/candidate coverage.
5. If a failure reproduces, make the smallest patch at the responsible stage and rerun the same fixtures plus the full portable suite.
6. Only after the deterministic failure is localized, plan a fresh, separately identified human comparison. Do not rerun or alter frozen R1 cells, pins, grades, mappings, or denominators.

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
