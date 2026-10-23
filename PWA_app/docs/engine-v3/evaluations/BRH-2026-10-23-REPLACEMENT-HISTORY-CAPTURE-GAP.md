# Replacement-history live-capture gap — 2026-10-23

Branch: `engine_v3`
Status: **no new human-review packet issued; explicit replacement control not captured**
Scope: read-only Divar candidate discovery only. No production semantics, ranking, score, eligibility, or source grades changed.

## Purpose

The next evidence gate after Packet A is a paired, source-matched human review contrasting:
1. ambiguous/indirect condition wording such as `بدون تغییر` / `بدون دستکاری`;
2. an explicit claim that parts are original or have not been replaced;
3. an explicit claim that parts were replaced.

Packet A's locked positive judgment remains B02/P03: the owner judged `بدون تغییر و جابه‌جایی و دستکاری` sufficient evidence of an untouched state. A01/P01 remains a relevant-but-unverified grade 2. These existing grades are reused as historical evidence; they were not regraded.

## Bounded capture attempts

A dedicated read-only workflow was added at [engine-v3-replacement-history-followup.yml](../../../../.github/workflows/engine-v3-replacement-history-followup.yml), with its isolated test [live-replacement-history-followup.test.ts](../../../src/lib/server/hunt/live-replacement-history-followup.test.ts). Every run used two list pages, at most two detail reads, and `MIZAN_SHADOW=0`.

| Run | Artifact / retrieval | What was actually inspected | Outcome |
|---|---|---|---|
| [#1](https://github.com/Nimadanesh/shakar/actions/runs/39949630006) | `پیانو قطعات تعویض شده` | Parts-related listings; details did not describe a specific piano's replacement history | No explicit replacement control |
| [#2](https://github.com/Nimadanesh/shakar/actions/runs/39949663961) | `پیانو قطعات تعویض شده` | Parts listing and repair/maintenance service listing | No explicit replacement control |
| [#3](https://github.com/Nimadanesh/shakar/actions/runs/39949779617) | Target: `پیانو قطعات تعویض شده`; broad discovery: `پیانو` | A lightly used Casio listing with no history claim, and a styled-piano/cabinet sales listing | No explicit replacement control |
| [#4](https://github.com/Nimadanesh/shakar/actions/runs/39949945854) | Target: `پیانو قطعات تعویض شده`; discovery: `پیانو تعویض شده` | A piano book described as little-used and a toy piano | No explicit replacement control; zero title-cue candidates |

All four runs were bounded discovery probes, not representative samples, relevance scores, or paired quality comparisons. The last artifact explicitly reports 48 candidates after filters, two detail reads, and zero title-cue candidates. The selected records do not justify a grade for the intended explicit-replacement condition.

## Decision

- **Do not manufacture an explicit-replacement example** from service offers, spare-parts ads, books, toy pianos, or vague use/condition statements.
- Do not create a purportedly paired blind packet yet: the required third state is missing, and mixing synthetic fixtures with live human evidence would contaminate the evidence record.
- Preserve the locked grades and current engine behavior. Keep `UNKNOWN` distinct; do not infer no replacement from low usage, clean appearance, technician inspection, or generic sales language.
- Stop this particular bounded query path rather than stacking further title-selection heuristics. The next valid input must be a source-captured, specific piano listing whose own description explicitly says a component was replaced, with enough context to distinguish the piano itself from spare parts or repair services. It can then be blinded and judged alongside the already-locked B02/P03 and A01/P01 examples.

## Validation and boundaries

- The isolated observation workflow succeeded on the captured runs. Baseline [run #39949779598](https://github.com/Nimadanesh/shakar/actions/runs/39949779598) on code-bearing SHA `053d0e8`: focused tests, full portable suite, TypeScript, and production build passed; ESLint failed on the known unrelated UI hook-rule errors (8 errors, 37 warnings).
- The latest retrieval-query-only revision is `50a32cbb38b4f5e3d39b1605a578f01ddd40d740`; its baseline was still running when this report was prepared. Do not claim validation for that exact SHA until its workflow completes.
- The observation harness/workflow are test-only. No production ranking change, `main` merge, deployment, or frozen-grade/key edit occurred.
