# Shekar Search Engine — Architecture & Logic

**Scope:** repository source snapshot at `main` @ `10f3c40d70748ff27d6928eaed0875e10dab1c56` (engine-v2 merge, 2026-10-21), also used as the code baseline for the isolated `engine_v3` branch. V3's only source change so far is a behavior-preserving `let` → `const` cleanup in `contract.ts`; no engine behavior has changed. This is a source-code description, **not a fresh verification of the deployed production runtime**. It describes what the code is: modules, data flow, decision order, and where ads live or die. Where the shape is known to be poor, the document says so instead of tidying it up.

---

## 1. The one-paragraph version

A hunt arrives as form fields + one free-text query. `definition.ts`
turns that into a **HuntDefinition** (subject terms, MUST / SHOULD /
MUST-NOT constraints, category, city, price bounds, transaction and
condition dimensions) using the deterministic interpreter
(`interpret.ts`) and the **intent contract** (`contract.ts`).
`pipeline.ts` then runs two big phases: **collect** (paged Divar list
search through the polite provider, title-phase filtering, dedupe,
price bounds) and **confirm** (detail fetches in batches of 10,
per-ad evaluation against the definition, deterministic scoring and
ranking). A local LLM judge (Mizan) runs *after* ranking in
**log-only shadow** — it records what it would have decided and never
changes output. Results stream to the client as `HuntEvent`s and land
in `ScoredAd[]` + `HuntStats`. The same pipeline is reused by the
**kamin** (saved-hunt) engine, which diffs new runs against a baseline.

Everything is deterministic at runtime. There is no runtime LLM in the
decision path (Decision v2, 2026-10-20).

---

## 2. Module map (the code's actual shape)

```
src/lib/
  interpret.ts            837 ln  free-text → structured guesses
  persianNormalize.ts     281 ln  char folding, tokenize, stemming, synonym concepts
  normalizePersian.ts           Latin-case folding for matching
  dimensions.ts                 transaction / condition required dimensions
  server/
    divar/
      provider.ts               Divar API client (postlist search + post detail)
      divarClient.ts            provider instance + budgets
      taxonomy.ts               category tree bridge, city → Divar ids
      throttle.ts / cache.ts    politeness: 1.0–1.8 s jitter, TTL caches, 429 cooldown, breaker
    hunt/
      definition.ts       311 ln  request body → HuntDefinition (the front door)
      contract.ts         444 ln  intent contract: polarity-safe term extraction
      pipeline.ts        1407 ln  collect + confirm + score + rank (the engine room)
      semantics.ts       1400 ln  per-ad semantic judgments (absence, roles, kinds…)
      kindLexicon.ts      328 ln  title-head → item-kind tables and the kind gate
      mizan.ts            339 ln  Mizan judge client (shadow only)
      runs.ts             769 ln  run lifecycle, quota, idempotency, leases
      slugCapture.ts      114 ln  Step 0.5: breadcrumb (category) capture, fail-open
    kamin/
      engine.ts           914 ln  saved hunts: tick, baseline diff, notifications
```

Consumers (only two):

- `src/app/api/hunts/[id]/stream/route.ts` — user hunts (SSE stream,
  quota, fairness refund, completion side-effects).
- `src/lib/server/kamin/engine.ts` — cron-driven saved hunts via
  `POST /api/internal/kamins/tick`.

---

## 3. Stage 0 — Definition (`definition.ts` + `interpret.ts` + `contract.ts`)

Input: the hunt form (query text, include/exclude lists, category,
city, price range, transaction, condition) as posted by the client.

1. `toHuntDefinition(body)` validates and normalizes the form into a
   `HuntDefinition` (declared in `pipeline.ts:73`).
2. `resolveHuntDefinition(body)` enriches it from the raw query:
   - `interpretQuery` (`interpret.ts`) guesses category, city,
     transaction (`detectTransaction`), condition (`detectCondition`),
     price bounds, and *applied* interpretation chips (which the user
     may dismiss — dismissals are honored downstream).
   - **The intent contract** (`buildContract`, `contract.ts:106`)
     extracts the mandatory content terms from the query text with
     polarity discipline: absence phrases («بدون رنگ») become
     MUST-NOT constraints and *never* content terms (the inversion
     that Experiment B killed); purpose clauses route to SHOULD;
     fillers are dropped on record. Form-provided include terms merge
     first and win.
   - Dimensions (`dimensions.ts`): transaction and condition are
     *required dimensions* — text evidence overrides the form, at most
     one blocking dimension, "no preference" is a real answer.

Output: one immutable `HuntDefinition` per hunt. Everything downstream
is a function of this object plus Divar's inventory.

---

## 4. Stage 1 — Collect (`pipeline.ts:971` `collectCandidates`)

- **Phase 1 — list pages.** Cursor-chained pages from
  `divarProvider.searchLists` (max 20 pages). The provider is a polite
  client, not an evasion tool: jittered throttle (1.0–1.8 s), 8 s
  timeout, list cache 3 min (10 min in deep mode), 429 → exponential
  cooldown (60 s → 10 min), circuit breaker after 5 failures, stale
  cache served with an honest `stale` flag.
  The text query rides in `search_data.form_data.data.query.str.value`
  (the only field Divar's `/v8/postlist/w/search` honors).
- **Phase 2 — title scoring + shortlist.** Each listing gets a
  title-strength score (subject-term evidence in the title). Recall-
  oriented: weak titles are *kept as candidates*, not dropped — the
  detail phase is where ads die.
- **Phase 3 — near-dup collapse.** Same seller + same normalized title
  ⇒ one candidate (`dupKey`, `pipeline.ts:310`).
- **Phase 3b — price bounds.** Hard filter against the definition's
  price range (1000-toman placeholders are "price unannounced", never
  a price).

Output: `Candidate[]` + running `HuntStats` (`adsSeen`, `candidates`,
`titleRejected`, `dupsCollapsed`, …).

## 5. Stage 2 — Confirm (`pipeline.ts:1114` `confirmCandidates`)

Candidates are sorted by title strength and detailed in batches of 10,
up to `MAX_DETAILS_PER_HUNT = 100` (env-overridable for lab runs).
**This budget order is a known weakness**: it is spent by literal title
strength, so model-named ads with weak titles can starve (audit G1).

Per candidate:

1. **Detail fetch** (`divarProvider.getDetail`, 60-min cache). A failed
   or *stale* detail marks the ad `detailUnknown` — shown at half
   score, never silently dropped. A fresh detail also yields the ad's
   leaf `categorySlug` (used for kind corroboration here, and captured
   to the corpus by `slugCapture.ts` — fail-open, observation only).
2. **Evaluation** (`evaluateDescription` → `DescriptionEvaluation`,
   `pipeline.ts:429`). The deterministic core, in order:
   - *Contract terms*: MUST terms evidenced in title/description →
     `evidence[]`; unevidenced MUSTs → `missingInfo[]` (UNKNOWN —
     never by itself a rejection).
   - *MUST-NOT / absence*: `assessAbsencePolarity` (`semantics.ts:299`)
     reads present/absent spans with a synonym bridge («تصادف» ⇐
     «رنگ», «ضربه»); explicit affirmations of an excluded attribute
     reject; both-polarity texts are conflicts, treated as UNKNOWN.
   - *Exclusions*: `exclusionFires` (`semantics.ts:385`) over
     normalized text.
   - *Kind gate*: `kindGateRejects` (`kindLexicon.ts:237`) — the
     title's head noun maps through `HEAD_KIND` (75 entries) to an item
     kind; a confident wrong-kind (part/accessory/equipment/service
     vs the hunt's target kind) rejects, *unless* the hunt's own intent
     seeks that kind (the intent guard, R12). Part markers
     (`PART_MARKERS`, 38 entries in `semantics.ts`) can also reject —
     **the same ad can die in two places** (known duplication).
   - *Roles*: `assessListingRole` / `rolesClash` (`semantics.ts:454`,
     `548`) — buyer-seeking ads on seller hunts (and vice versa)
     demote; dealer («خریدار») ads demote on seller-seeking hunts.
     Demotion is rank pressure, not deletion.
   - *Bait / demand-goods*: price-bait and "wanted"-style goods posts
     demote to near (R12: reject → demote).
   Verdict per ad: **exact** (all MUSTs evidenced), **near** (some
   MUSTs UNKNOWN), or **rejected** (affirmative counter-evidence only —
   UNKNOWN never deletes).
3. **Scoring** (`scoreAd`): exact base 2.5 / near base 3.5 scaled by
   evidence counts (title MUSTs weigh more), minus demote penalties;
   `detailUnknown` halves the score. Sort keys: matchKind first, then
   score (`pipeline.ts` ranking block, Phase 5).
4. **Judge shadow** (Phase 5b): the top-24 of the *final ranking* go to
   Mizan (`adjudicateAd`, `mizan.ts:143`; kind from title only,
   violation from title + first 800 chars of description) under a 60 s
   wall-clock. Verdicts are written to `stats.mizanShadow` with
   would-be rejection flags. **Nothing is applied.** In production no
   Mizan endpoint is configured, so this block is inert there; it
   exists for the lab and for Decision v2's §3 channel trials.

Output of the stage: ranked `ScoredAd[]`, completed `HuntStats`
(including `rejectedSample` — up to 12 rejected ads with their firing
kind, kept for the false-rejection audit), and the Step 0.5 capture
flush (counts in `stats.slugCapture`).

## 6. Output path — how results reach a human

`runPipeline(def, emit)` (`pipeline.ts:1395`) = collect → confirm →
`emit({type:"done", results, stats})`. The stream route wraps it:
SSE events (`started`, `lists`, `details-batch`, `done`), quota
accounting in `runs.ts` (a zero-confirmed hunt is refunded; refinement
of an existing hunt costs no quota — the unit buys fresh fetches),
`finalizeRun` (exactly-one closer, lease release), then completion
side-effects (kamin baseline seeding, notifications). The results UI
renders `ScoredAd`s: exact results first, near results labeled as
near-misses with their `missingInfo` named — the engine's uncertainty
is shown, not hidden.

Kamins run the same pipeline on a cron tick, diff confirmed ads
against the hunt's baseline, and notify on genuinely new matches.

## 7. Invariants the code is built around

1. **UNKNOWN never deletes and never compels.** Deletion requires
   affirmative, span-bound counter-evidence.
2. **Doubt = keep** (demote at most), because a wrong kill costs the
   user a deal and a wrong keep costs a glance.
3. **Founder grades are the only quality stamp.** Batteries are
   regression instruments; the human verdict is the gate.
4. **Fail-open side channels.** Judge down, capture down, stale
   details — the hunt always completes deterministically, and every
   degradation is counted in stats rather than hidden.
5. **Politeness is a feature.** Throttle, cooldowns, breaker, budgets —
   the client behaves like a good citizen of Divar's API.

## 8. Known shape-debts (so the doc stays honest)

- Patch-round sediment: 12 rounds of marker lists and narrow rules
  (see the dirt inventory, `~/workspace/engine-audit/code-dirt-inventory.md`).
- The detail budget is allocated by title strength (Stage 2 note).
- Kind rejection lives in two places (Stage 2, kind gate note).
- `pipeline.ts` and `semantics.ts` are each ~1,400 lines and carry
  several responsibilities apiece.
- The alias table (ماشین/خودرو/اتومبیل) exists in `persianNormalize.ts`
  but most `textMatches` call sites in the pipeline do not pass a
  category, so subject evidence is narrower than the table suggests
  (audit G-table).
- The smart-engine plan (knowledge layer + judge at coverage) is
  *not* in this codebase yet; this document describes the engine that
  is live, not the one being built toward.
