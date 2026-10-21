# Project State — Engine V3

Last verified: 2026-10-22
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Baseline workflow commit: `84bb3591677e8d8c0f364292fd9b801d59d4a929`

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner acts primarily as a blinded/consistent end-user evaluator:
- run the requested hunt scenarios in the product;
- grade whether the top results are genuinely relevant and whether critical constraints are respected;
- report observed output and unexpected behavior.

The technical agent owns code investigation, architecture, test design, implementation choices, measurement, and go/no-go recommendations. User feedback is evidence, not an instruction to adopt a particular technical solution.

## Verified repository state

- `engine_v3` was created from current `main` SHA above.
- Source code has not been modified in V3; the only new non-documentation file is an isolated GitHub Actions workflow at `.github/workflows/engine-v3-baseline.yml`.
- The workflow pins Node.js 24, runs in `PWA_app`, installs from the lockfile with `npm ci`, then attempts focused hunt tests, full tests, typecheck, lint, and production build.
- The workflow file was committed as `84bb3591677e8d8c0f364292fd9b801d59d4a929`.
- GitHub Actions API currently reports zero workflow runs for `engine_v3` and for that commit. Therefore no workflow step has been observed running yet; do not report tests/build as run or passed.
- A deterministic synthetic benchmark exists at `PWA_app/src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, with 16 cases. Its documentation says it is a seed benchmark, not a representative live-market benchmark.
- A golden benchmark and harness integrity gate exist under `PWA_app/scripts/`; they have not been run. Do not run the gate without identifying its exact frozen inputs and expected grade mapping.
- Human-evaluation packets and replay artifacts exist in `Nimadanesh/shakar-eval-tmp-20261012`. Protect all frozen captures, pinned versions, grades, and mappings.
- Existing architecture/roadmap docs contain stale baseline pointers; reconcile against code rather than assuming either is current.
- The previous local clone limitation remains true for the local container (GitHub DNS unavailable; Node 22.16.0), but hosted Node 24 execution is now prepared through the new workflow. The unresolved immediate issue is that no Actions run has been created/observed.

## Important quality risks to verify

These remain audit hypotheses, not proven current defects:
1. Relevant ads may be missed because of retrieval coverage, query construction, pagination, deduplication, or detail-budget allocation.
2. Explicit constraints may be mishandled when evidence is missing, stale, or ambiguous.
3. Entity/kind confusion (e.g. a part/accessory vs the whole item) may produce irrelevant results.
4. Service intent and transaction direction may be confused.
5. Global synonym expansion may collapse related-but-distinct concepts.
6. Mizan's effective role may differ by runtime configuration; inspect code/config before assuming it affects ranking.
7. Code correctness and synthetic tests do not establish human top-result quality.

## Current phase

**Phase 0 — Establish a trustworthy baseline (in progress).**

Completed:
- branch created from current main;
- durable control documents and initial baseline audit added;
- source tree, docs, benchmark and human-evaluation artifacts inspected remotely;
- Node 24 baseline workflow added to the isolated branch.

Not complete:
- observe a real Actions run and record exact outputs;
- execute tests/build/typecheck/lint in Node >=24;
- run the golden harness gate with correct frozen inputs where available;
- verify current R1/R2 status and exact candidate pins without modifying them;
- reconcile architecture/quality docs with current code;
- produce a code-level prioritized failure register with testable hypotheses.

## Next action

Trigger or enable the new workflow using a supported GitHub Actions path, then inspect the actual run and fix any workflow/environment issue without touching `main`, deployment, secrets, or frozen evaluation artifacts. Once the baseline commands have genuine outputs, record exact failures and only then decide whether Phase 0 exit criteria are met. Do not implement engine features before that gate.
