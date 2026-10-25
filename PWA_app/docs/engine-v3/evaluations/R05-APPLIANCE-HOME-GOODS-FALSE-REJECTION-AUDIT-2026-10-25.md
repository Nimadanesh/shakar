# R05 — appliance/home-goods eligibility false-rejection audit (2026-10-25)

Status: investigation only; no production change.

## Why this is the next independent thread

The locked Retargeted Capture 03 human-grade record reports I16-R05 as grade 3 (relevant) while the engine rejected it with `appliance-not-home-goods`. The recorded intent is a buyer-seeking used-refrigerator listing. This is an eligibility false rejection, distinct from the Issue 16 paired body-offer counter-signal block, which is closed with STOP.

Source record:
- `evaluations/I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md`
- `evaluations/I16-RETARGETED-CAPTURE-03-RECONCILIATION.md`

## Code-path characterization

The current kind gate in `PWA_app/src/lib/server/hunt/kindLexicon.ts` rejects when the query and ad kinds have different domains. For a refrigerator query, the query kind is `appliance`; an ad head classified as `home-goods` therefore yields a domain-mismatch rejection. The category fallback maps `home` to `home-goods`, while refrigerator heads map to `appliance`.

This explains how the recorded reason can arise. It does **not** establish whether R05's title was incorrectly parsed as `home-goods`, whether the rejection policy is too strict for a genuinely mixed household/appliance listing, or whether the source/diagnostic join needs correction.

## Evidence currently missing

The human-grade and reconciliation files available in this branch do not expose R05's exact title, source ID, full description snapshot, or the intermediate `queryKind` / `adKind` values. Do not reconstruct them from the grade alone. Before any code proposal, recover the separate internal key and immutable source record, and verify that the source ID and engine rejection reason match.

## Falsifiable hypothesis

H1: a relevant buyer-seeking used-refrigerator ad is being hard-rejected because its parsed title head is assigned `home-goods` instead of `appliance`, or because a broad home-goods head masks the actual appliance subject.

Counter-hypotheses:
- the title genuinely has a different principal item, with refrigerator only mentioned secondarily;
- the listing is a mixed catalogue where the current principal-head policy is appropriate;
- the stored reason or source join is stale/mismatched.

## Safe acceptance gate

After recovering the exact immutable source:
1. Add a source-pinned regression reproducing the actual kind/reason path, without editing the human grade.
2. Add positive controls for direct refrigerator seller and buyer-seeking used-refrigerator listings.
3. Add negative controls for genuinely unrelated home goods and mixed catalogues where refrigerator is only incidental.
4. Prefer the narrowest fix in head parsing or kind resolution; do not globally equate `appliance` and `home-goods`.
5. Run focused tests, full portable suite, typecheck, and build; report ESLint separately because the repository has known unrelated UI errors.
6. Keep any code change isolated and unmerged pending the paired controls.

## Governance

- This is a separate follow-up thread; it does not reopen Issue 16's closed paired-evaluation block.
- No new live sampling is required for this audit step.
- No production parser, eligibility, ranking, `HEAD_KIND`, or kind-gate change is made by this document.
- No merge, deployment, or `main` modification is authorized.
