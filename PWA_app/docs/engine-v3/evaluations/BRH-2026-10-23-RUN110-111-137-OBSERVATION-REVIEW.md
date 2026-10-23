# Observation Review — Runs 110, 111, and Baseline 137

Date: 2026-10-23  
Branch under review: `engine_v3`  
Review scope: read-only artifact inspection and hosted baseline validation. No engine code or ranking behavior changed as part of this review.

## Execution status

| Run | Purpose | Source SHA in artifact | Outcome |
|---|---|---|---|
| [Observation 110](https://github.com/Nimadanesh/shakar/actions/runs/39937776775) | Bounded live observation, including exchange/paint control | `2070ae6147f720c8a7e407602b1196a15cee871c` | Job succeeded; artifact available |
| [Observation 111](https://github.com/Nimadanesh/shakar/actions/runs/39937808023) | Same bounded observation after paint-cue whitespace fix | `b81451c8d3dc6a1eb80e24fac6f9a992c03db562` | Job succeeded; artifact available |
| [Baseline 137](https://github.com/Nimadanesh/shakar/actions/runs/39937776904) | Focused/full portable tests, TypeScript, ESLint, production build | Workflow job failed at ESLint | Tests/typecheck/build passed; lint debt remains |

The observation jobs completed successfully and uploaded artifacts. The artifacts are explicitly marked as unjudged observations, not relevance scores or paired quality comparisons.

## Observation 110 → 111: what changed

The observation harness correction in `b81451c8` fixed the paint-cue regular expression from a literal escaped backslash sequence to actual whitespace matching (`\\s*`). The artifact's diagnostic count changed accordingly:

- Run 110: `paintHintCandidates = 0`.
- Run 111: `paintHintCandidates = 3`.

This confirms the **observer's cue matching** was repaired. It does not establish a search-quality improvement or a production-engine change.

For query `معاوضه سمند رنگ دارد`, both runs inspected the same two title candidates:
- `سمند ال ایکس مدل ۹۷ کارکرد ۱۸۷ رنگ دارد شاسی پلمپ`
- `سمند مدل ۱۳۹۴ یک در رنگ دارد شاستی ها سالم`

Both were `near`, with `معاوضه` missing and no explicit exchange cue in the listing audit. Thus, neither is a valid complete target-side contradiction case: the observation did not produce a candidate with both an explicit exchange relation and target-scoped positive paint evidence. The current artifact does **not** resolve the exchange-polarity decision gate.

The flatbed exchange control still returned two `exact` results in both observations. This is a useful retrieval sanity check, not evidence about Samand paint polarity.

## Role regression observation included in run 111

The second artifact in run 111 compares `فروشنده یخچال` and `یخچال`. Both queries returned the same two listings in the same order:
1. `فروش یخچال` — role estimate `product`, `exact`, score 3.5.
2. `یخچال فریزر نیم ساید فروشنده /و خریدار` — role estimate `buyer-seeking`, `exact`, score -0.5.

The second listing is correctly identified as buyer-seeking by the listing-role audit and has a lower score, but it remains `exact` and appears second under both query intents. This is a **diagnostic signal only**: the sample is two ads, the source-matched human judgments are not included in these artifacts, and no paired baseline-quality comparison was run. Do not infer a general role-intent failure or change ranking from this alone. Continue with the blinded source-matched review packet already prepared for this contrast.

## Baseline 137

Hosted results:
- Focused hunt/search suite: **286 passed, 6 skipped** (14 test files passed, 4 skipped).
- Full portable suite: **879 passed, 7 skipped** (73 test files passed, 5 skipped).
- TypeScript typecheck: passed.
- Production build: passed.
- ESLint: failed with **8 errors and 37 warnings**. The errors are the known React hooks debt in UI files, including synchronous state updates inside effects; they are not evidence of a search-ranking test failure.

Therefore baseline 137 is **not fully green**. Record it as tests/typecheck/build green, ESLint red due to the known Phase 1 UI debt. No lint fixes were attempted in this review.

## Decision and next step

1. Keep the exchange-polarity implementation/integration gate **closed**. No production semantics, eligibility, score, or ranking changes are authorized by these runs.
2. Improve the next read-only observation's candidate selection: explicitly seek candidates that jointly show (a) a Samand/target vehicle, (b) an explicit exchange relation, and (c) target-scoped `رنگ دارد` / equivalent contradiction evidence. If no joint candidate is found within the fixed retrieval/detail budget, record the control as **not captured**, rather than treating a paint-only listing as a contradiction.
3. Preserve the independent wrong-side, unknown, and positive target-side human-graded controls. Do not widen `بدون` matching globally.
4. Keep the existing blinded seller-role review and human grades as the gate for any mixed-transaction ranking proposal.
5. No merge to `main`, deployment, or live-service mutation.

