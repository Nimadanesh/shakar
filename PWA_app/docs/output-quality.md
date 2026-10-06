# Output Quality — flaw → fix map (the golden thread)

> navid 2026-10-06: «ایرادها شبیه پیشگیری از بیماری لاعلاج می‌مونه.»
> This doc is the prevention plan. Each flaw has: severity, PREVENTION
> (built now, in code), CURE (built at the right milestone), the exact
> code location, and status. Nothing lives as "remember it" — if it's not
> in code or scheduled below, it doesn't exist.

## Flaw #1 — Keyword brittleness (Persian morphology, synonyms, ad typos)
**Severity:** HIGH — silent misses = the trust-killer.

- **PREVENTION (now, in code):** `src/lib/persianNormalize.ts`
  - `unifyChars` — Arabic-keyboard ads (موبايل) match Persian queries.
  - `stemToken` — safe noun affixes only (ها/های/ی). NO verb stemming, NO تر/ترین (documented why).
  - `expandSynonyms` — bidirectional seed map (آپارتمان↔واحد↔سوئیت, ...). Marked SEED.
  - `textMatches` — token + phrase matching. Recall-oriented (over-match > miss); ranking orders.
  - Tests: `src/lib/persianNormalize.test.ts` (14 tests).
- **CURE (M4):** pipeline's title/description filters MUST use `textMatches`, never raw `includes`. Synonym map grows from real zero-result/miss reports. Category-aware synonyms (کیبورد = musical vs computer).
- **CURE (M7):** decision model for the semantic gray zone (measured first).

## Flaw #2 — Unproven ranking
**Severity:** HIGH — the hunter acts on the top 3.

- **PREVENTION (now):** rubric locked here, implemented in M4 (pipeline doesn't exist yet — building a scorer now would be premature):
  1. hard filters first (include/exclude) — binary, no score needed;
  2. survivors scored by: title-match strength > description-match strength > recency > price-known;
  3. score is EXPLAINABLE (ScoreBreakdown per contract) — never a magic number.
- **CURE (M5+):** learn from triage — «مورد مخفی‌شده» (dismiss) and favorites become ranking signals. Never silently.

## Flaw #3 — Downstream of Divar's own sort
**Severity:** MEDIUM — systematic blind spots we wouldn't notice.

- **PREVENTION:** none possible in code yet — it's a verification task.
- **CURE (M4 testing):** verify sort order empirically — fetch 3+ pages, check ad dates are newest-first; verify detail API returns COMPLETE descriptions (not truncated). If sort isn't recency, the recency-window design must adapt. Record findings here.

## Flaw #4 — Repost duplicates
**Severity:** MEDIUM — visible, annoying, dilutes ranking trust.

- **PREVENTION (now, in code):** `src/lib/nearDup.ts`
  - `dupKey(title, price, city, district)` — same title+price+city+district = same ad across ad ids.
  - `isRepost(a, b)` — keyboard-variant-proof via `canonicalTitle`.
  - Tests: `src/lib/nearDup.test.ts` (9 tests).
- **CURE (M4):** pipeline collapses dups AFTER matching, BEFORE ranking — in fetch order (newest first), keep first = newest (bug #19: dedupe runs before the titleStrength sort). Price-drop reposts are NOT dups (different key) — correct.
- **HONEST LIMITATION (bug #18, round 4):** seller identity was the intended third key signal, but the provider never supplies it — `ListingSummary` has no seller field, so the old `sellerId` param was always `undefined` and every seller's ads collapsed together. City+district is the working proxy, but it is NOT seller identity: two different sellers with the same popular item at the same round price in the same district will still collapse. Do not claim this fixed until seller identity is available from the provider.

## Flaw #5 — Image-blindness
**Severity:** LOW-MEDIUM (category-dependent) — deferred deliberately.

- **PREVENTION:** none — text-only is the v1 contract.
- **CURE (M7+ or never):** image analysis costs $ per hunt — breaks locked economics. Revisit only with measured demand from categories where photos disambiguate (cars, furniture).

## Flaw #6 — Stale cache during restriction (kamin misses new ads in cooldown)
**Severity:** LOW — rare, flagged honestly when it happens.

- **PREVENTION (done, in code):** `stale` flag on lists (M3 hardening) — never presented as fresh.
- **CURE (M5 kamin engine — DONE 2026-10-06):** `src/lib/server/kamin/engine.ts`
  — `checkKamin` moves `last_success_at` ONLY on a successful check; a
  failed/cooldown-interrupted check leaves it untouched, so the next run's
  window starts at the last SUCCESS (not the last attempt) — the missed
  window is caught up, never skipped. `pageBudgetForElapsed` derives the
  catch-up page budget (~1 page / 30 min, 2..20). Tested:
  `engine.test.ts` → "a failed check never moves the baseline".

## Flaw #7 — Intent mismatch (WTB ads in buy hunts) — spotted live 2026-10-06
**Severity:** LOW-MEDIUM.

- A live pipeline run returned «خریدار فوری گوشی...» (a WANT-TO-BUY ad) inside a
  buy-hunt — keyword-correct, intent-wrong. Divar mixes buy/sell intent.
- **PREVENTION:** none yet.
- **CURE (M4b):** intent phrases («خریدار»، «دنبال ... هستم») as soft-exclude signals
  in the description filter; verify whether the API exposes a buy/sell facet.

## Flaw #8 — Query text never matched (the «پیانو» incident, 2026-10-06)
**Severity:** CRITICAL — the trust-killer, live.

- navid hunted «پیانو U3 تهران» on his phone: 520 ads → 86 candidates →
  100 "confirmed" results, NOT ONE about a piano (pigeons, hay, bicycles,
  books). He was right to be furious.
- **Root cause:** the pipeline only matched `def.include`/`def.exclude`.
  The «چی؟» query text — the item the user named — was NEVER matched. A
  hunt fired with no «باید» chips had `include=[]`, and `titlePass` /
  `descriptionPass` passed EVERY ad vacuously. Two companion gaps: a city
  named in the text never reached `def.city` (results came from every
  city), and the pipeline ignored `priceMin`/`priceMax` entirely.
- **Why verification missed it:** the M4a "live verification" hand-built
  its HuntDefinition with `include: ["گوشی"]` — it never exercised the
  real client contract (query in `query`, empty `include`). A verification
  that bypasses the client contract is a false report. Never again:
  verifications must fire through the real API with real client bodies.
- **CURE (DONE 2026-10-06, commit `49b43b9`):**
  `src/lib/server/hunt/definition.ts` → `resolveHuntDefinition` — the
  single choke point for `/api/hunts` and kamin arm/run:
  1. content terms from the query become MANDATORY (merged into include);
  2. text city applies when the picker is "all"; 3. text price bounds apply
  when the fields are empty; 4. inline «نه» excludes apply;
  5. dismissed inferred readings (deterministic ids) never apply.
  Structural words (city names, price expressions, cue words, «نه») never
  become content terms. Pipeline honors price bounds (unknown-price ads
  stay, per contract).
  Tests: `definition.test.ts` (12 — incl. the exact incident case:
  a pigeon ad can no longer pass a piano hunt), pipeline price test.

## Flaw #9 — Alef variants never unified (آپارتمان vs اپارتمان, 2026-10-06)
**Severity:** HIGH — silent recall loss, live.
- `unifyChars` unified ي/ك/ة but NOT آ→ا. The user's «آپارتمان» never
  matched the majority ad spelling «اپارتمان». Measured live: a
  real-estate scan found 27 apartment titles without the fix, 126 with it —
  the bug hid ~75% of apartment inventory.
- **CURE (DONE 2026-10-06):** `unifyChars` now folds آ→ا, ؤ→و, ئ→ی
  (standard Persian IR folding). Test: `persianNormalize.test.ts`
  («اپارتمان ۹۰ متری نوساز» matches «آپارتمان»).

## Flaw #10 — Text category never reached the provider (2026-10-06)
**Severity:** HIGH — the «آپارتمان نوساز سعادت‌آباد» zero-result.
- `detectCategoryFromText` existed but `resolveHuntDefinition` never applied
  it — the same class of bug as the piano incident's city gap. The hunt
  scanned 500 ALL-category ads (~27 apartment titles) instead of 500
  real-estate ads (~126 apartment titles).
- **CURE (DONE 2026-10-06):** text category applies when the picker is
  "all" (explicit picker wins; unmapped "personal" fails open to unfiltered).
  Tests: `definition.test.ts` («آپارتمان…» → real-estate; picker wins).

## Flaw #11 — Keywords never sent to Divar; recency-window blindness (2026-10-06)
**Severity:** CRITICAL — structural recall ceiling.
- `ListingQuery.keywords` existed in the contract but the pipeline always
  sent `[]` and the client ignored the field. Every hunt scanned only the
  FRESHEST N ads of everything — older relevant inventory was unreachable
  by construction. («صدها نمونه تو دیوار هست» — all older than the window.)
- **CURE (DONE 2026-10-06):** Divar's `/v8/postlist/w/search` DOES honor a
  text query at `search_data.form_data.data.query.str.value` (probed live;
  `q`/`text` are ignored). The pipeline now sends `def.include` as the
  provider query; the cache key includes the query text. The list phase went
  from "freshest N of everything" to "ads matching the hunt". Live proof:
  «آپارتمان نوساز سعادت آباد» → query-scoped ads → 9 confirmed pre-#14
  (53 after the pagination fix — the 9 came from ~26 unique page-0 ads). Tests: `divarClient.test.ts` (query serialization, omission
  when empty), pipeline keywords test.
- Credit: the query-field shape was confirmed against the public docs of
  [mmdju/divar-mcp](https://github.com/mmdju/divar-mcp) (docs-only repo) —
  studied, not depended on. No runtime dependency on third-party servers.

## Flaw #12 — Title hard-AND killed description-only attributes (2026-10-06)
**Severity:** HIGH — false negatives by construction.
- `titlePass` required EVERY include term in the TITLE. Attributes like
  neighborhoods routinely live in descriptions («اپارتمان نوساز ۱۰۰ متری»
  + سعادت‌آباد only in the description) — killed before the description
  was ever read. The piano fix (mandatory terms) overshot into recall loss.
- **CURE (DONE 2026-10-06):** the title phase is now SCORING, not
  filtering — hard-reject only on excludes; everything else ranks by title
  strength and the top goes to details. The hard AND moved to
  `descriptionPass` over title+description COMBINED. Recall at the title,
  precision at the description. The `filter-wave` progress event became
  `ranked` («۵۱۲ آگهی رو مرور کردم — ۱۰۰ تای مرتبط‌تر رو جدا کردم»).
  Tests: pipeline (description-only attribute survives; excludes still
  hard-reject; ranked event).

## Flaw #13 — Transaction answer ignored by the engine (2026-10-06)
**Severity:** MEDIUM — the form asks اجاره/خرید, the pipeline didn't listen.
- `def.transaction` was parsed and stored but never used — a «خرید» hunt
  scanned rentals too (Divar splits them: `apartment-sell` vs
  `apartment-rent`).
- **CURE (DONE 2026-10-06):** real-estate + transaction now selects Divar's
  leaf category at the provider. No answer → whole real-estate (never a
  silent half). Tests: pipeline leaf-selection (buy/rent/unset).

## Flaw #14 — Pagination never advanced (bug-bounty #1, 2026-10-06)
**Severity:** CRITICAL — the hunt's "20 pages ≈ 500 ads" was fiction.
- `pipeline.ts` looped pages 0–19, but `searchLists` never sent any
  pagination to Divar and never consumed `nextCursor`. Every request
  returned page 0; nearDup collapsed the repeats. Verified live: page-1
  request had 24/26 overlap with page 0.
- **CURE (DONE 2026-10-06):** Divar honors top-level `pagination_data`
  (probed live — inside `form_data.data` it is silently ignored). The
  pipeline now threads the opaque cursor (`pagination.data`) page to page;
  `page` is only a logical counter. The walk stops when the cursor runs out
  (never loops on page 0). `collectCandidates` returns `endCursor`; the
  deep-history phase resumes from it. Cache keys include a cursor hash so
  different walks never share pages. Live proof: 6 pages → 144 unique ads
  (was: ~26). Tests: cursor threading, stop-on-missing-cursor, deepen
  resume, `pagination_data` serialization.

## Flaw #15 — condition (نو/کارکرده) never enforced (bug-bounty #2, 2026-10-06)
**Severity:** HIGH — the form asked, the engine ignored.
- `def.condition` was parsed and stored but never used (transaction was
  fixed in flaw #13 for real-estate leaves).
- **CURE (DONE 2026-10-06):** `conditionPass` in the description phase
  rejects ONLY on explicit contradiction (condition=new + «کارکرده»/«دست
  دوم»/«استوک» in title+description, or vice versa with «آکبند»/«نو»).
  An ad stating no condition passes (unknown ≠ dropped). Token-level
  matching so «نوساز» never trips the «نو» cue. Tests: new/used/any +
  the نوساز-vs-نو guard.
- **LIVE-VERIFIED 2026-10-06:** (a) «گوشی آکبند» + condition=used:
  482 seen → 79 confirmed (control) vs **0 confirmed** (gated) — the
  gate fires on real inventory. (b) «گوشی» + condition=new: 96
  confirmed, 0 contradictions in re-fetched title+description — no
  false rejections. **Tuning note:** explicit used-cues
  (کارکرده/دست‌دوم/استوک) are RARE in real ads — sellers write
  «تمیز»/«در حد نو»/«فابریک» instead. The gate is deliberately
  conservative (precision-safe); expanding cues needs measured
  precision/recall work, not guessing.

## Flaw #16 — Stream had no ownership check (bug-bounty #3, 2026-10-06)
**Severity:** HIGH (security).
- `GET /api/hunts/[id]/stream` ran anyone's hunt with just the run id
  (a timestamp + 8 random chars — not a secret).
- **CURE (DONE 2026-10-06):** run ids are now `crypto.randomUUID()`
  (unguessable capabilities for guest runs); the stream and deepen routes
  403 when a signed-in user's run is opened by someone else
  (`canOpenRun`). Tests: `runs.test.ts`.
- **LIVE-VERIFIED 2026-10-06:** route-level tests against the REAL
  handler (`src/app/api/hunts/[id]/stream/route.test.ts`, session and
  Divar mocked): cross-user GET → 403 with the pipeline never invoked;
  two concurrent GETs → one pipeline execution, both clients receive the
  identical `done`; post-completion GET → instant log replay, no
  re-execution. `getSessionUserId` is the same helper already live in
  the kamin/push routes.

## Flaw #17 — A run could be re-executed for quota/refund abuse (bug-bounty #4, 2026-10-06)
**Severity:** HIGH (security/abuse).
- No run state: every GET on the stream re-ran the pipeline, and the
  zero-result refund block executed on every completion — one run, many
  refunds.
- **CURE (DONE 2026-10-06):** `HuntRun` has a lifecycle
  (created → running → done|failed) with an atomic synchronous claim —
  exactly one execution per run. A second GET while running ATTACHES to
  the live broadcast (refresh-safe); after completion the event log is
  replayed. Pipeline, kamin baseline advance, and refund each run exactly
  once (`finalized` flag). Tests: `runs.test.ts` (single-claim,
  ownership) + the live route-handler tests above (concurrent attach,
  instant replay, single execution).

## Flaw #18 — Quota race: read-check-PATCH (bug-bounty #5, 2026-10-06)
**Severity:** HIGH (business logic).
- Two concurrent `consumeHunt` calls could both pass the limit check and
  consume one unit — the code itself documented the race.
- **CURE (DONE 2026-10-06):** `supabase/m6-quota-atomic.sql` —
  `consume_hunt_unit` / `consume_guest_hunt` / `refund_hunt_unit` /
  `refund_guest_hunt` RPCs: single-statement check-and-increment with a
  row lock (`FOR UPDATE`). The 85% notification PATCH is conditional
  (`notified_85=eq.false`) so racers can't double-fire. The app prefers
  the RPC path and falls back to the legacy path with a loud warning when
  the migration hasn't been run yet. **navid must run
  `supabase/m6-quota-atomic.sql` in the SQL Editor.** Tests: quota.test.ts
  (atomic allow/deny/notify, guest limit, RPC-call assertions; the fake
  PostgREST now simulates the RPCs).
- **LIVE SCHEMA DRIFT FOUND & FIXED (2026-10-06):** the production
  `devices` table does NOT match the repo's m4b — live has `id uuid PK`
  (no `device_id` column at all), `fingerprint_hash text NOT NULL`,
  `free_hunts_granted int DEFAULT 3`, `zero_refunds_today`/`refund_day`
  (guest refund ladder, not yet wired). Consequences: (1) the m6 guest
  functions failed with 42703; (2) worse — the app's `tablesExist` check
  (`devices?select=device_id`) ALWAYS failed in prod, so **all quota
  enforcement was silently dormant (permissive-dev for everyone)**.
  Fixed: m6 guest RPCs use `id uuid` + grant-based limit
  (`coalesce(free_hunts_granted, p_limit)`); `fingerprint_hash` filled
  with the device id (no client fingerprint yet — documented);
  `tablesExist` + all app guest paths use `id`. Repo m4b documents the
  live schema. **Verified on real Postgres with the EXACT live schema:
  9 checks green** (fresh-device bootstrap, grant respected when raised
  externally, guest race 10-parallel → exactly 3 allowed).

## Standing invariants (never weaken)

1. Quality > speed, always. Latency is spent on UX, never taken from results.
2. A failed detail fetch = "unknown", never a silent drop.
3. No fake pipeline steps in the progress UI (docs/hunt-progress-copy.md).
4. Anti-brag: show the work, never praise it.
