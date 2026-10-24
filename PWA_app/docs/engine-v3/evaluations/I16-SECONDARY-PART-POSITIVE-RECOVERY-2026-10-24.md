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
