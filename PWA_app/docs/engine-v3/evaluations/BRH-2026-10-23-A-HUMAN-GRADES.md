# BRH-2026-10-23-A — Human grades and source-matched follow-up

Date: 2026-10-23  
Branch: `engine_v3`  
Scope: six blinded candidate judgments supplied by the project owner. This report does not modify the frozen blind packet or internal key.

## Human grades

| ID | Grade | Human judgment |
|---|---:|---|
| A01 | 2 | Relevant piano product; condition is near-new/lightly used, but no explicit repair/replacement history. |
| A02 | 0 | Buyer-seeking ad, opposite transaction role. |
| A03 | 2 | Relevant shop/catalogue, but no specific unit with verifiable history. |
| A04 | 0 | Repair service, not a product listing. |
| B01 | 1 | Consultation-focused; generic condition/authenticity language does not verify original parts on a specific unit. |
| B02 | 3 | Specific Beethoven piano; “without change, relocation, or tampering” was judged sufficient evidence of untouched state; technician inspection does not itself imply replacement. |

Distribution: grade 3 = 1; grade 2 = 2; grade 1 = 1; grade 0 = 2; insufficient = 0. Insufficient is not part of the denominator.

## Source-matched engine outcome

The earlier observation on source SHA `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f` is artifact `engine-v3-live-observation-86` from [run 39915083572](https://github.com/Nimadanesh/shakar/actions/runs/39915083572).

For query `پیانو قطعات اورجینال تعویض نشده`, the resolved definition had:
- `include: ["پیانو", "قطعات", "اورجینال"]`
- `absentAttributes: ["تعویض"]`

The live observation retained `پیانو اصلی بتهوون اصلی` as `near`, with evidence `["پیانو"]` and missing information `["قطعات", "اورجینال"]`. It was no longer rejected as `no-match` after the scoped buyer-cue fix. This is a recovery from a false rejection to an eligible near result, not a full match and not proof of quality uplift.

The observed B01-like consultation ad was also retained as `near`; the human grade 1 suggests potential over-inclusion, but one example is not enough to justify a broad consultation guard.

For query `پیانو تعمیر یا تعویض نشده است`, the observed repair service was rejected with `service-offer-for-negative-repair-history-product-hunt`, and the buyer-seeking ad was rejected as `no-match`. These observations are consistent with A04=0 and A02=0. The exact candidate behind A01 was not the same live listing as the A01 source in the blind packet; do not call this exact per-ID agreement.

## Interpretation and next action

1. Keep the buyer-cue fix: a mid-description phrase like `به دنبال` in ordinary seller copy must not by itself turn the listing into a buyer-seeking ad. A leading buyer declaration remains recognized.
2. Do not infer `تعویض نشده` solely from `بدون تغییر` globally. That would risk claiming a repair/replacement history the ad does not explicitly establish. Preserve UNKNOWN when history is absent.
3. Investigate whether the contract can represent condition evidence like `بدون دستکاری` as supporting-but-not-conclusive evidence for a negative replacement-history request, scoped to this intent and not as a universal synonym. Add paired positive/negative controls before changing this.
4. Keep consultation-focused listings lower priority where they do not offer a specific product, but do not introduce a hard reject based on this single grade.
5. Preserve the service/buyer controls and ordinary product behavior.

## Validation status

- Baseline run [39915088347](https://github.com/Nimadanesh/shakar/actions/runs/39915088347): focused tests, full portable suite, TypeScript typecheck, and production build passed; ESLint failed on 8 existing UI hook-rule errors (45 problems total, 37 warnings).
- Live run [39915083572](https://github.com/Nimadanesh/shakar/actions/runs/39915083572): bounded observation completed successfully and artifact inspected.
- A later live run [39915087951](https://github.com/Nimadanesh/shakar/actions/runs/39915087951) timed out on Divar requests and produced no artifact. Treat as infrastructure timeout, not an engine verdict.
- No merge to `main`, deployment, or production change.
