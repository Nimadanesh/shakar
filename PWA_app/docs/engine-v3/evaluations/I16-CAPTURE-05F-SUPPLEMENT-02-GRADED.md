# Issue 16 — Capture 05F supplement 02 (graded results)

Date: 2026-10-24  
Target hunt: `خرید و فروش خودرو`  
Raw source: [GitHub Actions run 40079121984](https://github.com/Nimadanesh/shakar/actions/runs/40079121984), artifact `12553843717`.  
Blind packet: [I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md](./I16-CAPTURE-05F-SUPPLEMENT-02-BLIND.md)  
Internal mapping: [I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md](./I16-CAPTURE-05F-SUPPLEMENT-02-INTERNAL-KEY.md)

## Result

| Label | Human grade | Raw engine outcome | Interpretation |
|---|---:|---|---|
| S01 | 1 | near / eligible | Complete engine and engine-related components/services; not a whole vehicle |
| S02 | 3 | near / eligible | Direct Dena Plus whole-vehicle sale |
| S03 | 1 | near / eligible | Catalyst repair/service and catalyst buying |
| S04 | 1 | near / eligible | Catalyst buyer/replacement, not whole-vehicle trade |
| S05 | 1 | near / eligible | Vehicle body parts/accessories shop |
| S06 | 3 | near / eligible | Buyer of damaged/rolled vehicles; whole-vehicle transaction intent |
| S07 | 1 | near / eligible | Catalyst buying/selling/replacement |

## Summary

- Sample size: 7 source-backed human judgments from one bounded live capture.
- Score total: 11/21; mean: 1.57/3.
- Grade distribution: grade 3 = 2; grade 2 = 0; grade 1 = 5; grade 0 = 0; unknown = 0.
- All seven rows were engine-eligible as `near`.
- The five grade-1 rows are adjacent or wrong-primary-item listings that were admitted. Both grade-3 whole-vehicle positives (direct sale and damaged-vehicle buyer) remained eligible.
- This supplement supports the observed precision problem in this small sample, but it does not estimate general production precision and does not prove which code change is safe.

## Evidence limits and next step

The capture selector did not find a valid `whole-with-part-mention` positive; one `missing-cell` row had no source ID and was not graded. Therefore this sample cannot establish that a stricter item-kind gate would preserve whole-vehicle listings that mention a secondary part.

Do not add `کاتالیزور` to the shared `HEAD_KIND` lexicon as a standalone fix: that lexicon is read as an ad-title head, query subject, and co-offered sibling, and transaction-prefixed titles such as `خرید فروش کاتالیزور` require separate role/head parsing. Service listings also currently tend to be demoted to `near`, not hard-rejected. The safe next step remains paired, source-backed characterization of transaction-role parsing and item-kind parsing, with controls for direct whole-vehicle sales, damaged-vehicle buyers, dealers, parts-only listings, service listings, and a whole vehicle with a secondary part mention. No production engine/ranking behavior was changed by this grading record.

**Deduplication note:** S07 (`gaLrFFB1`) is the same source ad as H05F-B01; it is a repeat, not a seventh distinct fresh example.