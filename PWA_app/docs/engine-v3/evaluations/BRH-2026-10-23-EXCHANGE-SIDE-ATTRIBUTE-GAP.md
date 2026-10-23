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


## Follow-up: exact-phrase target evidence helper (2026-10-23)

A second isolated helper now exists at `PWA_app/src/lib/server/hunt/exchangeTargetEvidence.ts`: `assessExchangeTargetEvidence(text, targetItemPhrases, requiredAttributePhrases)`. It builds on the span segmentation and only returns `supported` when an exact normalized target-item phrase and required-attribute phrase occur on the same explicit side. Opposite-side-only attributes, missing target/attribute, ambiguous target on both sides, and unsegmented text remain non-supporting/unknown outcomes. This is deliberately phrase-level evidence, not synonym resolution, entity extraction, or a general Persian attribute parser.

The latest baseline workflow for commit `842ebc3a062dd0493f25cee51648eb9766d72c0e` (run #125) confirms the focused exchange-side tests (9/9), target-evidence tests (7/7), BRH semantics tests (7/7), polarity tests (5/5), the broader portable suite, TypeScript typecheck, and production build passed. The workflow overall remains failed solely at repository-wide ESLint: 8 existing React Hooks errors and 37 warnings. See [run #125](https://github.com/Nimadanesh/shakar/actions/runs/39929353572).

**Decision remains unchanged:** this helper is diagnostic/test-only and has not been connected to ranking. Exact phrase lists are not sufficient to safely bind real-world synonyms or diverse Persian item descriptions. Next, collect and blind-grade more exchange cases across item categories, then design explicit target-phrase/attribute evidence fixtures and counterfactuals before proposing any integration.


## Additional guard: token-boundary matching (2026-10-23)

Reviewing the exact-phrase helper revealed a substring-overmatch risk. The helper now pads normalized side text and requires whole normalized token/phrase boundaries. The initial counterfactual used `کفی‌سازی`, but the shared Persian normalizer intentionally converts ZWNJ to a separator, so that input normalizes to two tokens and is not a valid test of a joined token boundary. The test was corrected to use the joined spelling `کفیسازی`; the separate `سه محوری` versus `سه محور` counterfactual remains unchanged.

Commits: `1b284272f5e54ce4f8d39d2f4e2ea58dab90e94e` (implementation), `88ba1efb2d7625d1d5f84575257eb9721460f49d` (initial tests), and `4702123168b6f1dee971dd51b9c018ea77e35980` (corrected item-boundary fixture). The corrected fixture is validated by [run #128](https://github.com/Nimadanesh/shakar/actions/runs/39931009932): focused hunt/search tests, full portable suite, TypeScript typecheck, and production build all passed. The workflow overall remains failed at repository-wide ESLint, which reports 8 React Hooks errors and 37 warnings unrelated to this isolated helper. The earlier run #126/#127 failures came from the original fixture contradicting the shared normalizer's documented ZWNJ behavior. This validates the test correction and current helper checks, not production ranking behavior or a full green CI run.

This remains phrase-level matching only. It deliberately does not introduce stemming, synonym expansion, or production ranking behavior.
