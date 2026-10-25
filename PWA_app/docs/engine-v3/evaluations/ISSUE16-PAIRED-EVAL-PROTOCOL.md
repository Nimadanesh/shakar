# Issue 16 — prospective paired human-evaluation protocol

Status: proposed protocol, documentation-only. This is not authorization to change production behavior.

## Purpose

Test whether the test-local body-offer counter-signal safely reduces false hard rejections for `کاتالیزور خودرو` without weakening rejection of nearby but different intents. The motivating 06A C01 example is already known and must not count as prospective evaluation data.

## Frozen hypothesis

For source-matched listings where the current shadow subject policy would hard-reject, an explicit body-level offer of the target item may justify changing the *shadow decision* from `reject` to `unknown`. It does not justify `allow`. The signal must remain off for repair/service context, buyer-seeking text, subtype/dust intent, or incidental mentions.

No production parser, eligibility, ranking, `HEAD_KIND`, `PART_MARKERS`, or pipeline change is part of this evaluation.

## Sample plan

- Collect **12 previously unseen listings** from bounded, reproducible Divar observation runs for the frozen query `کاتالیزور خودرو`; retain exact title, description snapshot, listing ID, observation timestamp, query/page provenance, and capture artifact hash.
- Assemble 4 candidate positives with explicit evidence that the catalytic converter itself (or a clearly equivalent target part) is being offered. At least 2 must have the target absent from the title but explicit in the body; at least 1 should use an item-list format. These are inclusion targets, not guaranteed available results.
- Assemble 8 negative/control examples, with at least 2 examples in each applicable category: repair/service-only context; buyer-seeking/purchase intent rather than offer; subtype or material such as catalyst dust; incidental or ambiguous mention where the target item is not being offered. Categories may overlap, but record all applicable tags.
- Do not pad the sample with repeat captures of the same listing. Exclude duplicates by stable listing ID and report any category quota that cannot be filled. If 12 eligible unseen listings cannot be sourced, stop and report the shortfall rather than silently relaxing the plan.
- This is a small, targeted decision-gate pilot, not a population precision estimate. Do not claim statistical generalization from it.

## Blinding and paired comparison

1. Freeze the sample manifest and source snapshots before running the comparison. Do not modify the manifest after seeing engine outputs.
2. Have the human evaluator grade each listing from source content alone, with engine labels and policy outcomes hidden. Use the existing rubric: 3 exact, 2 relevant, 1 weak, 0 irrelevant. Mark insufficient evidence as UNKNOWN; UNKNOWN is excluded from numeric denominators.
3. Lock and timestamp the human grades before revealing the engine/shadow outcomes. Preserve the human grades as the authority; never overwrite them with model or engine labels.
4. Run the existing baseline shadow policy and the candidate counter-signal against the same frozen inputs. Record the raw decision, counter-signal boolean, and final counterfactual shadow decision for each listing.
5. Report each listing-level pair and all disagreements. Summarize counts by human grade and control category. Explicitly identify false hard rejects (human grade 2 or 3 with shadow reject), false allows (human grade 0 or 1 with shadow allow), and UNKNOWN outcomes. Do not collapse UNKNOWN into reject or allow.
6. Check that the candidate counter-signal never creates `allow`, and that its only permitted transition is `reject -> unknown`. Verify negative controls individually, not only as an aggregate.

## Decision gate

A passing test suite alone is insufficient. Before discussing a production change, require:
- complete source provenance and no duplicate IDs;
- locked human grades made before engine comparison;
- all planned positives and negative-control categories represented, or a documented stop due to source limitations;
- no candidate-generated `allow` transitions;
- per-example review of every false hard reject, false allow, and UNKNOWN;
- explicit comparison against the frozen baseline and a written account of regressions and remaining uncertainty.

If any condition fails, do not propose a production change from this pilot. A successful pilot only justifies designing a larger follow-up; it does not automatically authorize a merge or deployment.

## Existing evidence that must remain separate

- Capture 06A C01 (`gaPT4jAd`) is known discovery evidence, human grade 2, and must remain immutable; it is excluded from the 12 prospective listings.
- Capture 06A C02, 06B B01, and all five 06C examples are locked diagnostic controls for existing unit-level assertions, not substitutes for unseen prospective listings.
- Capture 05F is a whole-vehicle/control capture. Repeated 05F artifacts do not add Issue 16 sample size.
- CI results establish only that the checked code/tests executed successfully; they do not prove human search-quality improvement.

## Governance

PR #43 must remain Draft and unmerged unless the user explicitly authorizes otherwise. Do not merge, deploy, alter `main`, or modify production search behavior as part of this protocol.
