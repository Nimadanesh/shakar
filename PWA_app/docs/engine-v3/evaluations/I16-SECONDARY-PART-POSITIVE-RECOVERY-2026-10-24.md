# Issue 16 — Recovery of source-backed secondary-part positives

Date: 2026-10-24
Branch: `engine_v3`
Status: recovered from already-frozen, human-graded source snapshots; no new live capture.

## Strong direct control: whole vehicle with existing part markers

- Blind packet: [I16-CAPTURE-05D-BLIND.md](./I16-CAPTURE-05D-BLIND.md), record D05.
- Internal mapping: [I16-CAPTURE-05D-INTERNAL-KEY.md](./I16-CAPTURE-05D-INTERNAL-KEY.md), D05 → source ad `gacTnnuH`.
- Human-graded reconciliation: [I16-CAPTURE-05D-GRADED.md](./I16-CAPTURE-05D-GRADED.md), D05 = grade 3.
- Frozen title: `دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری`.
- Frozen description includes: `کمک فنر عقب نو کمک فنر جلو تازه پیچی شده ... تایر جلو نو`.
- This is a direct whole-vehicle sale (human grade 3) whose description mentions existing production part markers `کمک` and `تایر` as secondary vehicle features/maintenance details. It is the strongest recovered source-backed positive for checking that a clean whole-vehicle subject is not hard-rejected by part markers in the body.

## Additional semantic control

- Blind packet: [I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md](./I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md), record S02.
- Internal mapping: [I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md](./I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md), S02 → source ad `gac3G6Ob`.
- Human grade: 3.
- Title: `فروش فوری دنا پلاس توربو اتومات`. Description mentions `ماشین زاپاس و آچار چرخ زیرش نرفته`.
- This is another source-backed whole-vehicle positive with a secondary part/tool mention, but `زاپاس` and `آچار چرخ` are not entries in the current `PART_MARKERS`; do not use it as proof of those marker paths.

## Provenance and limits

The original capture cell labels are immutable. D05's original cell was `whole-vehicle-positive`; S02's original cell was `whole-clean`. This audit re-reads the frozen source text and human grades; it does not rewrite either label, fabricate a new capture, or change any human score.

The source-recovery gap is therefore **partially closed**: a valid whole-vehicle positive exercising current part-marker vocabulary exists (D05). The next evidence step is a test-only regression using D05's exact source title/body and a paired part-only negative (for example, the already-graded D03 spare-parts inventory or B04 body-parts inventory). Check the actual production guard path, not only the Issue 16 shadow title parser. The three-reader `HEAD_KIND` risk remains a separate gate; this finding does not authorize a production lexicon change.

No production source, ranking, eligibility logic, human grade, or `main` branch was changed by this audit.


## Follow-up — source-pinned full-pipeline characterization verified

The paired full-pipeline fixture requested above is now present in `PWA_app/src/lib/server/hunt/pipeline.test.ts` under `Issue 16 — source-pinned whole-vehicle item-kind characterization (Capture 05F)`. It replays the exact frozen title/description snapshots for B01–B07 plus D02/D03/D05/D07/D08 against `resolveHuntDefinition({ query: "خرید و فروش خودرو" })` and `runPipeline`, and locks current outcomes separately from human grades.

Validation: Baseline #179 on source/test commit `8b96c3af9674231fa0cf6c2403bb0a79f9fc3475` passed **330 focused tests** and **923 full portable tests**; TypeScript typecheck and production build passed. ESLint still fails with 8 errors / 42 warnings, so the workflow is not fully green.

Key observed pair:
- D05 (`gacTnnuH`), direct Dena vehicle sale, human grade 3 → engine `near`; secondary `کمک فنر` and `تایر` mentions do not cause rejection.
- D03 (`gaTPiMW9`), Lifan spare-parts inventory, human grade 1 → engine `exact`; this is a source-matched broad-vehicle false positive and is now reproducible in the full-pipeline fixture.

This closes the **broad whole-vehicle characterization-fixture** gap, not the separate three-reader `HEAD_KIND` decision and not the target-specific counterexample gap. It does **not** establish a safe production fix. The remaining specific-part counter-risk—different principal part in the title, hunted part only in description—still lacks a source-matched, human-graded example. Do not fabricate one or expand synthetic cases to stand in for it.

No production source, ranking, eligibility logic, human grade, or `main` branch was changed.
