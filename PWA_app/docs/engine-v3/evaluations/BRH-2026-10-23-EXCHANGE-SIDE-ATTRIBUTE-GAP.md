# BRH Run 101 — exchange-side attribute binding gap

Date: 2026-10-23  
Status: **verified design gap; conservative text-span segmentation exists, but no entity parser or ranking integration**

## Evidence

The human-reviewed packet distinguishes two exchange listings:

- **P06, grade 3:** `تریلی بیات معاوضه با کفی سه محور` for query `معاوضه با کفی سه محور`. The requested counterparty item is the three-axle flatbed; this satisfies the user's wanted item.
- **P07, grade 2:** `کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز` for the same query. The flatbed is offered, while “three axle” describes the requested tanker. That attribute must not transfer to the flatbed.

The current semantic API `assessListingRole(text)` returns one listing-level role, such as `exchange`; it does not return separately bound offered-item and requested-item entities or their attributes. A listing-level `exchange` label cannot establish which side owns “سه محور”.

## Current implementation boundary

`PWA_app/src/lib/server/hunt/exchangeSides.ts` now provides `assessExchangeSides(text)`, a conservative segmentation helper for the explicit construction `OFFERED معاوضه با REQUESTED`. It returns normalized text spans, supports a leading `معاوضه با X` as requested-side-only partial evidence, and returns unknown for multiple boundaries or absent explicit boundaries.

This is **not** an entity parser: it does not identify item names or bind attributes to entities. It is **not integrated into ranking or the production search pipeline**. No ranking behavior has changed. The helper's focused tests include both actual P06/P07 titles and counterfactual attribute-binding examples.

The workflow for commit `9f280c63939524e9246f2623c5a9ff4fcb98d63a` completed: focused hunt/search tests, full portable tests, TypeScript typecheck, and production build passed; ESLint failed at its existing repository-wide React Hooks debt (8 errors, 37 warnings). Therefore the workflow is not fully green, and no claim of a clean full CI run is made.

## Required future contract

For an exchange listing, represent at least:

- `offeredItem`: item the advertiser gives away, with attributes evidenced for that item;
- `requestedItem`: item the advertiser wants in return, with attributes evidenced for that item;
- evidence spans for each item and attribute;
- `unknown` when the text does not reliably bind an attribute to either side.

Query matching must evaluate the query's wanted item against the correct side. It must not transfer an attribute across the exchange boundary.

## Minimal counterfactuals before production integration

Use stable fixtures and keep these distinct from observed Divar evidence:

1. `تریلی معاوضه با کفی سه محور`: requested item is a three-axle flatbed; match `کفی سه محور`.
2. `کفی سه محور معاوضه با تانکر تمیز`: offered flatbed is three-axle; match `کفی سه محور`.
3. `کفی معاوضه با تانکر سه محور`: the flatbed's axle count is unknown; do not satisfy `کفی سه محور`.
4. `کفی سه محور معاوضه با تانکر سه محور`: both sides independently have the attribute; either side's evidence must be explicit.
5. `معاوضه با کفی`: wanted item is identifiable, but axle count remains unknown.

## Guardrails

- Do not solve this by a broad lexical boost or penalty for `معاوضه`.
- Do not assume the first item named is always the offered item or always the wanted item.
- Do not convert unknown attributes into a mismatch or a positive match.
- Keep ranking changes blocked until the parser contract has counterfactual tests and the human-reviewed P06/P07 cases are replayed.
- The next safe step is to design item/attribute binding independently from text segmentation, with explicit unknowns and counterfactual tests, before any scoring integration.
