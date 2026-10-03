# Shakar — Master Product & UX Flow V1

> Product/UX source of truth for MVP. Persian-first, RTL, mobile-first, dark theme.
>
> Core principle: Shakar reduces the amount of listing inspection a professional user must perform. It is a Professional Search Workspace, not a marketplace clone.

---

# 1. Product Mental Model

Shakar is a tool for professional hunting. The user arrives with a concrete need and wants to reach relevant, trustworthy candidates with minimum inspection.

Core loop:

~~~text
NEED → SEARCH → PRECISION → TRIAGE → VERIFY → ACT → MONITOR
~~~

Search asks «چی می‌خوام؟». Precision asks «دقیقاً چی می‌خوام و چی نمی‌خوام؟». Triage asks «کدام نتیجه ارزش باز کردن دارد؟». Verify asks «واقعاً مناسب است؟». Act handles favorite/share/open-original. Monitor lets the user repeat the hunt without rebuilding it.

The central differentiation is content-aware search: include terms and exclude terms can operate on listing title/description. Example: query «پیانو اکوستیک یاماها U3», include [پیانو][اکوستیک][یاماها][U3], exclude [طرح اکوستیک][دیجیتال].

AI must simplify search, not replace it with a chatbot. Preferred model: natural language → structured, editable search → results.

Product principles: simple by default; powerful when needed; search-first; explain scores and matches; never silently relax user intent; preserve context; distinguish direct/detected/inferred/unknown information; progressive disclosure; one coherent workspace.

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
Open → Search → Initial Results → Refine → Triage → Detail/Verify → Act → Save Search → Monitor
~~~

Example intent: «پیانو اکوستیک یاماها U3 در تهران، زیر ۲۰۰ میلیون؛ دیجیتال و طرح اکوستیک نمی‌خوام.»

The user can enter the natural query, review/edit interpreted constraints, receive results, inspect promising candidates, favorite one, and save the complete search for future monitoring.

The stages are one continuous workflow. Do not create unnecessary full-page navigation between Search, Precision and Results.

---

# 4. Information Architecture

~~~text
Shakar
├── آگهی‌ها
│   ├── Search Workspace
│   ├── Search Results
│   └── Search Refinement
├── آگهی Detail
├── شکار من
│   ├── Saved Searches
│   ├── Favorites
│   └── New Matches / Activity
└── پروفایل
    ├── Account
    ├── Subscription status
    └── Settings
~~~

Search Workspace owns query, interpretation, include/exclude terms, category, location, price, supported structured filters, sorting and result context. Detail owns listing evidence and actions. My Shakar owns persistent hunts and saved candidates. Profile owns account/settings.

Saved Search means «چیزی که دنبال می‌کنم». Favorite means «آگهی‌ای که پیدا کرده‌ام و می‌خواهم نگه دارم».

---

# 5. Navigation

MVP primary navigation:

~~~text
آگهی‌ها | شکار من | پروفایل
~~~

آگهی‌ها is the default search workspace. شکار من contains saved searches, favorites and new matches when available. پروفایل contains account/settings.

The existing «کشف بازار» concept is deferred/future unless explicitly reintroduced.

Opening Shakar should lead directly toward search; do not prioritize marketing heroes, promotional banners or editorial content.

Back navigation must preserve query, include/exclude terms, filters, sort and useful result position. Notifications and saved-search actions must deep-link into their relevant context.

---

# 6. Page Map

Current route responsibilities:

~~~text
/          → Main Search / Results
/ads/[id]  → Ad Detail
/saved     → My Shakar / Saved Searches / Favorites
/profile   → Profile
~~~

Route naming is implementation detail; responsibilities are authoritative.

| Page | Primary job | Must not become |
|---|---|---|
| / | Search + results workflow | Marketing home |
| /ads/[id] | Verify one candidate | Search dashboard |
| /saved | Resume hunts and candidates | Generic activity feed |
| /profile | Account/settings | Search workspace |

---

# 7. Page → Goal → Sections → Components → Interaction

Every future page spec must explicitly define Goal, Sections, Components and Interaction.

## Search Workspace
Goal: capture and refine intent without unnecessary navigation.
Sections: query; recognized/active constraints; quick filters; advanced precision; search action; result context.
Components: SearchInput, SearchSuggestions, KeywordChips, IncludeKeywords, ExcludeKeywords, CategorySelect, CitySelect, PriceRange, AdvancedFilters, SearchSummary, SaveSearchButton.
Interaction: type → submit → results → adjust constraints → updated results.

## Results
Goal: rapid triage.
Sections: search summary, active constraints, count, sort, result list, states.
Components: SearchSummary, ActiveFilterChips, ResultCount, SortControl, AdList, AdCard, ShekarScoreBadge, MatchReasons, FavoriteButton.
Card must answer «این آگهی ارزش باز کردن دارد؟» whenever available evidence supports it.

## Ad Detail
Goal: verification.
Sections: gallery, core information, match explanation, relevant description evidence, remaining listing information, actions.
Components: ImageGallery, AdHeader, Price, LocationMeta, ListingAge, ShekarScoreBadge, MatchReasons, DescriptionEvidence, FavoriteButton, ShareButton, OpenOriginalButton.

## My Shakar
Goal: resume hunts and revisit candidates.
Sections: Saved Searches, Favorites, New Matches/activity when available.

## Profile
Goal: account and settings only.

---

# 8. Search States

1. Initial: prominent query field; optional recent searches; advanced filters hidden.
2. Typing: suggestions may appear, but never silently replace input.
3. Interpreting: show editable interpretation of query and constraints.
4. Refined: user can add/remove include/exclude terms and structured filters without leaving the workspace.
5. Loading: preserve all search state; use structural skeletons; prevent duplicate submit.
6. Results: show actual count, active constraints, sort and cards.
7. No results: «با این شرایط نتیجه‌ای پیدا نشد.» with explicit «ویرایش جستجو» and «حذف آخرین فیلتر». Never silently relax constraints.
8. Error: «دریافت نتایج با مشکل مواجه شد. جستجوی شما حفظ شده است.» with retry.

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

# 12. Auth Interruption / Resume

Guests can experience core search and inspect listings. Authentication is required for persistent actions such as Save Search, Favorite and Profile where applicable.

Required pattern:

~~~text
Search → Refine → Results → Protected action → Auth → Resume interrupted action
~~~

Preserve query, include/exclude terms, category, location, price, structured filters and useful result context across auth.

OTP flow: mobile number → request OTP → enter OTP → authenticated session → resume. Provide validation, retry, resend when supported, failure state and resume behavior.

Never make the user rebuild a complex search because authentication was requested.

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

# Implementation Contract

Before implementing any page/component, the Agent must read this document, docs/designSystem.md and the relevant lower-level spec; identify conflicts; use this document as authority for product flow; preserve server/data boundaries; never invent live data/counts/scores; implement loading/empty/error/edge states; validate RTL/Persian/responsive behavior; and perform full self-QA.

PASS requires verification of product flow, interaction, hierarchy, layout, spacing, typography, RTL, Persian copy, component consistency, loading/empty/error, responsive behavior, touch targets, keyboard/focus, back/context preservation, no raw translation keys, no accidental hard-coded tokens, no client-side MCP access, and clean TypeScript/build/tests.

A task is not PASS merely because it compiles. Output must be production-ready for its implemented scope.
