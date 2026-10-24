# Issue 16 — Capture 05F item-kind code-path characterization

Date: 2026-10-24  
Branch: `experiment/issue16-capture04-20261024`  
Scope: documentation-only diagnosis; no production behavior change.

## Question

Why can a broad whole-vehicle hunt (`خرید و فروش خودرو`, category `vehicles`) retain catalyst-only, repair/service, and body-parts listings as `near`, while a whole-vehicle buyer or dealer offer can also be `near`?

## Source inspection

Inspected current branch source:

- `PWA_app/src/lib/server/hunt/kindLexicon.ts` (blob `4665b0d848fb1229250a508a73d3b4b64e62cc17`)
- `PWA_app/src/lib/server/hunt/kindLexicon.test.ts` (blob `1da0fcfef7e307410bcf931d6fee5610b0d7f4ad`)
- `PWA_app/src/lib/server/hunt/pipeline.ts` (blob `ce180f10b0055b4e3a05c300aa9866deefa85f33`)

Current code path:

1. `queryKindForDef(include, serviceIntent, category)` checks the closed `HEAD_KIND` phrase lexicon, then uses the category bridge. For a vehicle-category hunt whose include phrase has no lexicon hit, the category bridge resolves the query kind to `vehicle`.
2. `adKindForTitle(title)` only classifies the normalized title head after skipping a small list of sale cues. It returns `null` for unknown heads.
3. `kindGateRejects(queryKind, adKind, ...)` explicitly returns `null` when either side is unknown. This is an intentional anti-overfilter rule.
4. The pipeline invokes the kind gate only after the listing has MUST evidence (`missingInfo.length === 0`). A null title-head kind therefore cannot structurally reject a wrong-kind ad; other semantic rules may still cap it, but lexical/MUST evidence can leave it eligible as `near`.

## How the graded 05F examples map to the code

| Blind label | Human grade | Observed principal item | Current title-head coverage expectation | Diagnostic implication |
|---|---:|---|---|---|
| B01 | 1 | Catalyst buying/selling | Unknown: `کاتالیزور` is not a `HEAD_KIND` entry | Kind gate likely no-ops; not evidence that a catalyst-specific patch is automatically safe |
| B02 | 3 | Whole damaged-vehicle buyer/exchange | Title begins with valuation/buyer wording, not a known vehicle head | Must remain eligible; transaction role must not be mistaken for item kind |
| B03 | 1 | Bulk body parts | Unknown: `بدنه` is not a `HEAD_KIND` entry | Kind gate likely no-ops |
| B04 | 1 | Stock body and body-parts inventory | Unknown: the title head is `بدنه`, before the later `پژو/پراید/دنا` mentions | Particularly clear title-head limitation; later vehicle tokens do not establish that whole vehicles are the principal item |
| B05 | 1 | Catalyst repair and used-material buying | Unknown: title begins with `کاتالیزور` | Kind gate likely no-ops; service/transaction wording alone must not determine item kind |
| B06 | 1 | Tire-only exchange | Engine rejected it in this sample | Healthy negative control; retain it in any paired regression |
| B07 | 3 | FMC511 whole-vehicle dealer offer/exchange | Unknown: title begins with `فردا موتور`, not a lexicon key | Must remain eligible; the later `موتور` substring alone is not a safe title-head classification |

“Unknown” in this table is a source-based prediction from the current title-head algorithm, not a claimed runtime trace. The human grades and engine outcomes are taken from the locked 05F report; no unseen listing text or grade has been reconstructed.

## Falsifiable characterization fixture — next step

Build a deterministic, source-grounded fixture before changing the lexicon or gate. It should assert the current classification and full pipeline verdict separately, so a future patch cannot pass by merely changing one layer.

### A. Whole-vehicle positives (must remain eligible)

- Direct whole-car sale: `فروش پراید` → `adKindForTitle = vehicle`.
- Damaged whole-vehicle buyer/exchange: use the exact source-matched B02 title/body from the internal key; it must remain eligible for the broad hunt.
- Dealer whole-vehicle offer/exchange: use the exact source-matched B07 title/body; it must remain eligible.

### B. Wrong-kind negatives (should not be primary whole-vehicle results)

- Catalyst buying/selling: exact B01 source snapshot.
- Body-parts inventory: exact B03 and B04 source snapshots, especially B04 where vehicle names occur after the body-parts head.
- Catalyst repair/service: exact B05 source snapshot.
- Tire-only exchange: exact B06 source snapshot, which is already rejected and must stay rejected.

### C. Role and mention counter-controls

- A whole-vehicle buyer ad is not a part listing merely because it seeks to buy; preserve B02.
- A whole-vehicle dealer listing is not a part listing merely because it mentions exchange; preserve B07.
- A genuine whole-car title/description that mentions a part as a secondary detail must remain eligible.
- A parts inventory that mentions vehicle models later in the title/description must not become a whole-vehicle listing solely from those mentions.

### Acceptance gate

1. Pin exact source IDs, titles, and the available immutable descriptions before coding; keep internal IDs out of the blind packet.
2. Record current `queryKind`, `adKindForTitle`, gate verdict, semantic verdict, and final pipeline verdict for every fixture row.
3. Verify the paired positives and negatives against the locked human grades; unknown kind must not silently become a hard rejection.
4. If source snapshots are incomplete, report the gap instead of recreating ad descriptions from memory.
5. No lexicon entry, global marker, rank penalty, or hard rejection until this characterization is reviewed and a narrow candidate fix has counter-controls.

## Current conclusion

Evidence points to a **closed title-head coverage gap**: known whole-item heads are classifiable, but several wrong-kind listings start with unrecognized principal-item nouns and therefore bypass the kind gate under the deliberate unknown-no-op contract. This is a plausible mechanism, not yet proof that adding `کاتالیزور`, `بدنه`, or other nouns to `HEAD_KIND` is safe. The lexicon contract says each new entry must be valid in all three uses: ad head, query subject, and co-offered sibling marker. A future fix must satisfy that three-reader constraint and preserve whole-vehicle buyer/dealer controls.

No engine or ranking logic changed. No merge, deployment, or `main` change.
