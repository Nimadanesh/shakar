# BRH Live Observation — Run 105 — 2026-10-23

## Execution
- Run: [#105](https://github.com/Nimadanesh/shakar/actions/runs/39933521146)
- Artifact: `engine-v3-live-observation-105` (artifact ID `12492029644`)
- Source commit: `ecb1f5c4853eef1ffaf51bf54d2149ab53edaf13`
- Branch: `engine_v3`
- Observation timestamp: 2026-10-23 09:41:08 UTC
- Run status: Success; artifact downloaded and inspected.

## Guardrails
- Read-only observation; no ranking or production behavior changes.
- Main observation used 8/8 detail checks across four scenarios, with a 2-detail cap for each scenario.
- Separate role-regression observation used 4/4 detail checks across two refrigerator scenarios.
- Mizan shadow remained disabled (`0`).
- All four primary scenarios completed two list pages where requested; no stale results were flagged.
- Slug capture buffered 8 records and wrote 0; no capture failures were reported. The role-regression artifact buffered 4 records and wrote 0.

## Vehicle exchange scenario
Query: `معاوضه با سمند بدون رنگ`
- 49 ads seen; 1 duplicate collapsed; 48 candidates after filters.
- Two detail records inspected: `gabTyjBD` and `gabvxlgd`.
- Rank 1 was marked `exact` although the captured description says the offered Pride 141 is «بدون رنگ و ضربه» and does not establish the requested Samand's paint condition. This is a strong diagnostic example of attribute evidence being attached to the wrong side of an exchange.
- Rank 2 was marked `near`; it offers a Samand in exchange for a Quick, which is opposite the searcher's likely desired direction, and the description does not establish paint condition.
- These are observations, not human grades. See the separate blind packet and internal key.

## Other scenario notes
- `پیانو قطعات اورجینال تعویض نشده`: two details inspected; selected toy piano and a piano advice/service listing. Neither provides evidence for original replacement-free parts. The service listing appears as a near result, so this remains a useful relevance-control observation.
- `پیانو تعمیر یا تعویض نشده است` (candidate query `تعمیر پیانو`): two service/buyer-related details inspected; both were rejected, with zero confirmed/near results. This supports keeping the service-intent negative-history control in future regression checks, but does not by itself estimate recall.
- `معاوضه با کفی سه محور`: two results marked exact. One title offers a trailer in exchange for a three-axle flatbed; the other offers a flatbed in exchange for a three-axle tanker. Both are lexical matches, but the second appears directionally opposite and should be human-graded before treating exactness as meaningful.
- Role-regression control `فروشنده یخچال` and ordinary `یخچال` returned the same two sampled listings in the same order. The mixed transaction title cue was false for both; this run does not test the narrow `خریدوفروش` cue.

## Next step
Collect blind grades for S01/S02. Do not implement contradiction status, alter ranking, or generalize from this two-listing sample until the human evidence and additional positive/negative controls justify it.
