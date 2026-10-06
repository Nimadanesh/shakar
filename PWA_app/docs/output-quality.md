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
  - `dupKey(title, price, sellerId)` — same title+price = same ad across ad ids.
  - `isRepost(a, b)` — keyboard-variant-proof via `canonicalTitle`.
  - Tests: `src/lib/nearDup.test.ts` (6 tests).
- **CURE (M4):** pipeline collapses dups AFTER matching, BEFORE ranking — keep newest. Price-drop reposts are NOT dups (different key) — correct.

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
  «آپارتمان نوساز سعادت آباد» → 520 query-scoped ads → 9 confirmed
  (was: 0). Tests: `divarClient.test.ts` (query serialization, omission
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

## Standing invariants (never weaken)

1. Quality > speed, always. Latency is spent on UX, never taken from results.
2. A failed detail fetch = "unknown", never a silent drop.
3. No fake pipeline steps in the progress UI (docs/hunt-progress-copy.md).
4. Anti-brag: show the work, never praise it.
