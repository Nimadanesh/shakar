# Project State — Engine V3

Last verified: 2026-10-22
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Current source/test head: `dd58188f09d7c0806f116d49a3b005ff1ba8e408`
Latest portable baseline: [Run #19 — SHA `dd58188`](https://github.com/Nimadanesh/shakar/actions/runs/39682990792)
Latest live observation: [Run #9 — SHA `f2d9484`](https://github.com/Nimadanesh/shakar/actions/runs/39682408569)

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner is the independent product evaluator; the technical agent owns code investigation, architecture, experiments, implementation, measurement, and go/no-go decisions. Ask the user for grades only when a concrete fresh sample is ready; never ask them to choose the technical fix.

## Verified repository state

- `engine_v3` remains isolated from `main`. No merge or deployment occurred.
- The earlier behavior-preserving `let` → `const` cleanup remains in `contract.ts`.
- Hosted Node 24 execution is working (`v24.21.0`).
- Latest portable baseline on SHA `b8327e033b96ab40f3568051dcdfaae107de50a0`:
  - focused hunt/search tests: PASS;
  - full portable test suite: PASS;
  - TypeScript typecheck: PASS;
  - production build: PASS;
  - ESLint: FAIL due to 8 existing `react-hooks/set-state-in-effect` errors in unrelated UI files and 38 warnings.
- The three historical research harnesses remain explicitly NOT RUN because their frozen inputs are outside the repo. No result is represented as passing when its data is unavailable.
- The opt-in live workflow uses read-only Divar retrieval, max 2 list pages per query, max 8 detail fetches per query, and disables Mizan shadow calls. It writes a short-lived report artifact; slug captures are buffered only in the runner's temp directory, not written to Supabase.
- Latest live observation on SHA `f2d94846a24b272616d27b442454d9b2de42ecdb` completed successfully across four query families: `پیانو اکوستیک`, `کفی ماشین`, `تعمیر یخچال`, and `ماشین بدون رنگ`. It is a bounded observation, not a human relevance score.
- Detail-allocation experiment [run #1](https://github.com/Nimadanesh/shakar/actions/runs/39683008360) completed on the same query `ماشین بدون رنگ`: 20 list pages, 482 candidates, 120 detail fetches, no stale details. TitleStrength was 2 at rank 1 and 0 by rank 80; ranks 80, 100, 101, 120, 150, and 200 were all 0, so most of the shortlist is a tie resolved by input order.
- On the same candidate pool, the current top-100 allocation produced 1 exact, 39 near, and 60 candidates not returned in the scored output. A counterfactual 80-title-top + 20 evenly spaced candidates from ranks 101–200 produced 3 exact, 41 near, and 56 not returned, including two additional engine-exact cars at title ranks 128 and 138 with explicit `بی‌رنگ` evidence. This is a promising internal signal, not a human-quality metric; no allocation change is approved until a small blinded human grade confirms the relevant gains and counter-risk.
- Confirmed live defect and fix: for `پیانو اکوستیک`, a title `پیانو دیجیتال یاماها طرح آکوستیک` was initially ranked `exact`; after the new style-prefix guard, the same title is `near`, while real acoustic pianos remain `exact`. Deterministic semantic and pipeline tests cover the false-positive, a clean acoustic control, explicit request for a styled piano, and description-only mention protection.
- Confirmed live defect and fix: for `ماشین بدون رنگ`, `جک ماشین` and `چهار عدد کمک ماشین پراید` appeared as near-misses in the initial bounded sample. The part lexicon now recognizes `جک` and `کمک` as part subjects. The portable pipeline test asserts both are rejected while a real car listing that mentions a jack remains exact. In the latest live observation after the code change, the top returned results no longer include those two parts; this is a small live sample, not a full-recall claim.
- Other bounded observations: the first three `کفی ماشین` results were actual floor-mat listings marked exact; unrelated electronics were near. The `تعمیر یخچال` sample's top exact results were service offers. A car explicitly described as `بی‌رنگ` was exact for `ماشین بدون رنگ`, while listings without sufficient paint evidence stayed near.
- The public evaluation repo still exposes the Phase 1 packet/review artifacts, not a current R1/R2 handoff. Last-known R1a context (138/138 grades joined; mean nDCG@5 A=0.5007, B=0.5539) remains historical context only. Frozen captures, pins, grades, mappings, and denominators remain immutable.
- Existing architecture/quality docs have been marked historical where their pointers are stale. Full source reconciliation and a larger candidate-coverage experiment remain open.

## Current phase

**Phase 1 — evidence-backed critical correctness fixes.** The first two observed false-positive families have narrow patches and deterministic regression coverage. Portable tests/typecheck/build pass; lint remains red for unrelated UI debt.

## Next action

Get independent human grades for a small blinded packet from the completed detail-allocation comparison, without touching frozen R1 artifacts. If the grade confirms the two additional exact cars and no critical regression, implement a small deterministic exploration allocation behind an experiment flag and compare again; do not replace production top-100 allocation on engine labels alone. Do not change global synonyms, increase model authority, change `main`, or deploy without explicit authorization.


## Latest allocation experiment — 2026-10-22

- Current reporting commit: `a1233202cb20918ac012bfd0ec3c916f16fe0506` on `engine_v3`.
- Paired read-only multi-query report [run](https://github.com/Nimadanesh/shakar/actions/runs/39740034802), [artifact](https://github.com/Nimadanesh/shakar/actions/runs/39740034802): completed successfully; artifact `engine-v3-detail-allocation-multi-4`.
- Queries: `کفی ماشین` and `تعمیر یخچال`; 20 pages per query, 481/480 post-filter candidates, 120 detail checks per query, no stale data. The baseline is top 100 by title strength; alternative is top 80 plus 20 evenly spaced candidates from ranks 101–200.
- Top 20 remained identical between arms in the preceding top-20 report for both queries. The latest report exposes 20 baseline-only and 19 alternative-only candidates for `کفی ماشین`, and 20 baseline-only and 19 alternative-only candidates for `تعمیر یخچال` (one duplicate collapsed in the latter retrieval). Engine verdict counts differ between arms, but are not human relevance grades.
- A 20-item blinded packet has been prepared: 5 randomly sampled from each allocation-only set for each query, IDs E01–E20, with title and description excerpt only. Arm mapping is intentionally withheld until grades are returned. No allocation decision is approved yet.
- Latest portable baseline [run](https://github.com/Nimadanesh/shakar/actions/runs/39740035012): focused tests PASS, full portable suite PASS, TypeScript typecheck PASS, production build PASS; ESLint FAIL on the known unrelated UI errors (8 errors / 38 warnings). No production allocation changes, merge, or deployment.

## Current next action

The E3 allocation question is closed for now: keep the existing allocation; the 80/20 alternative has no demonstrated human-quality advantage. The source-matched audit and grades are recorded in `evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md`. Next, validate the narrow floor-mat/flatbed guard added on `engine_v3`: wait for the focused/full CI checks, inspect failures honestly, then run a bounded read-only live replay and blinded human review for both false positives and false rejections. The source records, code-path audit, acceptance gate, and implementation status are in `evaluations/E3-QUERY-INTENT-KAFI-01.md`. No production allocation change, main merge, or deployment.


## Human review received — packet integrity caveat (2026-10-22)

- Raw grades are recorded in [E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), commit `68d6d44a7f7f19539e0f63bd051d3b1ed5ba58e7`.
- Query-level observation: `تعمیر یخچال` received 10/10 exact grades; `کفی ماشین`, explicitly intended as automotive floor mats, received 2/10 exact (E17 and E19) and 8/10 irrelevant. E14, an Arisan sold with a flatbed/bar, is correctly 0 for a floor-mat intent.
- Audit found the displayed packet does not reliably satisfy its claimed balanced 5+5 allocation-arm sampling; some presented titles/descriptions were shortened/paraphrased. Consequently, these grades are not valid for an arm-level comparison and must not be used as an 80/20 go/no-go result.
- Next: build a source-matched balanced packet from the actual artifact, reuse grades only for exact candidate-ID matches, collect missing grades, and only then join arm labels. No production allocation change.


## Allocation decision after human grades — 2026-10-22

- Supplemental grades E21–E34 are recorded with the first round in [the evaluation record](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), latest commit `ffc3793c0bea8ce7c93f185f927855933a718a0e`.
- Across the source-matched sample of allocation-only candidates for `کفی ماشین` (explicit intent: automotive floor mats), baseline-only and alternative-only each had 1 exact match out of 8 sampled candidates (12.5%); the other seven in each arm were irrelevant. No observed relevance advantage for 80/20.
- Refrigerator-service candidates were relevant in both arms (baseline-only 8/8 exact; alternative-only 9/10 exact, 1/10 grade 2). This small unequal sample is diagnostic only.
- Previous top-20 lists were identical for both queries. **Decision: do not promote the 80/20 allocation. Keep current allocation unchanged.** Next high-value work is a narrow query-understanding/intent disambiguation fix for `کفی ماشین` (automotive floor mats vs trailer flatbeds/services), with positive floor-mat controls and hard trailer negatives. No code behavior change is authorized by this result.
