# BRH Issue 16 — Follow-up Plan 03

Date: 2026-10-23  
Status: **planned; no new capture or grades claimed**  
Parent evidence: bounded live capture [40011900064](https://github.com/Nimadanesh/shakar/actions/runs/40011900064), blind packet 02, and its post-grade internal reconciliation.

## Decision

Do not change ranking, eligibility, or hard-rejection rules yet. The six-item follow-up exposed three distinct error families, not one proven common cause. The next experiment should separate them, use source-grounded live ads, and include counter-controls. Do not reuse frozen packet IDs or modify prior artifacts.

## Hypotheses and controlled pairs

### A. Transaction direction: seller-seeking refrigerator hunt

**Observed anchor:** I13 (wZcsAVgg), query «فروشنده یخچال», human grade 1, engine diagnostic exact / sample rank 1. Its body says the advertiser buys household refrigerators and asks owners who have a refrigerator for sale to send photos; title also includes «فروش و معاوضه».

**Question:** Is the seller-seeking false positive caused by mixed title wording, the body-level buyer intent, or a mismatch between query role and candidate role?

Capture a new live set with:
1. direct seller control: title/body explicitly offers a refrigerator for sale;
2. buyer-only control: title/body explicitly seeks to buy refrigerators;
3. mixed buyer/seller title with body that only buys refrigerators (I13 pattern);
4. mixed buyer/seller title whose body genuinely offers refrigerators for sale;
5. ordinary product-query control «یخچال» using the same candidate set where retrieval permits.

Grade each against its exact query. Keep buyer-only and mixed cases separate; do not add a global «خریدار» substring cue. A potential rule change requires the same direction error to recur in more than one independent source wording while direct-seller and ordinary-query controls remain acceptable.

### B. Whole vehicle vs adjacent service/product

**Observed anchor:** I15 (gaIL7h0B), query «خریدوفروش خودرو», human grade 1, title «دفتر خریدوفروش حواله خودرو», body advertises buying/selling vehicle vouchers. The first blind packet contained the same voucher-office pattern, so this is a repeated failure family but not an independent wording pattern.

Capture:
1. direct vehicle sale (whole vehicle itself);
2. vehicle voucher office;
3. vehicle-buying/selling brokerage or consultancy that does not offer a vehicle;
4. direct whole-vehicle exchange offer;
5. clean broad-query control with ordinary vehicle listings.

Keep the item-kind distinction explicit: the target is the vehicle, not a voucher or service about vehicles. Do not promote a new broad «دفتر» or «حواله» hard-rejection cue without verifying counterexamples and actual title/body evidence.

### C. Human-exact broad vehicle listings labeled only near

**Observed anchors:** I12 (gaYvJrs6) and I16 (gabLLuzd), both human grade 3 for «خرید و فروش خودرو», both engine-labeled near. I12 directly offers a vehicle for cash/installment and says the seller is willing to exchange; I16 is a direct Pride sale.

Capture a fresh set of at least:
1. direct vehicle sale, cash;
2. direct vehicle sale, installment;
3. direct vehicle sale with exchange willingness;
4. a vehicle-only adjacent service/office control;
5. an ambiguous title whose body does not establish a direct vehicle offer.

This tests whether the near mismatch is caused by a broad query's MUST-term contract, title/detail evidence allocation, or an intentional distinction in match-kind semantics. Do not simply redefine every near as exact; relevance grade and engine match-kind are different outputs.

## Capture and blind protocol

- Read-only Divar retrieval; MIZAN_SHADOW=0; no service writes.
- Maximum 2 list pages per query and no more than 8 detail reads total across this follow-up. If any cell cannot be populated within budget, mark it missing; do not widen limits or fabricate a substitute.
- Freeze query strings and selection rules before viewing selected detail text. Prefer distinct source IDs and distinct wording, not repeated versions of the same listing.
- Build a new blind packet with randomized IDs and exact query, title, and sufficient description excerpt. Do not include source IDs, engine labels, score/rank, hypothesis family, or prior grades in the blind packet.
- Keep source IDs and engine diagnostics in a separate internal key. Open that key only after all human grades are submitted and locked.
- Record captured, detail-read, unique, graded, and insufficient cases separately. Do not call this sample representative or report it as Precision@5/nDCG.
- Grade each ad against its exact query from the searcher's perspective: 3 exact, 2 relevant, 1 weak, 0 irrelevant, or INSUFFICIENT. Preserve the owner's rationale verbatim.

## Acceptance gate before any code proposal

A code change is eligible for proposal only if:
1. the same failure mechanism is supported by multiple independent source ads;
2. paired positive and negative controls show the proposed cue does not demote the correct role/item;
3. existing role controls in pipeline.test.ts remain valid, including buyer-seeking, seller-seeking, and mixed shop/buyer hybrid cases;
4. the smallest candidate rule is scoped to the demonstrated intent, with a counterexample test;
5. a fresh bounded live replay is run after implementation and its blind grades are separate from this discovery packet.

Until then, this is characterization and experiment design only. No engine source change, rank/eligibility change, merge, or deployment is authorized by this plan.
