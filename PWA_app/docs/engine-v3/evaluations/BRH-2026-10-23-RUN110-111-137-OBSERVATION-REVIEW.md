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



## Follow-up observation 113 — selector executes, contradiction still not captured (2026-10-23)

- Run: [39940161861](https://github.com/Nimadanesh/shakar/actions/runs/39940161861); artifact: `engine-v3-live-observation-113`; source commit: `638fec1953e8eae43885187818f19e6369de385c`; job succeeded.
- The artifact reports 90 ads seen over 4 requested/completed pages for `معاوضه سمند رنگ دارد`, with 3 paint-title cue candidates, 17 exchange-title cue candidates, and **0 joint Samand + paint + exchange title candidates**. The fixed two-detail budget was respected.
- The inspected detail candidates were `سمند ال ایکس مدل ۹۷ کارکرد ۱۸۷ رنگ دارد شاسی پلمپ` and `زانتیا ۲۰۰۰ معاوضه با سمند و پژو`. The first detail describes paint on the Samand but has no exchange cue; the second has an exchange cue and names Samand as the other vehicle, but its captured description does not establish the paint condition of that Samand. This is not a valid paired target-side contradiction witness. Gate remains **open / not captured**.
- The observation's other scenarios ran within their configured limits. The separate refrigerator role-regression artifact remains unjudged and cannot justify ranking changes.
- The artifact confirms the selector change at `638fec1` ran, but also reveals a sampling weakness: when no title has all three cues, the two-slot budget was spent on a paint-only Samand and a non-Samand vehicle title that mentions Samand. A follow-up observation-only adjustment was committed as `10c36a92eddf4510e7d20f4afcef89ca1b032eff`: prefer candidates whose titles jointly mention Samand + explicit exchange before paint-only candidates, while retaining the fixed budget and recording the new count. **This follow-up commit has not yet been run or validated.**
- No production engine/ranking behavior changed; no main merge or deployment. Do not claim contradiction polarity correctness until a new artifact captures detail that explicitly scopes the paint statement to the exchanged Samand, or records the control as not captured again.


## Follow-up observation 114 — Samand+exchange prioritization executed; scope remains unresolved (2026-10-23)

- Run [39940796881](https://github.com/Nimadanesh/shakar/actions/runs/39940796881) completed successfully on exact source commit [10c36a92eddf4510e7d20f4afcef89ca1b032eff](https://github.com/Nimadanesh/shakar/commit/10c36a92eddf4510e7d20f4afcef89ca1b032eff); artifact: `engine-v3-live-observation-114`.
- The four-page Samand scenario again saw 90 ads, 3 paint-cue titles, 17 exchange-cue titles, 17 Samand+exchange title candidates, and **0 titles jointly matching Samand + paint + exchange**. The two-detail budget was respected. The selected pool was `زانتیا ۲۰۰۰ معاوضه با سمند و پژو` and `معاوضه با تاکسی برون شهری سمند`.
- The latter description contains `بدون رنگ`, but the title expresses an exchange *with* a Samand taxi; the captured text does not unambiguously establish whether the paint statement refers to the target Samand or the offered/exchanged vehicle. The Zantia description does not state the Samand's paint condition. Therefore the artifact still does **not** provide a defensible target-scoped contradiction witness. Record the control as **not captured / referent unresolved**, not as a polarity pass or failure.
- The follow-up selector did run, but its recorded method is `paint-and-exchange-cue-interleaved-for-detail-audit`, and it did not produce a joint title. Do not keep adding title heuristics blindly: next improve the observation design only if it can explicitly capture listing-side/target-side referents or use a source-matched known control within the same fixed budget. Otherwise preserve the inconclusive result and ask for a deliberately selected human-reviewed source example.
- Other bounded checks: the flatbed exchange control returned two exact results; the negative-repair-history control rejected two sampled listings, including a repair-service offer. The piano history query's two detail candidates were unrelated/near and did not test history polarity. The separate refrigerator role artifact returned the same two listings in the same order for `فروشنده یخچال` and `یخچال`; still unjudged and diagnostic only.
- Run success means the observation workflow executed successfully, not that the quality gate passed. No production semantics, eligibility, ranking, detail budget, `main`, or deployment changed.


## Source-matched human-evidence audit — exchange paint ownership (2026-10-23)

After run 114 failed to capture a scoped contradiction, I audited the already locked human packets and their separate internal keys/artifacts before proposing another live selector change.

- **Target-side positive:** S04, source ad `gaaTiMpU`, title `فروش سمند ۹۵ ای اف سون بیرنگ.معاوضه دارم`, grade 3. The title and detail `بدونه رنگ` refer to the same Samand, and the exchange cue is explicit. Source: run 109 artifact, code SHA `f7baa1aa3e4290529e1bbe98d72a555a2f309eae`.
- **Target-side unknown:** S03, source ad `gaCLax_r`, title `سمند سورن دریچه سیمی 1404 معاوضه با دنا اپشنال`, grade 2. `بدون نقطه` does not establish paint state. Source: run 106 artifact, code SHA `912d26c9b8724610ba813336a4c79019f9e9eded`.
- **Wrong-side evidence:** S01, source ad `gabTyjBD`, grade 2. `بدون رنگ و ضربه` belongs to the offered Pride, not the requested Samand/Tiba2; target paint remains unknown.
- **Missing evidence:** S02, source ad `gabvxlgd`, grade 2. The Samand's paint state is not stated.
- **Explicit contradiction exists, but is confounded:** V01, source ad `gaYj6KeD`, grade 0, explicitly says `یه کف دست گلگیر عقب سمت راننده رنگ داره` about the Peugeot 206. However, its transaction frame offers the Peugeot and asks for Pars/Rana, while the query asks `معاوضه با پژو ۲۰۶ بدون رنگ`. Its grade 0 therefore cannot serve as a clean, direction-matched contradiction-only control.

**Conclusion:** The source-matched set now proves a target-side positive (S04), a target-side unknown (S03), wrong-side evidence (S01), missing evidence (S02), and an explicit but transaction-direction-confounded contradiction (V01). It still lacks a human-graded case where the requested exchange direction is valid and the same target vehicle explicitly contradicts `بدون رنگ`. Do not treat run 114's ambiguous `بدون رنگ` phrase as that case. The next useful step is a new blind, source-ID-mapped contradiction case or an equivalent controlled fixture explicitly marked synthetic; do not add more title-selection heuristics without a reasoned capture strategy.

This audit is evidence bookkeeping only. No source records or grades were modified; no production logic, ranking, detail budget, `main`, or deployment changed.
