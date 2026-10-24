# Issue 16 — Recovery of a source-backed secondary-part positive

Date: 2026-10-24
Branch: `engine_v3`
Status: recovered from an already-frozen, human-graded source snapshot; not a new live capture.

## Recovered record

- Blind packet: [I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md](./I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md), record S02.
- Internal mapping: [I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md](./I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md), S02 → source ad `gac3G6Ob`.
- Human-graded reconciliation: [I16-CAPTURE-05F-SUPPLEMENT-02-GRADED.md](./I16-CAPTURE-05F-SUPPLEMENT-02-GRADED.md), S02 = grade 3.
- The frozen title is `فروش فوری دنا پلاس توربو اتومات`. Its description includes: `ماشین زاپاس و آچار چرخ زیرش نرفته` (the spare tire and wheel wrench have not been used).
- The record is a direct whole-vehicle sale (grade 3) and mentions a vehicle part/tool secondarily in the description. It is therefore a source-backed positive for the semantic requirement that a real vehicle listing must not be rejected merely because it mentions a secondary part.

## Important provenance boundary

The original capture's internal key labels S02 as `whole-clean`, because that was its retrieval/capture cell. Do **not** rewrite the immutable cell label or claim the capture selector intentionally found a `whole-with-part-mention` record. This is a post-capture, source-text audit that found the secondary mention inside a record already graded by the human. Keep the original title, description, source ID, and grade unchanged.

This is a useful positive control, but it does not establish that every relevant marker path has been exercised. In particular, `زاپاس` and `آچار چرخ` are not themselves entries in the current `PART_MARKERS` list; the source-backed excerpt is useful to check the subject-aware handling of the existing part marker `لاستیک` only if the exact source text actually contains that marker. It does not. So do not claim that this one record directly proves the `لاستیک` marker's behavior: its value is as a whole-vehicle positive with a secondary parts/tools mention, not as a direct test of the existing marker trigger.

## Consequence

The blanket statement “no source-backed whole-vehicle positive with any secondary part mention exists” is too broad and is superseded by this audit. The narrower gate remains open: a source-backed positive that actually exercises a production marker/guard path must be paired with a part-only negative, and the three-reader `HEAD_KIND` counter-risk must still be resolved before any production change. No source code, grades, or production behavior were changed by this audit.
