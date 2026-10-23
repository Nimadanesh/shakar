# Engine V3 Live Observation — Run 102 — 2026-10-23

## Status
**Capture succeeded; two vehicle-exchange candidates packeted for blinded human review.** This is diagnostic evidence only, not a relevance score, ranking comparison, or representative sample.

## Provenance
- Workflow: [Engine V3 Live Observation run #102](https://github.com/Nimadanesh/shakar/actions/runs/39931437467)
- Capture commit: `cf30a6fb09f68dbc2f1486f54caa2a326c4258a6`
- Artifact: `engine-v3-live-observation-102` (artifact ID `12491667843`; expires 2026-11-06)
- Observation time: 2026-10-23 09:23:34 UTC. Listing publication timestamps were not captured.
- The workflow completed successfully and respected the experiment-wide eight-detail budget.

## Scenario summary

| Scenario | Query | Pages / ads seen | Details checked | Observation |
|---|---|---:|---:|---|
| Negative replacement history | `پیانو قطعات اورجینال تعویض نشده` | 2 / 48 | 2 | One direct piano and one shop/advice listing confirmed as near; no explicit replacement-history cue surfaced in the captured top results. |
| Service control | `پیانو تعمیر یا تعویض نشده است` (retrieval control: `تعمیر پیانو`) | 2 / 48 | 2 | A pure repair service was rejected with `service-offer-for-negative-repair-history-product-hunt`; a buyer-of-pianos listing was rejected as no-match. |
| Trailer exchange | `معاوضه با کفی سه محور` | 2 / 29 | 2 | Two exchange listings confirmed as exact; prior Run 101 human judgments already cover these two source listings. |
| Vehicle exchange | `معاوضه با پژو ۲۰۶ بدون رنگ` | 2 / 49 | 2 | One Peugeot 206 listing was rejected as no-match; one Yamaha Aerox-for-Peugeot listing appeared as near. Both details were captured. |

## New blinded packet
- Blind packet: [BRH-2026-10-23-RUN102-VEHICLE-EXCHANGE-BLIND.md](BRH-2026-10-23-RUN102-VEHICLE-EXCHANGE-BLIND.md)
- Separate internal key: `BRH-2026-10-23-RUN102-VEHICLE-EXCHANGE-INTERNAL-KEY.md`
- Two unique vehicle listings are included. V01 explicitly mentions paint on one fender, and the transaction direction is not the requested exchange direction. V02 offers a Yamaha for a Peugeot 206, but the requested Peugeot's paint condition is not established in its captured description.
- These two examples are a first cross-category diagnostic, not sufficient evidence for a general exchange parser or ranking integration. Grade them blind before opening the key.


## Follow-up validation
- After correcting stale type-narrowing checks in the scenario-specific diagnostic branches, the updated live observation also completed successfully in [run #104](https://github.com/Nimadanesh/shakar/actions/runs/39931770232), commit `1958e56f8185be6448287e1f940a47c611523945`. It captured the same two vehicle listing IDs; this is a repeat observation, not two additional unique candidates.
- Baseline [run #131](https://github.com/Nimadanesh/shakar/actions/runs/39931770202) passed focused hunt/search tests, the full portable suite, TypeScript typecheck, and production build. The workflow remains red at repository-wide ESLint (existing React Hooks errors and warnings); this is not a fully green CI run.
- The packet remains intentionally small: only two new unique vehicle listings are graded in this follow-up. Do not use it to claim that exchange-side matching generalizes.

## Decision and next gate
1. Obtain blinded human grades for V01 and V02; keep “insufficient” outside the denominator.
2. Add more unique listings across categories and include counterexamples before claiming the exchange-side attribute helper generalizes.
3. Keep `assessExchangeSides` and `assessExchangeTargetEvidence` isolated from production ranking until cross-category human evidence supports an explicit integration design.
4. No main-branch merge or deployment is authorized by this report.

## Limitations
- Search retrieved candidates are not a random sample.
- The live workflow's result order and matchKind are not human relevance judgments.
- The captured data did not include Divar publication timestamps.
- The service-control scenario is intentionally adversarial and must not be used as a general precision estimate.
