# Stage 3 Replay Run-book (VM)

This is a research-only live replay. Run it only on the architect's VM, never from a developer/assistant environment. It makes live Divar search and detail requests. Do not use it as a CI test.

## 1. Preconditions

- Confirm the repository branch is `engine_v2_research` and its HEAD is the SHA approved for the run.
- Confirm the working tree is clean and the Stage 3 CI workflow is green for that exact HEAD.
- Use Node.js 24 or newer and npm.
- Do not run this from `main` or `engine_v3`; do not merge or deploy.
- Keep the full terminal output and the complete output directory as run evidence. Do not publish aggregate retrieval numbers as verified until the architect has reviewed the artifacts.

## 2. Install

From the repository root:

```sh
git switch engine_v2_research
git status --short --branch
git rev-parse HEAD
cd PWA_app
node --version
npm --version
npm ci
```

Stop if the branch, HEAD, working-tree state, Node version, or dependency install does not match the preconditions. Do not repair or change project files during the replay session.

## 3. Run the full replay

From `PWA_app/`, choose a new, timestamped output directory for a fresh full run. Example:

```sh
RUN_DIR="../stage3-replay-output-$(date -u +%Y%m%dT%H%M%SZ)"
set -o pipefail
node --experimental-strip-types scripts/stage3-replay.mjs "$RUN_DIR" | tee stage3-replay-console.log
```

The replay is sequential and uncached. Search reads are paced at a minimum of 1 second plus up to 250 ms jitter, with a maximum of 5 pages per query. The planning estimate supplied for this run is about 825 requests, or roughly 14–17 minutes before rate-limit backoff; this is an estimate, not a guarantee. Detail reads for good graded tokens missing from pools add requests and time.

A new output directory has no prior `incremental-state.json`, so the run starts as a full replay. Do not reuse a previous run's directory when a full replay is intended.

## 4. Expected artifacts

The CLI prints a machine-readable JSON summary containing the output directory, file paths, hunt count, incomplete hunts, search/detail request counts, drop count, missing-good classification counts, and incremental/full-run status. Verify that all of these files exist in the printed directory:

- `summary.json` — compact run summary and exact artifact paths.
- `hunt-pools.json` — per-hunt listing/token pools; in incremental runs these are delta-only.
- `retrieval-report.json` — query plan summary, search/detail requests, delays, 429s, stop events, circuit-breaker state, and incomplete hunts.
- `drop-log.json` — deduplicated/skipped listings with reasons.
- `size-distribution.json` — per-hunt unique token count, requests/pages, completion state, and reasons.
- `city-distribution.json` — per-hunt observed city field counts, including `(missing)`; this is observed listing data, not proof that a city filter worked.
- `overlap-inputs.json` — each token and the hunt IDs whose pools contain it.
- `missing-good-classification.json` — grade 1–3 tokens absent from their hunt pool, classified from a fresh detail read as `live`, `expired`, or `unclassified`.
- `incremental-state.json` — persistent per-hunt known-token union, last-read timestamp, last overlap token, and last-run completeness.

Do not infer missing files from the summary alone: inspect the directory and preserve the full artifacts.

## 5. Read and assess the summary

1. Check `huntCount` against the expected 70 hunts.
2. Review `incompleteHunts` and each corresponding entry in `size-distribution.json`; an incomplete hunt is not a successful complete pool.
3. In `retrieval-report.json`, inspect 429 counts, delay events, per-query stop reasons, and whether the circuit breaker opened.
4. Check `drop-log.json` and ensure every skipped/deduplicated item has a reason.
5. Compare `city-distribution.json` against expectations; do not assume textual city filtering produced the requested city.
6. In `missing-good-classification.json`, separate `expired` from `live` (still live but missed) and `unclassified`. Unclassified details mean the replay is not fully classified.
7. Confirm `summary.json` points to the same run directory and that the output directory is preserved unmodified for review.
8. The incremental flag is derived from whether the prior state contains any known tokens. If `incremental: true`, `hunt-pools.json` contains only newly found tokens; use `incremental-state.json` for the accumulated known-token set. Do not treat the delta pool as a full pool.

## 6. Handling rate limits, circuit breaker, and incomplete hunts

- **HTTP 429:** the executor records the response and applies exponential cooldown beginning at 60 seconds, capped at 600 seconds, before retrying. Preserve these events in the report; do not bypass the pacing or restart repeatedly to evade a rate limit.
- **Circuit breaker:** after 5 consecutive request/response failures, the executor opens the circuit for 60 seconds and stops further query processing for that replay. Treat affected hunts as incomplete. Stop and send the run evidence to the architect rather than attempting to bypass the guard.
- **Incomplete hunt / stop reason:** retain the pool and its `incompleteReasons`; do not silently rerun only the failed hunt or combine outputs from different runs. The architect decides whether a fresh run is warranted.
- **Detail status:** HTTP 404/410 is classified as expired; unexpected statuses or missing/unusable detail sections remain unclassified. Do not relabel them by inference.
- **Process error or interrupted run:** keep the console log and partial output directory, mark the run incomplete, and report it. Do not present a partial run as a complete 70-hunt result.

## 7. Incremental second pass

To run an incremental pass, reuse the same output directory so `incremental-state.json` is loaded:

```sh
set -o pipefail
node --experimental-strip-types scripts/stage3-replay.mjs "$RUN_DIR" | tee stage3-replay-incremental-console.log
```

The run stops each individual query when it encounters a known token; that overlap does not prevent later queries in the same hunt from running. In incremental mode, `hunt-pools.json` is delta-only and `incremental-state.json` preserves the union of known tokens. Keep full-run and incremental-run artifacts separate for evaluation and label them clearly.

## 8. Evidence handoff

Send the architect:
- exact branch name and full HEAD SHA;
- CI run URL/ID for that same SHA;
- the complete printed summary and console log;
- the complete output directory, especially all files listed above;
- any interruption, 429, circuit-breaker, unclassified detail, or incomplete-hunt notes.

Do not report a retrieval percentage or pass/fail claim until the architect has checked the actual run artifacts and the frozen Stage 1 reference.
