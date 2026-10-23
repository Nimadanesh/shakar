# BRH Supplemental Blind Grades — Gap Capture 131 (2026-10-23)

Source packet: [BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md](BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md). Source capture: [run 40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727), artifact ID `12523753208`.

## Locked human grades

| Blind ID | Grade | Human rationale |
|---|---:|---|
| X01 | 1 | دلال خرید و فروش یخچال خراب است؛ برای «یخچال معاوضه» هیچ معاوضه‌ای ندارد. |
| X02 | 1 | فروش مستقیم یخچال سالم؛ جهت برعکس «خریدار یخچال». |
| X03 | 1 | فروشگاه فروش است؛ برای «یخچال معاوضه» معاوضه‌ای پیشنهاد نمی‌کند. |
| X04 | 1 | فروش مستقیم جفت یخچال و لباسشویی؛ جهت برعکس «خریدار یخچال». |

All four candidates are grade 1 (weak/tangential or wrong transaction direction). Numeric denominator: 4; grade-1 count: 4/4 (100%). No INSUFFICIENT grades.

## Joined source mapping and interpretation

Mapping is joined only after the blind grades were submitted; see [separate source mapping](BRH-2026-10-23-GAP-CAPTURE-131-MAPPING.md).

- X01 → `Aax4Mkwa`: slash/truncated shop-buyer-like title. The human judgment says the ad is buying broken refrigerators, not offering an exchange. This does not establish that every slash/truncated variant should be treated like the normalized `فروشگاه خریدار` cue.
- X02 → `gabz6Dbp`: seller offer returned for buyer-seeking query `خریدار یخچال`; wrong transaction direction.
- X03 → `QaNCuMKq`: direct retail seller returned for exchange query `یخچال معاوضه`; no exchange offer.
- X04 → `gabvWdaN`: explicit sale of a refrigerator + washing-machine pair returned for buyer-seeking query `خریدار یخچال`; wrong direction and multi-item offer.

## Evidence boundary and decision

This is **E4 human-judged evidence on a non-random, four-item supplemental sample**, not E5 paired evidence and not a population precision estimate. The capture did not find a clean barter listing in its bounded two-detail pool; the existing human-graded sale/exchange refrigerator control remains the source-matched positive control for that matrix cell.

The grades confirm these four surfaced candidates are weak for their exact query contexts. They do **not**, by themselves, justify broadening transaction-role regexes, adding a global buyer cue, hard-rejecting candidates, or changing ranking. Keep unknown/mixed transaction cases conservative; obtain source-matched positive and negative controls before considering any new cue. PR #28 remains draft and unmerged; no production behavior, `main`, or deployment changed.
