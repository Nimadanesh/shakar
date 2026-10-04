# Shakar — Detailed Page & Experience Specifications V1

> This document translates the Master Product & UX Flow into implementation-ready page behavior.
>
> Read first: docs/userFlow.md and docs/designSystem.md.
>
> Design goal: the product must feel like a fast, intelligent hunting instrument. The user should feel that Shakar removes work rather than adding controls.
>
> The designer/agent must mentally perform the journey as the user: arrive with a concrete need, type quickly, refine only when necessary, scan results with low cognitive load, open only promising listings, understand why each result matched, preserve the search, and return later without starting over.

---

# 0. Experience North Star

## 0.1 The feeling

The desired feeling is:

> «من چیزی را که می‌خواستم خیلی سریع پیدا کردم و لازم نبود صدها آگهی را دستی بررسی کنم.»

Not:

> «یک اپ پر از فیلتر و قابلیت پیدا کردم.»

Shakar should feel:

- fast
- focused
- intelligent
- trustworthy
- calm
- dense but readable
- familiar enough for a Divar user
- substantially more efficient than raw marketplace search

## 0.2 Core interaction principle

Every screen must answer one immediate user question.

- Search: «چی می‌خوای؟»
- Precision: «دقیقاً چی می‌خوای و چی نمی‌خوای؟»
- Results: «کدام‌ها ارزش بررسی دارند؟»
- Detail: «این آگهی واقعاً مناسب است؟»
- My Shakar: «جستجوها و گزینه‌های قبلی من کجاست؟»
- Profile: «حساب و تنظیمات من کجاست؟»

If a section does not help answer the current question, remove it or defer it.

## 0.3 Cognitive-load rule

Do not make the user understand Shakar before getting value from Shakar.

The product should teach itself through:

- familiar search behavior
- visible chips
- concise labels
- clear feedback
- explainable matching

Avoid long tutorials for basic search.

---

# 1. Global Shell

## 1.1 Shell responsibility

The shell provides persistent navigation and access to search without competing with the search workspace.

Desktop and mobile use the same information architecture.

## 1.2 Mobile shell

Primary bottom navigation:

~~~text
[ آگهی‌ها ]   [ شکار من ]   [ پروفایل ]
~~~

Do not show «کشف بازار» in MVP primary navigation even if an older implementation/spec contains it. It is deferred.

Use the existing floating glass-pill navigation language from docs/designSystem.md.

Rules:

- fixed bottom
- safe-area aware
- approximately 16px side margins
- rounded full pill
- active state uses primary tint
- inactive state muted
- icons remain monochrome
- labels remain Persian
- never obscure scroll content

## 1.3 Header search shortcut

There is exactly one real search input.

The floating/sticky search pill is only a shortcut.

Behavior:

~~~text
Tap shortcut
  ↓
Scroll/focus main SearchInput
  ↓
Keyboard opens on mobile
~~~

Do not implement a second independent query state.

## 1.4 Desktop shell

Desktop may use the same navigation concepts with more breathing room, but must not turn the product into a dashboard.

The main content remains search-centric.

---

# 2. Main Search / Results Page

Route responsibility: /

This is the most important page in Shakar.

It is not a landing page.

It is the user's hunting workspace.

## 2.1 User job

The user wants to:

1. enter what they are looking for
2. optionally make the meaning more precise
3. scan useful candidates
4. open promising candidates
5. return without losing context

## 2.2 Page anatomy

The results viewport is composed as ONE compact sticky context bar followed by
result cards. There are no separate stacked rows for quick filters, active
constraints, and count/sort.

~~~text
┌──────────────────────────────────────┐
│ ← پیانو یاماها U3…  ۵ نتیجه  ⊙³  ⇅  │  ← single sticky context bar:
│                                      │    back · truncated query · count ·
│  (meaning row — collapsible, ONLY    │    precision/filter w/ badge · sort
│   when something was actually         │
│   inferred beyond the raw query)      │
├──────────────────────────────────────┤
│   AdCard                             │
│   AdCard                             │
│   AdCard                             │
└──────────────────────────────────────┘
~~~

Composition rules (binding):

- Category and City are NOT top-level controls. They live inside «شکار دقیق»
  under «دسته و شهر». Rationale: natural language first, precision second; the
  top of the workspace is high-value real estate.
- The «جستجوی فعال» card MUST NOT repeat the raw query — the query already
  exists in Search. Active state lives in the compact filter context; show only
  refinements that exist beyond the raw query.
- «از حرفت فهمیدم» is a single collapsible row, never a permanent block. If
  nothing was inferred beyond the raw query, do NOT render the row at all.
- Header/filter chrome must not consume more than ~30% of the first viewport
  before useful content (see designSystem.md viewport composition rule).
- When this diagram and any prose description conflict, THIS DIAGRAM wins.

Do not add:

- marketing hero
- promotional banner
- generic welcome card
- large illustration
- editorial content
- dashboard statistics

## 2.3 Above the fold

At approximately 390px wide, the user should immediately see:

- the compact sticky context bar (query + count + precision + sort)
- the first result card, or meaningful progress toward it

Do not push the first meaningful interaction below a large decorative header.
Header/filter chrome must stay under ~30% of the first viewport.

## 2.4 Search state A — first visit

Show:

- SearchInput
- optional recent searches
- minimal examples only if useful

Recommended empty copy:

> «چی شکار می‌کنی؟»

The page should feel ready, not empty or unfinished.

## 2.5 Search state B — typing

SearchInput:

- full-width
- prominent
- keyboard focused
- clear submit action while typing
- no unnecessary secondary actions inside the field

Suggestions may include:

- recent searches
- recognized category
- recognized location
- previous query patterns

Suggestions are assistance only.

Never silently replace the typed query.

## 2.6 Search state C — interpreted query

When natural-language interpretation is available, show an editable interpretation directly below the query.

Example:

~~~text
پیانو اکوستیک یاماها U3 در تهران زیر ۲۰۰ میلیون

شامل
[پیانو] [اکوستیک] [یاماها] [U3]

مکان
[تهران]

قیمت
[تا ۲۰۰ میلیون]

حذف
[دیجیتال] [طرح اکوستیک]
~~~

Important:

- explicit user input and inferred constraints must be distinguishable
- user can remove an inferred constraint
- user can add a missing constraint
- never claim that an inferred value was explicitly requested
- never silently change semantics

If AI is unavailable, the core structured search must still work.

## 2.7 Search state D — refined

The refinement area should remain compact.

Quick controls:

- category
- city
- high-value filters

Advanced:

- price
- include keywords
- exclude keywords
- supported extra filters

Do not expose every Divar filter on first interaction.

## 2.8 Include / Exclude interaction

Use the existing KeywordChips pattern.

Example:

~~~text
این کلمات در توضیحات باشد

[ یاماها × ] [ U3 × ]
[ بنویس و Enter بزن… ]

این کلمات در توضیحات نباشد

[ دیجیتال × ] [ طرح اکوستیک × ]
[ بنویس و Enter بزن… ]
~~~

The interaction should be self-explanatory.

The user must be able to add a negative term within seconds.

## 2.9 Search execution

On submit:

1. preserve query and constraints
2. show loading without destroying the current layout
3. return results
4. update count
5. preserve active constraints
6. keep the user's mental position in the workflow

Do not navigate to a visually unrelated results page.

## 2.10 Result summary

Use a compact summary.

Example:

~~~text
۱۲۴ نتیجه
مرتب‌سازی: امتیاز شکار
~~~

If result count is not available, do not invent one.

If filters are active, expose them as removable chips where useful.

## 2.11 Sorting

MVP should expose a small set of meaningful sort choices only.

Default:

> امتیاز شکار

Potential supported choices:

- جدیدترین
- قیمت: کم به زیاد
- قیمت: زیاد به کم

Only show options that the backend actually supports.

Do not create a complicated sort panel.

## 2.12 Result list

The list is optimized for scanning.

The user should be able to answer within a few seconds:

- what is it?
- how much?
- where?
- why is it relevant?
- should I open it?

## 2.13 AdCard anatomy

Order:

1. image
2. title
3. price
4. concise description evidence
5. score + relevant tags
6. location/time
7. favorite

Do not overload cards with all source fields.

## 2.14 Card evidence

The card may surface relevant terms from the description.

Example:

~~~text
یاماها U3 آکوستیک، ساخت ژاپن...
~~~

Potentially highlight only the terms that matter to the current search.

The original meaning must remain intact.

## 2.15 Match reasons

If available, show a compact maximum of 2–3 reasons.

Example:

~~~text
تطابق بالا
✓ U3
✓ یاماها
✓ تهران
~~~

Do not display a long explanation on every card.

The detail page can show the complete evidence.

## 2.16 Score

Score is a decision aid, not a decorative badge.

If displayed, it must be:

- real
- explainable
- consistently defined
- based on actual available signals

Do not use fabricated demo scores for live-looking listings.

## 2.17 Favorite interaction

Favorite is a secondary action.

It must not interfere with opening the card.

Requirements:

- 40px icon target
- accessible label
- optimistic UI only if persistence semantics support it
- auth interruption must preserve the action
- state must be visually clear

---

# 3. Search Refinement / Advanced Filters

This is a mode inside the Search Workspace, not a separate product destination.

## 3.1 Design objective

The user should feel:

> «اگر لازم شد، می‌توانم خیلی دقیق‌ترش کنم.»

Not:

> «باید یک فرم طولانی پر کنم.»

## 3.2 Progressive disclosure

Level 1:

~~~text
Query
Category
City
~~~

Level 2:

~~~text
فیلتر دقیق‌تر
Price
Include
Exclude
Has image
~~~

Level 3:

Only expose additional source-supported filters when they are useful for the current category/search.

Do not build a giant universal filter form by default.

## 3.3 Mobile presentation

Use a bottom sheet or full-height modal sheet.

The sheet:

- has a clear title
- contains grouped controls
- has an obvious close/cancel action
- has a clear apply action
- preserves current values
- does not reset on accidental dismissal

## 3.4 Apply behavior

Preferred:

~~~text
Open filters
 ↓
Change values
 ↓
Apply
 ↓
Results refresh
~~~

Cancel:

~~~text
Open filters
 ↓
Change values
 ↓
Cancel
 ↓
Original search remains unchanged
~~~

## 3.5 Price

Use two fields:

~~~text
از (تومان)     تا (تومان)
~~~

Validation:

- minimum cannot exceed maximum
- empty means unbounded
- Persian and English digits accepted
- normalize before serialization
- never silently change entered values

## 3.6 Keyword semantics

The UI must communicate the semantic difference:

~~~text
شامل = باید پیدا شود
حذف = نباید پیدا شود
~~~

Do not use ambiguous labels like «کلمات کلیدی ۱/۲».

---

# 4. Results Experience

## 4.1 The result list is a triage surface

The list should minimize unnecessary detail-page visits.

The user scans vertically.

Avoid:

- large card heights
- excessive whitespace
- repeated labels
- long AI summaries
- decorative badges

## 4.2 Information hierarchy

Highest priority:

1. relevance signal
2. title
3. price
4. key evidence
5. location/time
6. secondary metadata

## 4.3 Result density

Power-user density is intentional.

But compact does not mean cramped.

Use the existing spacing law and typography.

## 4.4 Infinite scroll

Existing spec supports infinite scroll.

Behavior:

- append results
- never jump to top
- maintain scroll position
- avoid duplicate ads
- cap/virtualize DOM if required for long sessions
- show loading sentinel state
- if pagination fallback exists, keep it functional without JS

## 4.5 Back from detail

This is critical.

Example:

~~~text
User has scrolled to result 27
 ↓
Opens result 27
 ↓
Back
 ↓
Result 27 is still approximately where expected
~~~

Do not reset to result 1.

---

# 5. Ad Detail Page

Route: /ads/[id]

## 5.1 User job

The user is no longer searching.

They are verifying one candidate.

The page should answer:

> «آیا این آگهی واقعاً همان چیزی است که دنبالش بودم؟»

## 5.2 Above-fold anatomy

~~~text
Gallery
Title
Price
Location / time
Score / match status
Why this matched
Primary actions
~~~

The user should understand relevance before reading the full description.

## 5.3 Gallery

Requirements:

- preserve source aspect ratio
- swipe on mobile
- tap to inspect larger image
- graceful missing-image state
- no decorative image manipulation

## 5.4 Core information

Show source facts clearly:

- title
- price
- location
- listing age
- seller information only where source exposes it

Do not infer seller facts.

## 5.5 Why this matched

This is one of Shakar's signature areas.

Example:

~~~text
چرا این آگهی نمایش داده شده؟

✓ شامل «یاماها»
✓ شامل «U3»
✓ شامل «اکوستیک»
✓ تهران
✓ قیمت در محدوده
~~~

The explanation must correspond to actual search state.

If the user changes filters and revisits, the explanation must reflect the new state.

## 5.6 Description evidence

Show the seller's original description.

Relevant terms can be highlighted.

Do not rewrite the seller's copy as if it were verified truth.

## 5.7 Evidence certainty

Use clear conceptual distinction:

- مستقیم: explicitly stated by source
- شناسایی‌شده: detected in text
- استنباط‌شده: model/system interpretation
- نامشخص: insufficient evidence

Only expose these labels where the underlying architecture actually provides reliable provenance.

## 5.8 Negative evidence

Example:

> «عبارت «دیجیتال» در توضیحات دیده شد.»

This means the phrase was detected.

It does not automatically mean the item itself is digital unless the evidence supports that conclusion.

## 5.9 Actions

Primary:

- علاقه‌مندی
- باز کردن آگهی اصلی

Secondary:

- اشتراک‌گذاری
- تماس, only if source legitimately exposes it

Do not create fake contact functionality.

## 5.10 Sticky actions

On mobile, if sticky actions are used, they must:

- respect safe areas
- not cover description content
- remain compact
- not duplicate too many actions

---

# 6. My Shakar

Route: /saved

## 6.1 User job

This is the user's memory.

They come here to continue hunting, not to browse generic activity.

## 6.2 Primary structure

~~~text
شکار من

جستجوهای ذخیره‌شده
[SavedSearchCard]
[SavedSearchCard]

علاقه‌مندی‌ها
[AdCard]
[AdCard]
~~~

New Matches/activity can appear only when real data exists.

## 6.3 Saved Search card

Show:

- name
- compact query summary
- important constraints
- new result count when available
- last run/check when available
- monitoring state

Primary action:

> اجرای جستجو

Secondary:

- ویرایش
- حذف
- monitoring toggle when supported

## 6.4 New matches

Example:

~~~text
پیانو U3 تهران
۶ آگهی جدید
~~~

Tap opens the relevant search result context.

Not the generic home page.

## 6.5 Favorites

Use the exact same AdCard component as the search list.

Do not create a visually unrelated FavoriteCard.

## 6.6 Tabs or sections

If tabs are needed, keep them shallow.

Do not create deep navigation hierarchies.

Prefer simple sections or a two-state segmented control.

## 6.7 Empty My Shakar

For no saved searches:

> «هنوز جستجویی ذخیره نکرده‌ای.»

For no favorites:

> «هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌ای.»

Keep the page useful and quiet.

---

# 7. Saved Search Create / Edit

## 7.1 Save entry point

The user saves from the current search, not from a separate dashboard.

~~~text
Current search
 ↓
ذخیره جستجو
 ↓
Name + monitoring
 ↓
Save
~~~

## 7.2 Naming

Default suggested name should be derived from the query/constraints.

Example:

> «پیانو U3 تهران»

The user can edit it.

Never force an arbitrary naming format.

## 7.3 Monitoring

If monitoring is supported:

~~~text
پایش آگهی‌های جدید
[فعال]
~~~

If the backend does not support monitoring yet, do not render a fake functional toggle.

## 7.4 Edit

Editing should operate on a copy/current draft until explicitly saved.

~~~text
Saved Search
 ↓
Edit
 ↓
Draft changes
 ↓
Apply / Save
~~~

Cancel must preserve the original saved search.

## 7.5 Delete

Deletion requires a clear destructive action.

For a meaningful saved search, use a confirmation only when necessary; do not make every trivial action produce a modal.

---

# 8. Authentication UX

## 8.1 Principle

Authentication is an interruption, so make it short.

Do not make authentication feel like entering a different application.

## 8.2 Trigger

Guest can search.

Auth is requested when the user performs a protected persistence action.

Example:

~~~text
Favorite
 ↓
Login prompt
 ↓
OTP
 ↓
Return to same ad
 ↓
Favorite completes
~~~

## 8.3 Save Search auth

~~~text
Search configured
 ↓
ذخیره جستجو
 ↓
Auth
 ↓
Resume save
~~~

Do not return the user to an empty home screen.

## 8.4 OTP

Screen:

~~~text
شماره موبایل
[ 09... ]

[دریافت کد]
~~~

Then:

~~~text
کد تأیید
[ _ _ _ _ _ _ ]

ارسال دوباره
تغییر شماره
~~~

Copy should remain concise.

## 8.5 Errors

Examples:

- invalid number
- invalid OTP
- expired OTP
- resend unavailable
- network/provider failure

All errors are Persian and actionable.

## 8.6 Resume contract

Auth flow must preserve the exact pending intent:

- favorite this ad
- save this search
- enter profile

Do not merely preserve the route; preserve the action context.

---

# 9. Profile

Route: /profile

## 9.1 User job

Account and settings.

Do not turn Profile into another dashboard.

## 9.2 Sections

- account identity
- subscription status
- relevant settings
- sign out

Subscription pricing/payment remains structure-only until product requirements finalize it.

## 9.3 Visual priority

Profile is intentionally quieter than Search.

No large marketing panels.

---

# 10. Cross-Page Interaction Contracts

## 10.1 Search context object

All relevant pages should conceptually preserve one search context:

~~~text
query
includeKeywords[]
excludeKeywords[]
category
city
neighborhood
priceMin
priceMax
extraFilters
sort
result position/context
~~~

Do not create incompatible representations of the same search state across components.

## 10.2 Detail context

Opening a result should carry enough context to return correctly.

## 10.3 Save context

Saved Search must serialize the same search semantics used by the active search.

Avoid a situation where:

~~~text
Search UI ≠ Saved Search payload
~~~

## 10.4 Auth context

Protected actions carry a pending action through authentication.

## 10.5 Error context

Errors never erase user-entered constraints.

---

# 11. AI / Decision Engine UX Placement

## 11.1 AI's job

AI is a compression layer between human intent and structured search.

It should help the user express intent faster.

## 11.2 Preferred flow

~~~text
Natural language
 ↓
Structured interpretation
 ↓
User-visible editable constraints
 ↓
Search
 ↓
Evidence-backed results
~~~

## 11.3 Forbidden UX pattern

Do not create a dominant «از شکار هر چیزی بپرس» chat experience for the core search flow.

The user came to hunt listings.

## 11.4 Ambiguity

If interpretation is ambiguous:

Example:

> «آیفون ۱۵ خوب»

Do not pretend to know what «خوب» means.

Ask for or expose a useful refinement such as:

- model
- storage
- price
- condition
- location

Use structured controls where possible.

## 11.5 AI failure

If AI is unavailable:

- normal search still works
- structured filters remain available
- no broken chatbot surface
- no fake AI result

AI must be additive, not a single point of failure.

---

# 12. Responsive Behavior

## 12.1 360–390px

Primary target for dense mobile UX.

Rules:

- single column
- compact cards
- advanced filters in sheet
- no horizontal overflow
- chips may scroll horizontally inside their own bounded region only when necessary
- long titles clamp
- no desktop-style sidebars

## 12.2 390–480px

Default mobile experience.

Search, cards and bottom navigation should feel balanced.

Do not simply scale desktop down.

## 12.3 768px

Tablet:

- same product hierarchy
- wider content
- slightly more metadata where useful
- no forced complex grid

## 12.4 1280–1440px

Desktop:

- centered content
- comfortable reading width
- more breathing room
- preserve compact professional density
- do not add unnecessary dashboard columns

---

# 13. Accessibility & Interaction Quality

## 13.1 Keyboard

All actions must be reachable.

Search:

- focusable
- Enter submits
- Escape closes temporary UI where appropriate

Chips:

- Enter commits
- remove buttons keyboard reachable
- Backspace behavior preserved

## 13.2 Focus

Visible focus ring using design-system ring token.

Do not remove focus outlines without an equivalent.

## 13.3 Screen readers

Use meaningful labels for icon-only actions.

Examples:

- «افزودن به علاقه‌مندی‌ها»
- «حذف از علاقه‌مندی‌ها»
- «اشتراک‌گذاری»
- «باز کردن آگهی اصلی»

## 13.4 Live regions

Use aria-live only for meaningful dynamic changes:

- result count changes
- chip additions/removals
- major search status

Do not make the entire result list an aggressive live region.

---

# 14. Motion & Feedback

Motion should make the interface feel responsive, not playful.

Use 150–250ms transitions.

Good:

- filter disclosure
- sheet entrance
- favorite state
- subtle result loading
- focus transitions

Avoid:

- bouncing cards
- large page transitions
- animated score theatrics
- decorative particle effects

Respect reduced motion.

---

# 15. Copy & Tone

Voice:

- Persian
- direct
- professional
- concise
- human
- time-saving

Avoid:

- marketing clichés
- exaggerated AI language
- «هوش مصنوعی قدرتمند ما...»
- unexplained English labels
- technical errors

Preferred:

> «چرا این آگهی نمایش داده شده؟»

Not:

> «AI Match Intelligence»

Preferred:

> «۶ آگهی جدید»

Not:

> «۶ فرصت جدید کشف شد!»

The product is a tool, not a campaign.

---

# 16. Data Truthfulness Rules

The UI must reflect actual data availability.

Never invent:

- result counts
- scores
- prices
- listing age
- seller information
- match reasons
- new-match counts
- monitoring state
- contact information

If unavailable:

- omit when appropriate, or
- show an explicit unknown state

Do not create fake live listings for production-looking UI.

---

# 17. Component Reuse Rules

Prefer shared components:

- SearchInput
- SearchFilters
- KeywordChips
- SearchSummary
- AdCard
- ShekarScoreBadge
- MatchReasons
- DescriptionEvidence
- SavedSearchCard
- BottomTabBar
- FloatingSearchShortcut
- EmptyState
- ErrorState
- Skeleton

A component should be shared when the underlying interaction is the same.

Do not fork visually equivalent cards merely because the page is different.

---

# 18. Design Review Checklist Per Page

Before calling a page complete, review it as a user rather than as a developer.

Ask:

### First impression
- Do I immediately know what I can do?
- Is the primary action obvious?
- Is anything stealing attention from it?

### Efficiency
- Can I refine the search without unnecessary navigation?
- Can I scan multiple ads quickly?
- Can I identify obvious false matches before opening them?

### Trust
- Do I understand why an ad matched?
- Can I distinguish detected text from inference?
- Is anything presented with more certainty than the data supports?

### Continuity
- If I open an ad and go back, am I where I was?
- If login interrupts me, does my action resume?
- If a search fails, is my search preserved?

### Mobile
- Can I use the core flow one-handed?
- Are touch targets comfortable?
- Does the keyboard obscure anything?
- Is there horizontal overflow?
- Does the bottom bar cover content?

### Visual quality
- Is hierarchy obvious?
- Is spacing consistent with the design system?
- Is the page too dense or too empty?
- Are cards consistent?
- Are there unnecessary boxes?
- Does motion help?

---

# 19. Agent Implementation Contract

For every implementation task derived from this document:

1. Read docs/userFlow.md.
2. Read docs/designSystem.md.
3. Read the relevant existing component/page spec.
4. Read the current implementation before modifying it.
5. Identify and resolve specification conflicts before coding.
6. Do not invent backend capabilities.
7. Do not move MCP/data access into client components.
8. Keep pages as thin composition layers where architecture requires it.
9. Reuse existing components before creating new variants.
10. Preserve existing data models unless a documented product decision changes them.
11. Implement normal, loading, empty, error and relevant edge states.
12. Use Persian UI copy and RTL.
13. Follow the 4/8pt spacing law.
14. Follow semantic design tokens; no one-off hex values.
15. Validate mobile first.
16. Validate keyboard/focus and accessibility.
17. Validate back-navigation/context preservation.
18. Validate no raw translation keys.
19. Validate no mock data presented as live.
20. Run TypeScript/build/tests required by the repository.
21. Perform a visual self-QA at approximately 390×844 and desktop before PASS.
22. Fix discovered UI issues before reporting PASS.

A compile-success is not a UX PASS.

---

# 20. Definition of Done

A page is complete only when:

- its user job is clear
- its primary interaction is obvious
- it fits the global Shakar mental model
- it does not duplicate another page's responsibility
- it preserves search context
- it has complete relevant states
- it works RTL/Persian
- it respects mobile interaction rules
- it follows design tokens and spacing
- it reuses shared components
- it does not invent unavailable data
- it passes automated checks
- it has been visually reviewed at mobile and desktop sizes
- obvious UX friction has been fixed before handoff

The final standard is not «the page works».

The final standard is:

> «اگر من یک کاربر حرفه‌ای دیوار بودم که این جستجو را مرتب انجام می‌دهم، آیا این رابط واقعاً کارم را سریع‌تر، واضح‌تر و کم‌خستگی‌تر می‌کند؟»

If the answer is no, keep refining.
