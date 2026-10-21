# Project State — Engine V3

Last verified: 2026-10-22
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Latest workflow configuration commit: `c1e4ee15af972d5f31d3225f9f29b77ec93008e4`
Latest completed baseline run: [Run #4](https://github.com/Nimadanesh/shakar/actions/runs/39676527704), tested commit `76216d62017afbaa23820afc85e0c34885a95fc9`.

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner acts primarily as a blinded/consistent end-user evaluator:
- run the requested hunt scenarios in the product;
- grade whether the top results are genuinely relevant and whether critical constraints are respected;
- report observed output and unexpected behavior.

The technical agent owns code investigation, architecture, test design, implementation choices, measurement, and go/no-go recommendations. User feedback is evidence, not an instruction to adopt a particular technical solution.

## Verified repository state

- `engine_v3` was created from current `main` SHA `10f3c40d70748ff27d6928eaed0875e10dab1c56`.
- No engine or product source files have been changed in V3. Changes so far are control documentation and the isolated GitHub Actions baseline workflow.
- Hosted runner executed Node `v24.21.0` with npm `11.19.0`; `npm ci` succeeded.
- First three runs failed because three historical research harnesses hard-code files outside the repository. Run #4 explicitly excluded only these three files from portable CI and reports their missing inputs as NOT RUN:
  - `src/lib/server/hunt/contractDeleteAudit.test.ts` needs `/home/hatch/workspace/ge2-ads.json`
  - `src/lib/server/hunt/contractGate.test.ts` needs `/home/hatch/workspace/your_files/experiment-b-probe-v1.json`
  - `src/lib/server/hunt/expAFeatures.test.ts` needs intended contracts plus historical round captures/grades and snapshot data under `/home/hatch/workspace`
- Run #4 outcomes:
  - focused portable hunt/search suite: PASS
  - full portable test suite: PASS
  - TypeScript typecheck: PASS
  - production build: PASS
  - ESLint: FAIL (9 errors, 38 warnings)
  - overall job: FAIL because ESLint failed
- The 9 lint errors comprise eight `react-hooks/set-state-in-effect` errors in UI files (`KaminDetailSheet.tsx`, `BottomTabBar.tsx`, `MarketSheet.tsx`, `HomeCityUpdateNudge.tsx`, `HuntProgress.tsx`, `SearchSheet.tsx`, `HomeCityRow.tsx`, `useProfile.ts`) and one `prefer-const` error in `src/lib/server/hunt/contract.ts:163`.
- The build compiled successfully and generated 38 static pages. This verifies buildability at that SHA, not live Divar retrieval or relevance quality.
- `npm ci` reported 30 dependency vulnerabilities (2 low, 6 moderate, 20 high, 2 critical). No automated dependency upgrade/audit fix was applied.
- Workflow triggers are now scoped to workflow, package/lockfile, source, scripts, and build/lint/typecheck config changes, avoiding repeated runs for control-doc-only updates.
- Existing synthetic benchmark remains 16 cases (`2026-10-09-v1`), documented as a seed benchmark rather than representative live-market evidence.
- Human-evaluation packets/replay artifacts in `Nimadanesh/shakar-eval-tmp-20261012` remain protected; current R1/R2 status still needs verification before further evaluation.
- Architecture/roadmap docs contain stale baseline pointers and still need reconciliation against current code.

## Important quality risks to verify

These remain hypotheses, not proven current defects:
1. Relevant ads may be missed due to query construction, pagination, deduplication, or detail-budget allocation.
2. Explicit constraints may be mishandled when evidence is missing, stale, or ambiguous.
3. Entity/kind confusion (e.g. part/accessory vs whole item) may produce irrelevant results.
4. Service intent and transaction direction may be confused.
5. Global synonym expansion may collapse related-but-distinct concepts.
6. Mizan's effective role may differ by runtime configuration.
7. Passing unit tests/typecheck/build does not establish human top-result quality.

## Current phase

**Phase 0 — baseline trustworthiness: execution checks now have real results, but phase exit is not yet approved.**

Completed:
- branch isolation and control documents;
- hosted Node 24 workflow;
- portable focused tests, full portable test suite, typecheck and build all run and pass;
- exact lint failure inventory recorded;
- three research harnesses and their unavailable frozen inputs explicitly distinguished from passing tests.

Still required before Phase 0 exit:
- verify current R1/R2 evaluation status and pinned candidates without modifying them;
- run the golden harness only after its exact frozen inputs and expected mappings are identified;
- reconcile stale architecture/quality documentation against current source;
- record a code-level prioritized failure register and select the first measurable search-quality experiment;
- decide how to address lint errors. Avoid unrelated UI refactors; the one engine lint error is `prefer-const` in `contract.ts:163`.

## Next action

Inspect the precise `contract.ts` lint context and current evaluation handoff, reconcile stale architecture docs, and define a minimal first quality experiment with a measurable acceptance gate. Do not change `main`, deploy, alter frozen human-evaluation artifacts, or claim live quality gains without paired human-judged evidence.
