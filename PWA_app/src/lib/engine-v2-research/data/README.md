# Frozen Stage 2 input data (musi, 2026-10-27)

- `frozen-70-hunts.json`: the 70 frozen hunt definitions H01-H70, verbatim from
  stage1-batchN-hunts.md (only trailing parenthetical notes removed: the H11
  replacement note and the H29 grading-interpretation note are NOT part of
  the hunt text).
- `frozen-pool-titles.json`: 1,399 displayed search-card titles (H20 has 19),
  with ad tokens for traceability. Full ad bodies were graded but are not
  frozen as text; titles + definitions are the frozen token corpus for C9.
- `hardSlotSourcePhrases` is deliberately NOT in this file: the coverage
  verdict on dropped/guessed hard slots comes from musi's review of the
  contractor's 70 contracts against these definitions, not from a list
  the contractor authors itself. The mechanical audit runs on structure
  (count, duplicates, missing/unexpected IDs) only.
