# Shakar — Master Product & UX Flow V1

> Product/UX source of truth for MVP. Persian-first, RTL, mobile-first, dark theme.
>
> Core principle: Shakar reduces the amount of listing inspection a professional user must perform. It is a Professional Hunt Workspace, not a marketplace clone.

---

# 1. Product Mental Model

Shakar is a tool for professional hunting. The user arrives with a concrete need and wants to reach relevant, trustworthy candidates with minimum inspection.

Core loop:

~~~text
NEED → HUNT SETUP → PAID SEARCH → TRIAGE → VERIFY → ACT → MONITOR
~~~

**The golden rule: یک شکار = یک واحد اشتراک.** The product sells a monthly
subscription for a fixed number of hunts — there is deliberately NO per-hunt
price and the UI never shows one. Each hunt still costs real inference money;
the subscription quota is what bounds it. Defining the hunt is FREE and
happens BEFORE any quota is consumed: the hunt-definition form (what,
include/exclude, category, city, price) collects everything up front, on ONE
page. The «شکار کن» button is the single event that consumes one hunt.
There is no search-then-refine — because there is no search at all. The
product has ONE concept: شکار.

A paid hunt is a persistent asset, not an ephemeral query. The result set
gets its own canonical URL (`/hunt/[id]`) so it survives back-navigation,
app kills and tab switches, and stays reachable from hunt history. Money
was spent on it — the product must treat it accordingly.

The pro habit loop is notification → diff → triage → act. A day-10 session
should start from a Kamin notification, never from the setup screen.

Hunt Setup asks «دقیقاً چی می‌خوام و چی نمی‌خوام؟» BEFORE asking the
backend anything. Triage asks «کدام نتیجه ارزش باز کردن دارد؟». Verify
asks «واقعاً مناسب است؟». Act handles favorite/share/open-original/contact.
Monitor (کمین) lets the user repeat the hunt without rebuilding it and is
the engine of اوکازیون discovery — the professional user's #1 priority.

The central differentiation is content-aware search: include terms and exclude terms can operate on listing title/description. Example: query «پیانو اکوستیک یاماها U3», include [پیانو][اکوستیک][یاماها][U3], exclude [طرح اکوستیک][دیجیتال].

AI must simplify search, not replace it with a chatbot. Preferred model: natural language → structured, editable search → results.

Product principles: simple by default; powerful when needed; hunt-first; explain scores and matches; never silently relax user intent; preserve context; distinguish direct/detected/inferred/unknown information; progressive disclosure; one coherent workspace.

Primary UX question for every feature: does it reduce unnecessary listing inspection or make inspection more useful?

---

# 2. Professional User Persona

The primary persona is the Professional Hunter. Professional describes search behavior, not occupation.

Characteristics: frequent searching; specific goals; familiarity with category vocabulary; low tolerance for noise; compares candidates; repeats searches; monitors markets; values speed, precision, control and transparency.

Typical frustrations: keyword noise, misleading titles, important facts hidden in descriptions, repeatedly opening irrelevant listings, rebuilding searches, losing result position, and unexplained scores.

The product should not optimize MVP around casual browsing, entertainment or generic marketplace discovery. Discover can be future scope.

---

# 3. Core User Journey

Primary flow:

~~~text
(Onboarding →) Hunt Form: چی؟ → مشخصات شکار → «شکار کن» → Triage (/hunt/[id]) → Detail/Verify → Act → کمین/Monitor → Inbox diff (/saved) → Triage…
~~~

Onboarding runs once (first launch): value proposition («فقط همان چندتایی را ببین که واقعاً می‌خواهی.»), in three beats
(value line → «تعریف کن، شکار کن» → «کمین بذار»), then «شروع».

Example intent: «پیانو اکوستیک یاماها U3 در تهران، زیر ۲۰۰ میلیون؛ دیجیتال و طرح اکوستیک نمی‌خوام.»

The user expresses the full intent on Home (natural query + editable
interpretation + include/exclude + category/location/price), fires ONE paid
search, receives results, inspects promising candidates, favorites one,
saves the complete hunt, and arms کمین for new matches.

Hunt Setup, Pre-flight and the paid trigger are one continuous workflow. Do not
create unnecessary full-page navigation between Setup and Pre-flight, and
never run a paid hunt before the user has confirmed their intent at Pre-flight.
The paid result itself lives at its own canonical URL (/hunt/[id]).

---

# 4. Information Architecture

~~~text
Shakar
├── Onboarding (first launch only)
├── Auth (OTP sheet; guest-first, required only for persistent actions)
├── آگهی‌ها (Home = Hunt Setup)
│   ├── Hunt Setup (intent + precision, free)
│   ├── Pre-flight (free confirmation before the paid hunt)
│   ├── Hunt Result /hunt/[id] (triage of one paid, persistent result set)
│   └── Refine (edit intent → explicit re-run)
├── آگهی Detail
├── شکار من (LIVE — تب‌های تازه‌ها / کمین‌ها)
├── آرشیو (تب‌های تاریخچه / علاقه‌مندی‌ها / ذخیره‌شده‌ها)
└── پروفایل
    ├── Account
    ├── Subscription status
    └── Settings
~~~

Home IS the hunt-definition form — one page, three parts: (1) «چی؟» —
what is being hunted, a plain field (NOT a search box; Enter never fires);
(2) «مشخصات شکار» — include/exclude chips (inferred readings render dashed
until confirmed) plus category/city/price rows opening bottom-sheet
pickers; (3) the single «شکار کن» button. Monetization is a monthly
subscription for a fixed number of hunts — no per-hunt price is shown
anywhere, deliberately. Home never renders results and never fires
implicitly: firing is always the explicit «شکار کن» button.

Saved Search means «چیزی که دنبال می‌کنم». Favorite means «آگهی‌ای که پیدا کرده‌ام و می‌خواهم نگه دارم».

---

# 5. Navigation

MVP primary navigation:

~~~text
آگهی‌ها | شکار من | آرشیو | پروفایل
~~~

«کشف بازار» is removed from the tab bar (deferred per roadmap — it has no
defined job in the hunting loop and only adds noise).

آگهی‌ها is the hunt setup (home). شکار من holds the LIVE tabs the user is
waiting on (تازه‌ها / کمین‌ها — the bell points here). آرشیو holds the
on-demand tabs (تاریخچه / علاقه‌مندی‌ها / ذخیره‌شده‌ها). پروفایل contains
account/settings.

Opening Shakar should lead directly toward hunt setup; do not prioritize
marketing heroes, promotional banners or editorial content. The
«فقط همان چندتایی را ببین که واقعاً می‌خواهی.» value line lives in Onboarding, not on Home.

Back navigation must preserve query, include/exclude terms, filters, sort and useful result position. Notifications and saved-search actions must deep-link into their relevant context.

---

# 6. Page Map

Current route responsibilities:

~~~text
/onboarding → First-run value (tagline + 3 beats + شروع)
/          → Hunt Setup + Pre-flight (one continuous workflow; the ONLY paid trigger)
/hunt/[id] → Triage of one paid, persistent hunt (canonical, returnable URL)
/ads/[id]  → Ad Detail
/saved     → My Shakar (live: تازه‌ها / کمین‌ها tabs)
/archive   → Archive (تاریخچه / علاقه‌مندی‌ها / ذخیره‌شده‌ها tabs)
/profile   → Profile
(auth → bottom sheet over the interrupted action, not a route)
~~~

Route naming is implementation detail; responsibilities are authoritative.

| Page | Primary job | Must not become |
|---|---|---|
| /onboarding | Communicate value in ~10 seconds | Feature tour / marketing site |
| /auth (sheet) | Identify the user, then resume | A dead-end login wall |
| / | The hunt-definition form: چی؟ → مشخصات → «شکار کن» | Search-box mimicry |
| /hunt/[id] | Triage one paid result set, returnable forever | Ephemeral result list |
| /ads/[id] | Verify one candidate | Search dashboard |
| /saved | Resume hunts and catch new matches | Generic activity feed |
| /profile | Account/settings | Search workspace |

---

# 7. Page → Goal → Sections → Components → Interaction

Every future page spec must explicitly define Goal, Sections, Components and Interaction.

## Hunt Setup
Goal: define ONE complete hunt on ONE page, then fire it.
Sections: what (چی؟); specs — include chips, exclude chips, category row,
city row, price row; the single hunt action. No separate interpretation
panel, no precision sheet, no pre-flight confirm: the form IS the setup.
Components: WhatField, SpecChips, SpecRow, OptionSheet, PriceSheet,
HuntButton.
Interaction: fill what → curate chips (tap dashed to confirm inferred
readings) → pick specs from rows → «شکار کن» → land on /hunt/[id].
The form never auto-fires; Enter in the what-field never fires (a
subscription quota unit is at stake).

## Hunt Result (/hunt/[id])
Goal: rapid triage of one paid, persistent result set.
Sections: search summary, active constraints, count, sort, result list, states.
Components: SearchSummary, ActiveFilterChips, ResultCount, SortControl, AdList, AdCard, ShekarScoreBadge, WhyMatched, FavoriteButton.
Card must answer «این آگهی ارزش باز کردن دارد؟» whenever available evidence supports it.

## Ad Detail
Goal: verification.
Sections: gallery, core information, match explanation, relevant description evidence, remaining listing information, actions.
Components: ImageGallery, AdHeader, Price, LocationMeta, ListingAge, ShekarScoreBadge, WhyMatched, DescriptionEvidence, FavoriteButton, ShareButton, OpenOriginalButton.

## My Shakar (/saved) — the live page
Goal: the pro's morning inbox — what they are waiting for, in 1–2 taps.
Top segmented tabs: تازه‌ها (fresh kamin matches) | کمین‌ها (quiet watchers).
Kamin cards show the full hunt definition (query, include/exclude chips,
filters) so a hunt is recognizable days later; «دیدن نتایج» re-fires as a
new paid hunt; «غیرفعال کردن» is a two-step confirm secondary button.

## Archive (/archive) — the on-demand page
Goal: everything the user needs but doesn't follow: hunt history
(returnable /hunt/[id] rows), favorites, and saved hunts. Top segmented tabs:
تاریخچه | علاقه‌مندی‌ها | ذخیره‌شده‌ها (each with a live count).
- تاریخچه rows: query + one-line spec summary (city • category • price •
  age, same as home's RecentHunts) + two-step delete. Tap → triage.
- علاقه‌مندی‌ها rows: trailing heart toggles the favorite off in place.
- ذخیره‌شده‌ها: local hunt definitions. Save from the labeled
  «ذخیره‌ی این شکار» action under the kamin button on the triage page
  (deliberately NOT a bookmark icon — bookmark reads as per-ad, which is
  what the heart/favorites already does); tap a row to re-run it with one
  tap (records a fresh hunt); two-step delete. Empty state points at the
  triage action.

## Profile
Goal: account and settings only.

---

# 8. Search States

1. Hunt Form (initial): the «چی؟» field is a plain field, NOT a search
   box — it is one field of the hunt definition. Filling it reveals the
   specs on the same page: include/exclude chip sections (explicit solid,
   inferred dashed until confirmed) and category/city/price rows with
   bottom-sheet pickers. Defining the hunt is free; firing consumes one
   subscription hunt. The form never auto-fires (not even for deep links),
   Enter never fires, and home never renders results.
2. Typing: suggestions may appear, but never silently replace input.
3. Interpreting: inferred readings render directly inside the form's
   chips and rows (dashed, marked «حدسی»); tapping confirms them, ×
   dismisses them. Interpretation display is free; it never fires by
   itself.
4. Paid hunt: exactly one backend search per «شکار کن». The result set is
   persisted as a canonical `/hunt/[id]`. Loading preserves all state; use
   structural skeletons; prevent duplicate submit. No per-hunt price is
   shown anywhere — monetization is the monthly subscription quota.
5. Triage: show actual count, active constraints, sort and cards.
6. Refine: editing intent after results opens the form again; the CTA is
   explicitly «اجرای مجدد شکار» so the user knows it consumes another
   hunt from the quota.
7. No results: «با این شرایط نتیجه‌ای پیدا نشد.» with explicit «ویرایش شکار»
   and «حذف آخرین فیلتر». Never silently relax constraints.
8. Error: «دریافت نتایج با مشکل مواجه شد. شکار شما حفظ شده است.» with retry.

If interpretation is inferred, it must not appear as user-confirmed without an appropriate indication. Never invent result counts.

---

# 9. Result States

Normal cards show image, title, price, location/time, concise description evidence, score when available, match signals and favorite action.

Strong match may show evidence such as «تطابق بالا» plus explicit reasons. Partial/uncertain matches must expose uncertainty, e.g. «؟ وضعیت آکوستیک مشخص نیست».

Excluded-term detection must be factual, e.g. «حذف‌شده به دلیل: طرح اکوستیک». If a result remains visible despite an exclusion signal, the reason must be defined and consistent.

Cached/stale results must be labeled stale and show last update when available. Explicitly unavailable/sold ads must not appear as active candidates.

Skeletons must match real card dimensions and preserve layout stability.

---

# 10. Detail States

The detail page is verification, not an expanded card.

Above the fold priority: image, title, price, location, listing age, match status/score when available, why it matched.

Match explanation should use evidence, e.g. «شامل یاماها», «شامل U3», «تهران», «قیمت در محدوده شما».

Relevant description terms may be highlighted, but the seller's original description must remain intact. Never rewrite it in a way that changes meaning.

Where supported, distinguish Direct, Detected, Inferred and Unknown information. Unknown must remain unknown.

Negative evidence should be factual: «عبارت «دیجیتال» در توضیحات دیده شد» rather than an unsupported conclusion about seller intent.

Actions: Favorite/Unfavorite, Share, Open Original, and Contact only where legitimately exposed by the data source.

Back must restore the previous result/search context.

Triage cards link to the detail page carrying the hunt's exact evidence
context (`hunt` id + `q`/`inc`/`exc`/`cat`/`city`/`min`/`max` params), so
«چرا این آگهی نمایش داده شده؟» reflects the paid hunt's real terms —
including the query words the setup form auto-includes — and back returns
to `/hunt/[id]`. Entries without context (favorites: `from=saved`, direct
links) hide the why-section rather than inventing evidence.

---

# 11. Saved Search Flow

A Saved Search is a persistent hunting mission, not a bookmark.

It preserves query, include terms, exclude terms, category, location, price, supported structured filters and monitoring state.

Save flow:

~~~text
[ذخیره جستجو] → Name (suggested but editable) → Monitoring state → [ذخیره]
~~~

Saved Search card shows name, concise constraints, last run/check when available, new-match count when available and monitoring state. Primary action is rerun. Secondary actions are edit/delete/toggle monitoring where supported.

Editing must not unexpectedly mutate a saved search; use edit → apply/preview → save changes.

New-match notification should deep-link directly to the relevant results.

---

# 12. Auth: guest-first, gate on persistence

Guests can do the full hunt: setup, paid hunt, triage, detail inspection.
Authentication is required ONLY for persistent actions: Save Hunt, کمین
(monitoring), Favorite, and Profile. This is deliberate: a professional
tries the hunt first, commits identity when they want to keep something.

Required pattern:

~~~text
Hunt Setup → Pre-flight → Paid Hunt → Triage → Protected action → auth sheet → Resume interrupted action
~~~

Onboarding's «شروع» leads to Home as a guest — never to a forced login wall.

OTP flow (bottom sheet over the interrupted action): mobile number →
request OTP → enter OTP → authenticated session → resume the exact
interrupted action with all hunt context intact. Dismissing the sheet
loses nothing — the interrupted action and its context stay intact
underneath.
Provide validation, retry, resend when supported, failure state and resume
behavior.

The auth UI must be fully built with a clean backend seam (`lib/auth.ts`):
screens, validation, resend timer, error states. Never fake a successful
login — the verify step calls the seam and its pending state is explicit.

Preserve query, include/exclude terms, category, location, price, structured
filters and useful result context across auth. Never make the user rebuild
a hunt because authentication was requested.

---

# 13. Empty / Loading / Error

These states are first-class product states.

Empty search: «هنوز چیزی جستجو نکرده‌ای.»
No history: «هنوز جستجویی ندارید.»
No results: «با این شرایط نتیجه‌ای پیدا نشد.» with edit/remove-filter actions.
No saved searches: «هنوز جستجویی ذخیره نکرده‌ای.»
No favorites: «هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌ای.»

Loading uses structural skeletons for lists and detail pages; avoid full-screen blockers when structure can remain visible.

Every error must communicate what happened, whether user work was preserved, and the recovery action. Do not expose internal MCP/network implementation errors to ordinary users.

Offline cached content must be labeled cached/stale; never present it as live.

Validation belongs next to the relevant control, e.g. «کف قیمت نمی‌تواند از سقف قیمت بیشتر باشد».

---

# 14. Mobile Interaction Rules

Mobile is the primary interaction model. Desktop expands the same product logic.

Core tasks must be comfortable one-handed: search, refine, scroll, favorite, open, back, save.

Follow docs/designSystem.md for touch targets: approximately 44px minimum control height and approximately 40px minimum icon-only target. Do not create dense clusters of tiny actions.

Search input is the primary search control. The floating/header search pill is only a shortcut to it, never a second search implementation.

Filters use progressive disclosure: Query → Quick filters → «فیلتر دقیق‌تر» → Advanced controls. On narrow screens, advanced controls use a bottom sheet or suitable full-height modal sheet.

Include/exclude uses chips: Enter commits; comma may commit; X removes; Backspace on empty input removes the last chip; one term per chip; Persian/English/ZWNJ must not create confusing splitting.

Result card hierarchy: Image → Title → Price → Location/time → Match information → Key evidence → Actions. Card = triage; Detail = verification.

Bottom sheets are for temporary filter/sort/settings tasks. Applying/closing returns to the same search context.

While scrolling, preserve recoverable search context without using a huge fixed header. Back from detail must return to approximately the same result position.

Mobile keyboard behavior must be natural; submit from keyboard triggers search; sheets adapt to the visible viewport; fixed bottom navigation respects safe-area insets.

Validate at approximately 360–480px mobile, 768px tablet and 1280–1440px desktop. Prevent horizontal scrolling. Do not automatically introduce unnecessary desktop multi-column layouts.

Follow the existing 4/8pt spacing scale in docs/designSystem.md: 4, 8, 12, 16, 20, 24, 32, 48. No arbitrary one-off spacing values.

Motion communicates state, not decoration. Respect prefers-reduced-motion and avoid large entrance animations, bouncing UI and decorative effects.

Mobile interaction budget is a principle, not a fixed tap-count: every additional interaction must have a clear purpose, and raw query → meaningfully precise search should not require a chain of unnecessary screens.

---

# 15. External Proposal Review — hunt as a persistent asset (spec status)

Source: independent product-designer proposal, 2026-10-05 (response was
truncated at §3.1; §§4–5 never arrived). Items below are musi's adjudication:
adopted, rejected, or open pending Navid's decision.

ADOPTED into this spec:
- Persistent hunt result (`/hunt/[id]`): a paid hunt is an asset with a
  canonical, returnable URL — survives back-navigation, app kills, tab
  switches; reachable from hunt history.
- Pre-flight: free confirmation step (final chip review + explicit cost
  acknowledgment) before the paid hunt. The «شکار کن» trigger lives here.
- Auth as bottom sheet, not a route: dismissing loses nothing.
- Habit-loop framing: notification → diff → triage → act. Day-10 sessions
  start from Kamin, not setup.

REJECTED (with reason):
- Renaming `/saved` → `/kamin`: saved hunts («چیزی که دنبال می‌کنم»),
  Kamin monitoring, and favorites («آگهی‌ای که پیدا کردم») are distinct
  objects. The page keeps the «شکار من» container with Kamin as its
  primary section.

DECIDED (Navid, 2026-10-05):
- Pre-flight carries NO scan-count estimate and no numbers at all —
  final chip review + explicit cost acknowledgment only. Implemented as a
  confirm STATE of setup, never a separate screen.
- Onboarding: three quiet beats (value line → «تعریف کن، شکار کن» →
  «کمین بذار»), swipeable, skippable — the earlier one-screen idea is
  dropped (Navid, 2026-10-05).
- UX fix round (Navid-approved, 2026-10-05): single-gate setup — inline
  «شکار کن» under the live interpretation, PrecisionSheet («شکار دقیق»)
  optional and never auto-opened; ONE interpretation surface (inferred
  readings as dashed chips inline); honest per-hunt cost label next to the
  CTA (`lib/pricing.ts`, null until pricing is decided — no invented
  numbers); hunt history moves Home → «شکار من»; «شکار من» opens with the
  کمین new-matches inbox (honest local diffing).

DECIDED (Navid, 2026-10-05) — One-hunt form, subscription model:
- The product has NO search, only HUNT. Home is a hunt-DEFINITION form
  (چی؟ → مشخصات شکار → «شکار کن»), not a search box with results.
  Killed: the crosshair-icon submit, the «شکار دقیق» capsule, the
  pre-flight confirm box («با این مشخصات شکار کنم؟»), the separate
  interpretation panel, and Enter-to-fire. Inferred readings live inside
  the form's chips/rows (dashed until confirmed). ONE page, ONE button.
- Monetization is a monthly subscription for a fixed number of hunts.
  NO per-hunt price is shown anywhere — not even «هر شکار پولی است».
  `lib/pricing.ts` now models the subscription quota (null until tiers
  are decided; the UI must never invent a number).
- Design directive: سادگی, not Divar mimicry. The form must read as a
  calm hunt-definition form, not a search page.
- Header (Navid, 2026-10-05): three elements only — Telegram-style user
  avatar (→ profile), plan icon (→ «پلن و هزینه‌ها» sheet: current plan,
  this month's hunts, remaining quota, 14-day usage chart, payment
  history — real numbers from hunt history, honest empty states for
  anything undecided), notification bell (→ «شکار من» inbox, badged with
  the real unseen kamin-match count). No wordmark, no hunt CTA — the hunt
  form owns all of that. FOCUS_SEARCH_EVENT removed. This supersedes the
  step-7 header proposal (branch `fix/step7-header-meaning` is obsolete).

---

# Implementation Contract

Before implementing any page/component, the Agent must read this document, docs/designSystem.md and the relevant lower-level spec; identify conflicts; use this document as authority for product flow; preserve server/data boundaries; never invent live data/counts/scores; implement loading/empty/error/edge states; validate RTL/Persian/responsive behavior; and perform full self-QA.

PASS requires verification of product flow, interaction, hierarchy, layout, spacing, typography, RTL, Persian copy, component consistency, loading/empty/error, responsive behavior, touch targets, keyboard/focus, back/context preservation, no raw translation keys, no accidental hard-coded tokens, no client-side MCP access, and clean TypeScript/build/tests.

A task is not PASS merely because it compiles. Output must be production-ready for its implemented scope.
