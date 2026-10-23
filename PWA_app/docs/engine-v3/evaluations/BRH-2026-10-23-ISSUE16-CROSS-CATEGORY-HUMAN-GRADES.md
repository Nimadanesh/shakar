# BRH — Issue 16 Cross-Category Human Grades

Date: 2026-10-23  
Evidence level: **E4 — human judged**  
Packet: [BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-BLIND.md](BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-BLIND.md)  
Post-grade mapping: [separate internal key](BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-INTERNAL-KEY.md)

## Locked owner grades

The grades and rationales below are transcribed from the evaluator's submitted judgments. No grade has been changed during reconciliation.

| Blind ID | Grade | Human rationale |
|---|---:|---|
| I01 | 1 | Direct MVM seller; direction is opposite to `خریدار خودرو`. This is the suspected transaction-role error. |
| I02 | 1 | The title mentions a store, but the description only buys damaged refrigerators. |
| I03 | 2 | Genuine exchange, but the Samand is the requested counterparty; the paint condition belongs to the advertiser's own vehicle. |
| I04 | 1 | A two-way office, but the item is a vehicle voucher, not a vehicle itself. |
| I05 | 1 | Buyer/recycler of scrap; not a seller for `فروشنده یخچال`. |
| I06 | 1 | Two-way title, but the description only says the advertiser takes/buys items; no clear offer to sell. |
| I07 | 2 | Xantia offered in exchange for Samand/Peykan; Samand is accepted, but Samand paint condition is not stated. |
| I08 | 1 | Refrigerated truck unit offered for exchange with a vehicle; not a cash buyer seeking vehicles. |
| I09 | 2 | Genuine appliance store, but broad home-appliance inventory rather than a clearly evidenced refrigerator offer. |
| I10 | 3 | Direct, clean LG refrigerator sale. |
| I11 | 1 | Same voucher-office pattern as I04; vehicle vouchers, not vehicles. |

## Score and distribution

- Graded items: **11/11**; INSUFFICIENT: **0**.
- Distribution: grade 0 = 0; grade 1 = 7; grade 2 = 3; grade 3 = 1.
- Sum: **16/33** (mean **1.455/3**), not 15/33. The evaluator's item-level grades sum to 16; the submitted total of 15 is an arithmetic discrepancy only. The individual grades are preserved unchanged.
- Grade 1: 7/11 (63.6%); grade 2: 3/11 (27.3%); grade 3: 1/11 (9.1%).
- This packet is a diagnostic, non-random, cross-category sample. These counts are not population precision, not a paired before/after metric, and do not demonstrate ranking uplift.

## Post-grade reconciliation against engine diagnostics

The source mapping was opened only after the human grades were submitted.

| Blind ID | Source ad ID | Exact query | Engine diagnostic | Human grade | Readout |
|---|---|---|---|---:|---|
| I01 | `gab_aV8W` | `خریدار خودرو` | eligible, exact, score 3.5, rank 1 | 1 | **Critical role-direction false positive:** seller-style car ad is top-ranked for buyer-seeking query. |
| I02 | `gaLNJNwu` | `فروشنده یخچال` | exact, score 3.5, rank 1 | 1 | **Critical role-direction false positive:** buyer-only description is ranked exact for seller-seeking query. |
| I03 | `ga4iPfzH` | `معاوضه سمند رنگ دارد` | near, score 2.5, rank 1 | 2 | Human agrees it is useful but materially ambiguous/opposite-side attribute evidence; no basis for changing target-side attribute logic from this one item. |
| I04 | `gaPHaEfq` | `خریدوفروش خودرو` | eligible, near, score -3.5, rank 2 | 1 | Voucher office is not a vehicle listing; supports continued scrutiny of item-vs-service/voucher boundaries, not a broad title rule by itself. |
| I05 | `gaRj-fI_` | `فروشنده یخچال` | rejected as part/offering `درب` | 1 | Rejection avoids presenting this buyer/recycler as a seller; human grade remains weak because transaction direction is wrong. |
| I06 | `gaqV1O58` | `فروشنده یخچال` | eligible, near, score 0.5, rank 1 | 1 | Engine did not call it exact, but it still surfaced a buyer-only listing for a seller-seeking query. |
| I07 | `galu34HS` | `معاوضه سمند رنگ دارد` | near, score 1.5, rank 2 | 2 | Human grade matches the engine's cautious near label; target Samand paint remains unknown. |
| I08 | `gavSad4q` | `خریدار خودرو` | rejected, wrong-kind | 1 | Correctly excluded as a refrigerated unit, though it is not a clean buyer-seeking vehicle control. |
| I09 | `Qa4_oh_e` | `فروشنده یخچال` | rejected, rank unavailable | 2 | **Potential false rejection:** broad appliance store judged relevant (grade 2) despite no refrigerator-specific evidence in the captured description. Review only with comparable appliance-store controls before changing filters. |
| I10 | `gabPa811` | `یخچال` | exact, score 3.5, rank 1 | 3 | Positive control: direct refrigerator sale correctly surfaced as exact. |
| I11 | `gaIL7h0B` | `خریدوفروش خودرو` | eligible, near, score 0.5, rank 1 | 1 | Same voucher-office pattern as I04; mixed-title cue alone does not make the offered item a vehicle. |

## Interpretation and decision

1. The clearest high-severity signal is transaction direction: I01 and I02 were both engine-`exact`/top-ranked but human grade 1. I06 is another surfaced wrong-direction result, though already labelled `near`.
2. I09 is a possible false rejection (human grade 2, engine rejected). One broad store listing is insufficient to relax a hard rule globally.
3. Voucher-office cases I04 and I11 are both grade 1. Keep them as separate ads but recognize they share the same title pattern; they are not independent evidence of two different wording patterns.
4. The explicit exchange controls I03 and I07 support keeping target-side attribute ownership distinct from attributes on the offered item. I07's requested Samand paint is unknown, not a confirmed fail.
5. I10 is the only grade-3 positive control. The packet lacks a clean explicit buyer-seeking vehicle control and a spaced `خرید و فروش` title, so the role/cue matrix is incomplete.

**Gate:** This is E4 judgment on a small, selected live sample, not E5 paired comparative evidence. Record the defect evidence, but do not generalize or expand the mixed-title rule, change hard-rejection policy, alter production ranking, merge, or deploy based on this packet alone. The next useful experiment should fill the missing positive buyer-seeking vehicle and spaced-title cells with a bounded, source-grounded capture; compare comparable role-direction positives and negatives before proposing a narrow fix.
