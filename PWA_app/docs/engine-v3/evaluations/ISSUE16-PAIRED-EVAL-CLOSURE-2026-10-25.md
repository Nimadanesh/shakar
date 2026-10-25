# Issue 16 — paired evaluation closure (2026-10-25)

**Decision: STOP.** The Issue 16 prospective paired-evaluation block is closed by the owner's explicit decision. No further sampling round is authorized in this block.

## Scope and frozen question

The pilot asked whether a narrowly scoped, test-local body-offer counter-signal could reduce false hard rejections for the frozen Divar query `کاتالیزور خودرو` when the title does not identify the target part, while preserving rejection of nearby but different intents.

The only permitted counterfactual transition was `reject → unknown`. The signal was never permitted to create `allow`. This was an evidence-gathering exercise, not authorization to change production behavior.

## Retrieval designs tried

Fifteen bounded sampling designs were tried. Across these attempts, the retrieval strategy was varied rather than relaxing the sample contract. The tested design families included:

- **Adjacent-part discovery:** searches around related automotive components and terms such as oxygen sensor, brake pad, headers, starter, and fuel pump, looking for listings whose title named another part while the body explicitly offered the catalytic converter.
- **Broader automotive-parts discovery:** wider auto-parts query variants intended to increase the candidate pool beyond direct searches for the target term.
- **Separated positive discovery and negative-control retrieval:** positive discovery was pursued separately from direct-catalyst negative controls, including repair/service-only and buyer-seeking contexts, rather than allowing the easy-to-find controls to stand in for positives.
- **Candidate allocation and selection variants:** bounded changes to how candidates were prioritized for detail reads, including inventory-priority selection and different splits between discovery paths. The strongest tested design used inventory priority with a 16/8 allocation across the two paths.

The retrieval budget remained bounded and read-only. Detail-read caps and stable-ID duplicate exclusion were retained. The sample contract was not weakened to make a packet appear complete.

## What the source pool established

The Divar pool did not supply the required body-centered positives. In the latest capture, 24 detail records were checked; 5 duplicate listing IDs were excluded, leaving only 8 selected candidates. There were **zero qualifying prospective positives** in that capture. Repair/service and buyer-seeking controls were each represented by only one candidate, below their required quotas.

Across all 15 designs, the number of qualifying body-only positives was zero or one. Even the strongest inventory-priority design with the 16/8 split produced zero qualifying positives. The missing examples were specifically listings where:

1. the title did not name the target catalytic converter;
2. the body explicitly offered the catalytic converter itself (or a clearly equivalent target part); and
3. the source snapshot and provenance were sufficient for blind human grading.

Broader and adjacent-part queries did not yield that evidence pattern within the bounded retrieval pool. Repeated IDs, repair/service ads, buyer-seeking ads, incidental mentions, and other non-qualifying candidates cannot substitute for it. The conclusion is **source-pool insufficiency for this pilot**, not proof that such listings never exist on Divar and not evidence that the counter-signal improves or harms relevance.

## Why the evaluation cannot be scored

The protocol required 12 previously unseen listings: 4 explicit-offer positives, including at least 2 body-only cases and at least 1 item-list case, plus 8 negative/control examples meeting the category quotas. The collected pool did not satisfy the positive quota or the negative-control quotas. Therefore:

- no complete prospective packet exists;
- the planned paired human evaluation cannot be validly scored;
- no partial packet is promoted to a completed evaluation;
- quotas are not lowered, synthetic examples are not introduced, and duplicate captures do not increase sample size.

A passing test or successful observation workflow would establish execution only, not human search-quality improvement.

## Existing human evidence remains locked and separate

The following grades remain immutable and are not prospective positives or replacements for the missing sample:

- **06A:** C01 = 2, C02 = 1, C03 = 2, C04 = 2.
- **06B:** B01 = 1.
- **06C:** grades in packet order = 1, 1, 3, 3, 1.

The fixed diagnostic example **06A C01** (source ID `gaPT4jAd`, human grade 2; production engine `near`, shadow `reject`) remains diagnostic evidence only. It is not future-looking prospective data and must not be counted toward the closed sample.

Human grades remain the authority; engine labels must not replace them. UNKNOWN remains distinct from grades 0–3.

## Technical and governance boundary

- The body signal remains **experimental only** and may only perform the shadow transition `reject → unknown`; it must never produce `allow`.
- No production parser, eligibility, ranking, `HEAD_KIND`, `PART_MARKERS`, or pipeline change is authorized by this closure.
- PR **#43 remains Draft and unmerged**.
- Do not merge, deploy, modify `main`, or make production changes without the owner's explicit authorization.
- This STOP closes sampling for this evaluation block; it is not an instruction to continue automatically with another query strategy.

## Reopening condition

Reopen Issue 16 only after a **new, explicit decision from Navid** and only if a review identifies a genuinely new Divar retrieval channel or source path—not another variation of the already exhausted query/allocation designs—that plausibly exposes the missing body-only offer pattern.

Any reopening must preserve the original quotas, source snapshots and provenance, stable-ID deduplication, blind grading, and the `reject → unknown`-only safety boundary. If a genuinely new channel is not identified, the block stays closed.

## Final disposition

**STOP — source pool insufficient; no score; no production change. Await the owner's next family direction.**
