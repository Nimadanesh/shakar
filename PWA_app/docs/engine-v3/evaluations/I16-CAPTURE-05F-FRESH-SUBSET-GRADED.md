# Issue 16 — Capture 05F Fresh Subset: Human-Graded Result

Date received: 2026-10-24  
Target hunt: **خرید و فروش خودرو**, category `vehicles`  
Evidence level: **E4 — Human judged**, seven freshness-reconciled records from a bounded live Divar retrieval.

## Human grades joined to engine evidence

| Blind label | Human grade | Engine eligible | Engine match kind | Engine score | Finding |
|---|---:|---:|---|---:|---|
| H05F-B01 | 1 | yes | near | 2.1667 | Catalyst buying/selling listing, not a whole vehicle. |
| H05F-B02 | 3 | yes | near | 0.8333 | Damaged-vehicle buyer/exchange offer; valid broad whole-vehicle transaction positive. |
| H05F-B03 | 1 | yes | near | 1.5000 | Bulk body parts (hoods, fenders, bumpers, lights), not whole vehicles. |
| H05F-B04 | 1 | yes | near | 2.8333 | Stock body and body-part inventory, not whole vehicles; engine gave this the highest score among these seven. |
| H05F-B05 | 1 | yes | near | 0.8333 | Catalyst repair and used-material buying/service listing, not whole vehicles. |
| H05F-B06 | 1 | no | rejected | — | Tire exchange listing, correctly rejected by the typed-kind gate in this sample. |
| H05F-B07 | 3 | yes | near | 2.5000 | FMC511 dealer listing with direct sale and exchange of whole vehicles. |

Summary: **2 grade-3, 5 grade-1; mean grade 11/7 = 1.57/3.** Six of seven were engine-eligible and marked `near`; the tire-only listing was rejected. Among the six eligible records, four wrong-kind part/service listings were admitted as near-misses (B01, B03, B04, B05), while both human-grade-3 whole-vehicle transactions were also only `near`.

## Interpretation

The packet continues to support a typed-item-kind concern for broad whole-vehicle hunts: catalyst-only, catalyst-service, and body-parts listings can be admitted as `near`, including a body-parts ad with a high engine score (B04: 2.8333, human grade 1). It also preserves the counter-control: transaction role must not be conflated with item kind. A buyer/exchange listing for a damaged whole vehicle (B02) and a dealer offering whole vehicles (B07) both received human grade 3, despite engine `near` labels.

The tire-only exchange listing (B06) was rejected, so this sample does not support indiscriminately rejecting all listings that mention a vehicle-related part or exchange. The distinction must be about the principal item being transacted, not mere vocabulary.

## Integrity and limitations

- The blind packet contains seven rows. One other selected 05F row, source ID `gapYR7Ug`, was excluded because it overlapped concurrent Capture 04B; it is not part of these grades.
- The seven included source IDs were checked against the concurrent capture artifacts and the prior-inspection exclusion set. The duplicate 05F workflow invocation is the same experiment and is not counted as additional evidence.
- Capture 05F is a bounded, targeted diagnostic sample, not a population estimate or paired before/after comparison. Retrieval query labels were used to collect contrastive controls; every grade is against the same broad target **خرید و فروش خودرو**.
- These grades support continued evidence-based investigation; they do not alone determine a specific code fix.
- No engine/ranking logic was changed from this evidence. No merge, deployment, or `main` change occurred.
- Source IDs and retrieval details are kept in the separate internal key.
