# Issue 16 — Item-Kind Signal Audit After Capture 04

Date: 2026-10-24
Branch: `experiment/issue16-capture04-20261024`
Status: code-path inspection only; no behavioral change.

## Human-judged trigger

Capture 04 reconciliation is E4 evidence. In the whole-car family, five part/service ads graded 1 remained eligible; the catalyst-only ad C04-13 was classified `exact`. The whole-car positive C04-04 remained eligible. This is a repeated, narrow wrong-item-kind signal, not yet a paired old/new comparison and not a population estimate.

## Current mechanism inspected

Files inspected at this branch:
- `PWA_app/src/lib/server/hunt/kindLexicon.ts`
- `PWA_app/src/lib/server/hunt/pipeline.ts`
- `PWA_app/src/lib/server/hunt/semantics.ts`
- `PWA_app/src/lib/server/hunt/definition.ts`

The pipeline calls `queryKindForDef(...)`, then `adKindForTitle(title)`, then `kindGateRejects(...)`. The gate intentionally no-ops when either kind is unknown.

`HEAD_KIND` currently maps several vehicle heads to `vehicle` and a small number of parts to `vehicle-part` (e.g. battery, disk, brake pad, spark plug). It does **not** map `کاتالیزور` / `کاتالیز`. For a title such as `فروش کاتالیزور ماشین سنگین`, `adKindForTitle` examines the title's head after skipping sale cues; the unknown head returns null rather than scanning later tokens for `ماشین`. With a vehicle query kind and null ad kind, the gate correctly follows its unknown-no-op policy, so the catalyst-only listing can survive as near/exact based on lexical evidence.

This explains the observed path without implying that a broad marker ban is appropriate. It also explains why the repair belongs, if validated, in the closed item-kind lexicon/gate contract rather than an ad-hoc title rejection or global synonym.

## Candidate hypothesis — NOT IMPLEMENTED

A bounded ontology entry assigning the automotive catalytic converter head to `vehicle-part` may allow the existing gate to reject catalyst-headed ads for whole-vehicle hunts while preserving whole-vehicle titles whose descriptions merely mention a catalyst. This remains a hypothesis because the entry must be valid across all three readers documented in `kindLexicon.ts`: ad head, query subject, and co-offered sibling/marker behavior.

Counter-risks to test before any change:
- A generic/non-automotive use or ambiguous title is overclassified as a vehicle part.
- A genuine whole-car listing whose title begins with a catalyst phrase but actually offers a whole vehicle is rejected.
- A catalyst-specific hunt becomes wrongly gated or its subject kind changes unexpectedly.
- Other untyped part heads still leak; one lexicon entry may not address the broader failure family.

## Next evidence gate

Do not implement the candidate entry yet. The next capture must use unseen IDs and separate the item-kind hypothesis from the appliance eligibility hypothesis. For the whole-car test, target the fixed broad hunt `خرید و فروش خودرو`, with independently retrieved:
- at least 3 whole-vehicle positives, including a car whose body merely mentions a part;
- at least 3 catalyst/part/service negatives, including catalyst-only sale/buy and catalyst repair;
- additional ambiguous controls only if available.

Freeze source-matched snapshots and a blind packet before opening the internal key. Missing controls remain missing. Keep retrieval bounded, Mizan disabled, and all captures read-only. If the controls cannot be retrieved, stop and report the gap. Acceptance requires repeated catalyst-only false positives while whole-car controls remain healthy. Appliance eligibility remains a separate experiment and cannot be combined into this gate.

## Decision

Capture 04 strengthens the hypothesis; code inspection identifies a plausible mechanism. No code behavior, ranking, hard-rejection rule, merge, or deployment is authorized by this evidence. `main` remains untouched.
