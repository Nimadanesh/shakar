# Issue 16 Capture 06C — Post-Grade Source Map and Engine Reconciliation

- **Target hunt:** `کاتالیزور خودرو`
- **Live run:** [#1](https://github.com/Nimadanesh/shakar/actions/runs/40100799513)
- **Artifact:** `engine-v3-issue16-capture-06c.json`, ID `12563205197`
- **Artifact SHA-256:** `c321b97cfefce573c6956b15e52c451e34915d1749e8c2a8541a681dcd82d198`
- **Artifact capture commit:** `59e39f7be7cd04028639219e0697c1c2a50aeb97`
- **Join rule:** blind codes were mapped to the exact immutable artifact's `listings[].sourceAdId` only after the owner supplied and locked all five human grades. Each code maps one-to-one to one listing.
- **Engine fields below are diagnostic only. Human grades are not inferred from or overwritten by these fields.**

| Blind code | Source ad ID | Candidate arm | Title | Human grade | Eligible | Match kind | Score | Rejected kind | Missing info |
|---|---|---|---|---:|---|---|---:|---|---|
| C01 | `gaw4-0TS` | direct-title-control | خرید وفروش خاک کاتالیزور خودرو ودیزل وپتروشیمی | 1 | true | near | 0.5 | null | — |
| C02 | `AazPR38_` | direct-title-control | تعمیر وفروش اگزوز خرید کاتالیزور | 1 | true | near | 1.5 | null | خودرو |
| C03 | `QaVRxMZC` | direct-title-control | فروش وخریدانواع کاتالیزور و خاک۲۰۶ پژو ال۹۰ نیسان | 3 | true | near | 1.5 | null | خودرو |
| C04 | `gacTasmJ` | direct-title-control | جایگزین کاتالیزور xu7 پژو پارس و ۴۰۵و اگزوز بلوچی | 3 | true | near | 1.5 | null | خودرو |
| C05 | `Qa62T2Jf` | other-part-title-context | اگزوز (بیات)تیبا.کوییک پژو سمند مارک مشهد | 1 | true | near | 1.0 | null | خودرو |

## Source-matched interpretation

- **Join integrity:** 5/5 blind codes resolve to exactly one artifact listing; no duplicate source IDs among these five selected listings.
- **Direct-title candidate control:** only C03 and C04 received human grade 3 (2/4). C01 and C02 were grade 1 despite the target term appearing in the title. Thus the arm is a candidate control set, not four guaranteed positive controls.
- **Body-only context candidate:** C05 (`Qa62T2Jf`) was human grade 1. The title is an exhaust service/product title; the body mentions a free catalytic-converter test among services and does not establish that the converter itself is offered. Engine still marked it eligible/near (score 1.0): one source-backed false-acceptance example for this bounded target/context scenario.
- **C01:** the title/body advertise buying and selling catalyst dust for vehicles/diesel/petrochemical use, but the owner graded the exact hunt 1. Do not generalize beyond this record.
- **C02:** although the title includes “buy catalyst,” the body describes exhaust sales/repair and catalyst buying, not a clear seller offer for the hunted item; owner grade remains 1.
- **C03:** the owner graded 3; body says the advertiser buys various catalysts on site. Preserve this grade as supplied; do not silently reinterpret transaction direction or revise the rubric post hoc.
- **C04:** explicit one-week-used replacement catalyst is described as available for sale; owner grade 3.
- All five records are engine-eligible/near. That is not itself a relevance score. In particular, the C05 human grade remains 1 even though the engine accepted it.
- **Evidence strength:** E4 human judgment over a small, targeted, non-random sample. Not E5 paired old-vs-new evidence, not a population precision estimate, and not proof of general false-acceptance rate. Capture 06B's separate grade-1 body-only example remains independent; do not merge captures or denominators.
- **Decision:** the sample supports preserving the narrow failure signal and designing a carefully scoped next evidence step; it does not by itself justify a production parser, eligibility, ranking, `HEAD_KIND`, or `PART_MARKERS` change.
- No production behavior changed; no merge, deployment, or `main` modification.
