
# Shakar — Search Workspace Experience Specification V1

> **Status:** Product/UX source of truth for the core Search Workspace.
>
> **Read before implementation:** PWA_app/docs/userFlow.md, PWA_app/docs/PAGE-EXPERIENCE-SPECS-V1.md, and docs/designSystem.md.
>
> **Scope:** Search Workspace on /. This document defines the experience of query entry, interpretation, precision, execution, results triage, and continuity.
>
> **North star:** Shakar must remove listing-inspection work, not add interface work.

---

# 0. Product Definition

Search Workspace is the heart of Shakar.

It is not:

- a marketing landing page;
- a giant filter form;
- a chatbot;
- a dashboard;
- a prettier copy of Divar search.

It is a professional hunting instrument.

The user arrives with a concrete need and should move through:

~~~text
NEED
 ↓
SEARCH
 ↓
PRECISION
 ↓
TRIAGE
 ↓
VERIFY
 ↓
SAVE / MONITOR / RADAR
~~~

Search Workspace owns SEARCH → PRECISION → TRIAGE.

The detail page owns VERIFY.

My Shakar owns SAVE / MONITOR.

Radar is an active monitoring layer over a canonical search. It is created from Search Workspace and managed from My Shakar; it is not a separate search destination.

The user should experience these as one continuous hunt.

## 0.1 Desired feeling

The target feeling is:

> «من چیزی را که می‌خواستم خیلی سریع پیدا کردم و لازم نبود صدها آگهی را دستی بررسی کنم.»

Not:

> «یک اپ پر از فیلتر و قابلیت پیدا کردم.»

## 0.2 Product test

Before adding any control, ask:

> Does this reduce unnecessary listing inspection, improve search precision, improve result scanning, or preserve continuity?

If not, it should not be prominent and may not belong in MVP.

---

# 1. Professional User Mental Model

The primary user is a Professional Hunter. "Professional" describes search behavior, not occupation.

Typical characteristics:

- searches frequently;
- knows category vocabulary;
- has specific requirements;
- encounters marketplace noise repeatedly;
- dislikes opening irrelevant listings;
- compares candidates;
- repeats similar searches;
- values speed, precision, control, and evidence.

The interface should mirror the user's internal questions:

| Stage | User question |
|---|---|
| Initial | «چی می‌خوام؟» |
| Interpretation | «منظورم را درست فهمید؟» |
| Precision | «دقیقاً چی می‌خوام و چی نمی‌خوام؟» |
| Results | «کدام‌ها ارزش بررسی دارند؟» |
| Detail | «این آگهی واقعاً مناسب است؟» |
| Saved | «چطور این شکار را دوباره ادامه بدهم؟» |

Do not turn these stages into separate pages.

---

# 2. One Continuous Search Workspace

Search, Precision, and Results are states of one workspace.

Preferred mental model:

~~~text
/
 ├── Query
 ├── Meaning
 ├── Precision
 └── Results
~~~

Avoid:

~~~text
Search page
 ↓
AI page
 ↓
Filter page
 ↓
Results page
~~~

Every refinement should feel like modifying the current hunt.

The user should never wonder:

> «جستجوی قبلی من کجا رفت؟»

## 2.1 Canonical Search Context

Conceptually, the workspace owns one search context:

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
radar state/context (when active)
~~~

The actual repository type is authoritative for implementation. This conceptual contract must not be duplicated into incompatible state models.

The same semantic search must be understood consistently by:

- SearchInput;
- interpretation;
- include/exclude;
- filters;
- result chips;
- result explanation;
- saved search;
- auth resume;
- detail back-navigation;
- Radar activation and monitoring.

---

# 3. Workspace Anatomy

The visual hierarchy is shallow and progressive.

~~~text
Search Workspace
│
├── Query
│   ├── SearchInput
│   └── Suggestions / recent searches
│
├── Meaning
│   ├── interpreted constraints
│   ├── include terms
│   └── exclude terms
│
├── Quick Precision
│   ├── Category
│   ├── City
│   └── فیلتر دقیق‌تر
│
├── Active Search Summary
│   ├── active constraints
│   └── removable chips
│
└── Results
    ├── result count
    ├── sort
    ├── AdCard list
    └── loading / empty / error / end states
~~~

Not every block is visible simultaneously.

The product must progressively reveal complexity.

---

# 4. First Visit / Empty State

## 4.1 Goal

The user should understand the next action immediately:

> «چیزی که دنبالشم را بنویسم.»

No tutorial should be required.

## 4.2 Above fold at ~390×844

Priority:

1. SearchInput;
2. optional recent searches;
3. optional one or two concise examples;
4. nothing that competes with search.

Do not add:

- large hero artwork;
- marketing slogan;
- dashboard statistics;
- promotional cards;
- editorial content;
- giant welcome panel.

## 4.3 Primary copy

Placeholder:

> «چی شکار می‌کنی؟»

This is the product's human entry point.

Avoid:

> «از هوش مصنوعی ما هر چیزی بپرسید»

because Shakar is a search tool, not a general assistant.

---

# 5. SearchInput

## 5.1 Single source of truth

There is exactly one real query input.

A floating/header search pill is only a shortcut that focuses or reveals the main SearchInput.

It must not maintain a second query state.

## 5.2 Input requirements

SearchInput must:

- be visually primary;
- support Persian RTL;
- accept Persian and English digits;
- preserve user text;
- support Enter/keyboard submit;
- expose clear behavior where appropriate;
- never silently replace the user's text.

## 5.3 Mobile behavior

When focused:

- keyboard opens naturally;
- input remains usable;
- submit remains reachable;
- suggestions do not cover the input;
- fixed navigation does not cover important controls;
- visible viewport/keyboard insets are respected.

## 5.4 Empty submission

An empty query must not trigger a meaningless search.

Do not show an aggressive red error for the normal initial empty state.

Keep focus available and let the user continue.

## 5.5 Clear

Clear should clear the raw query.

It must not silently delete unrelated explicit filters unless that relationship is explicitly defined by the product contract.

---

# 6. Query Interpretation

Natural-language interpretation is a compression layer:

~~~text
human intent
 ↓
structured search meaning
~~~

It is not a chat conversation.

## 6.1 Canonical example

User:

> «پیانو اکوستیک یاماها میخوام، ترجیحاً U3، تهران باشه، زیر ۲۰۰ میلیون، طرح اکوستیک و دیجیتال نمیخوام.»

Potential interpretation:

~~~text
شامل
[پیانو]
[اکوستیک]
[یاماها]
[U3]

مکان
[تهران]

قیمت
[تا ۲۰۰ میلیون تومان]

حذف
[طرح اکوستیک]
[دیجیتال]
~~~

The exact semantics depend on actual backend capabilities.

## 6.2 Explicit vs inferred

The UI must distinguish:

### Explicit

The user clearly said it.

Example:

> «تهران باشه»

### Inferred

The system inferred it from wording.

Example:

> «ترجیحاً U3»

If the data model cannot represent preference, do not silently turn "preferred" into "required".

## 6.3 No silent semantic changes

Never silently transform:

> «ترجیحاً U3»

into:

> «فقط U3»

Never silently transform a preference into a hard exclusion, a hard inclusion, or a different numeric boundary.

If the system cannot preserve the nuance, it should expose the interpretation as editable rather than pretending certainty.

## 6.4 Interpretation visibility

The user must be able to see important interpreted constraints.

The UI should communicate:

> «این چیزهایی است که از حرفت فهمیدم.»

not:

> «مدل تصمیم گرفت.»

## 6.5 Editing

Meaningful interpreted constraints must have an obvious remove/edit path.

Example:

~~~text
شامل
[یاماها ×] [U3 ×]

مکان
[تهران ×]

حذف
[دیجیتال ×] [طرح اکوستیک ×]
~~~

The user must not rewrite the entire query merely to remove one interpreted constraint.

---

# 7. Ambiguity

## 7.1 Principle

Do not invent precision from vague language.

Example:

> «آیفون ۱۵ خوب»

"خوب" is not automatically:

- a price;
- a condition;
- a storage value;
- a battery-health threshold;
- a seller rating.

## 7.2 Clarification

If clarification is genuinely needed, expose the smallest useful choice.

Example:

~~~text
برای «خوب» کدام مورد مهم‌تر است؟

[قیمت]
[حافظه]
[وضعیت دستگاه]
[سلامت باتری]
~~~

Only use options supported by the actual product/data model.

Do not turn every ambiguous search into a long questionnaire.

## 7.3 Low-confidence interpretation

When the system cannot reliably interpret something:

- preserve raw query;
- show only reliable constraints;
- expose uncertainty where useful;
- allow normal keyword search;
- never invent a hidden filter.

---

# 8. Quick Precision

Top-level controls:

~~~text
[دسته‌بندی] [شهر] [فیلتر دقیق‌تر]
~~~

## 8.1 Category

Category control must:

- use real supported categories;
- preserve query and other constraints;
- show current selection;
- allow clearing;
- not fabricate category levels.

If taxonomy is large, search/select behavior should be optimized for quick professional use.

## 8.2 City

City control must:

- preserve the rest of the search;
- use the real location model;
- show the current selection;
- allow clearing.

Do not imply neighborhood precision if neighborhood filtering is not actually supported.

## 8.3 Why only a few controls?

The top of the workspace is high-value real estate.

Every visible control competes with search and result scanning.

Only high-frequency, high-value precision belongs in the primary row.

---

# 9. Advanced Filters

Advanced filters are a mode inside the Search Workspace, not a separate destination.

The user should feel:

> «اگر لازم شد، می‌توانم خیلی دقیق‌ترش کنم.»

not:

> «برای استفاده باید فرم پر کنم.»

## 9.1 Progressive disclosure

### Level 1

- Query
- Category
- City

### Level 2

- Price
- Include keywords
- Exclude keywords
- Has image, only if actually supported

### Level 3

Category-specific filters that are genuinely supported by the backend/source.

Never build a universal 20–40 field filter form by default.

## 9.2 Mobile presentation

Use:

- bottom sheet, or
- suitable full-height modal sheet.

Sheet requirements:

- clear title;
- grouped controls;
- current values;
- obvious Cancel/close;
- obvious Apply;
- draft state;
- safe-area support.

## 9.3 Draft vs active

While the sheet is open:

~~~text
activeSearchState ≠ filterDraft
~~~

until Apply.

Accidental close must not commit draft values.

## 9.4 Apply

~~~text
Open
 ↓
Change
 ↓
Apply
 ↓
Refresh results
~~~

All other active constraints remain intact.

## 9.5 Cancel

~~~text
Open
 ↓
Change
 ↓
Cancel
 ↓
Original search remains
~~~

---

# 10. Include / Exclude — Core Shakar Differentiator

This feature is central to the product thesis.

## 10.1 Semantics

The UI must make this instantly understandable:

> **شامل** = باید پیدا شود

> **حذف** = نباید پیدا شود

## 10.2 Preferred UI

~~~text
این کلمات در توضیحات باشد

[یاماها ×] [U3 ×]
[بنویس و Enter بزن…]


این کلمات در توضیحات نباشد

[دیجیتال ×] [طرح اکوستیک ×]
[بنویس و Enter بزن…]
~~~

## 10.3 Add term interaction

Expected:

1. focus;
2. type;
3. Enter;
4. chip created;
5. input cleared;
6. immediately ready for next term.

Comma-to-commit may be supported only if it does not conflict with Persian typing/input behavior.

## 10.4 Remove

Every chip has a clear remove action.

Keyboard:

- remove button is focusable;
- Backspace on empty input may remove last chip;
- removal is immediate and visible.

## 10.5 Normalization

The backend may normalize Persian/Arabic character variants, whitespace, or ZWNJ according to a documented search-normalization contract.

The UI must not unexpectedly rewrite visible terms in a way that changes meaning.

## 10.6 Backend truth

If the UI says:

> «این کلمات در توضیحات باشد»

the search must actually inspect the description field.

Do not label a title-only match as a description match.

## 10.7 Exact phrase

If exact phrase matching exists, represent it explicitly.

If it does not exist, do not imply exact matching.

Do not promise semantics the backend cannot enforce.

---

# 11. Price

UI:

~~~text
از (تومان)       تا (تومان)
~~~

## 11.1 Input

Accept:

- Persian digits;
- English digits;
- safe common grouping separators.

Normalize before serialization.

## 11.2 Validation

Rules:

- minimum cannot exceed maximum;
- empty minimum = unbounded;
- empty maximum = unbounded;
- do not silently swap;
- do not silently clamp.

Error belongs next to the relevant field:

> «کف قیمت نمی‌تواند از سقف قیمت بیشتر باشد.»

## 11.3 Display vs model

Localized display formatting must remain separate from the normalized numeric search value.

Do not pass formatted Persian strings as the numeric search contract.

---

# 12. Active Search Summary

Once a search has meaningfully been refined, the active meaning should remain visible without taking over the screen.

Example:

~~~text
پیانو اکوستیک یاماها U3

[تهران ×] [تا ۲۰۰ میلیون ×]
[حذف: دیجیتال ×]
[حذف: طرح اکوستیک ×]
~~~

## 12.1 Rules

- show meaningful active constraints;
- allow removal;
- do not repeat the same fact in several visual forms;
- collapse lower-priority constraints if the list becomes long;
- preserve the raw query.

## 12.2 Clear semantics

If a control says:

> «پاک کردن فیلترها»

it should remove structured refinements without necessarily erasing the raw query.

If a future control means "start a new search", it must be clearly different.

Do not make routine refinement feel destructive.

---

# 13. Search Execution

On submit:

1. capture raw query;
2. resolve active structured constraints;
3. validate;
4. serialize canonical search context;
5. execute only supported search capabilities;
6. preserve context during loading;
7. render actual results;
8. expose actual count if available.

## 13.1 Loading

Keep:

- SearchInput;
- active constraints;
- overall page geometry.

Use structural skeletons where appropriate.

Do not:

- clear the page;
- show a generic blocking spinner unnecessarily;
- cause the viewport to jump;
- enable duplicate submits.

## 13.2 Re-search after refinement

When a search changes:

- update result set;
- update count if available;
- preserve active constraints;
- reset result position only when appropriate because the result set genuinely changed.

Do not create a visually unrelated "new results page".

---

# 14. Result Summary

Compact pattern:

~~~text
۱۲۴ نتیجه
مرتب‌سازی: امتیاز شکار
~~~

If count is unavailable, omit it.

Never invent:

> «۱٬۲۴۳ نتیجه»

just to make the design look complete.

---

# 15. Sorting

Default may be:

> «امتیاز شکار»

only when a real, defined score and sort contract exists.

Potential options:

- جدیدترین;
- قیمت: کم به زیاد;
- قیمت: زیاد به کم.

Only show options supported by the backend.

## 15.1 Interaction

On mobile, sorting may use a compact sheet/menu.

Changing sort:

- preserves all filters;
- preserves query;
- changes only ordering;
- visibly indicates current selection.

Do not build an elaborate sort dashboard.

---

# 16. Results as a Triage Surface

The result list has one job:

> «کدام آگهی ارزش باز کردن دارد؟»

It does not need to answer every question about a listing.

## 16.1 Scan order

~~~text
Image
 ↓
Title
 ↓
Price
 ↓
Key evidence
 ↓
Location / time
 ↓
Match signal
 ↓
Secondary actions
~~~

## 16.2 Density

Power-user density is intentional.

Compact does not mean cramped.

Avoid:

- oversized cards;
- giant images;
- excessive whitespace;
- long AI summaries;
- repeated labels;
- decorative badges;
- nested cards inside cards.

## 16.3 Long sessions

Professional users may scan many results.

The list must remain stable:

- append without jumping;
- avoid duplicate ads;
- preserve scroll;
- use loading sentinel;
- use pagination if that is the real backend contract;
- use virtualization/capping when necessary for long sessions.

---

# 17. AdCard Search Contract

AdCard is a triage instrument.

## 17.1 Required hierarchy

1. image;
2. title;
3. price;
4. concise description evidence;
5. match signal/score when available;
6. location/time;
7. favorite.

Unavailable fields should be omitted rather than filled with invented values.

## 17.2 Title

Preserve the source title.

Highlighting may be applied, but text must not be rewritten.

## 17.3 Price

Show actual source price.

Do not infer:

- negotiability;
- hidden fees;
- financing;
- market value.

## 17.4 Evidence

The card may show a short source excerpt.

Relevant terms can be highlighted.

The excerpt must remain faithful to the seller's original text.

Never generate a synthetic sentence and present it as seller text.

## 17.5 Match reasons

Maximum 2–3 concise reasons.

Example:

~~~text
تطابق بالا
✓ U3
✓ یاماها
✓ تهران
~~~

Every reason must correspond to actual search state and actual evidence.

## 17.6 Score

If Shakar Score exists in the backend:

- it must be real;
- consistently defined;
- based on actual signals;
- meaningful for the current search.

If score is unavailable, omit it.

Never use decorative fake values.

## 17.7 Uncertainty

When supported by real evidence:

~~~text
✓ یاماها
✓ U3
✓ تهران
؟ وضعیت آکوستیک مشخص نیست
~~~

Do not convert missing evidence into negative evidence.

## 17.8 Favorite

Favorite is secondary.

Requirements:

- comfortable target;
- clear state;
- accessible label;
- no accidental card navigation;
- auth interruption preserves pending action.

---

# 18. False-Match Prevention

This is a central reason for Shakar.

Canonical problem:

Search:

> «پیانو اکوستیک»

Listing:

> «پیانو طرح اکوستیک»

A raw marketplace search may surface it because of shared words.

Shakar lets the user express:

~~~text
شامل:
اکوستیک

حذف:
طرح اکوستیک
دیجیتال
~~~

## 18.1 Critical trust rule

Text detection is not object classification.

Example:

> «این مدل دیجیتال نیست.»

contains the word «دیجیتال», but the sentence may explicitly deny that the item is digital.

Therefore:

- keyword detection = evidence of phrase presence;
- classification = stronger claim;
- classification requires appropriate evidence;
- exclusion behavior must follow the documented matching semantics.

Never claim:

> «این آگهی دیجیتال است»

merely because the word appeared.

---

# 19. Evidence Model

Where architecture provides provenance, conceptual evidence categories are:

### مستقیم
Explicitly stated by source.

### شناسایی‌شده
Detected in source text.

### استنباط‌شده
System/model interpretation.

### نامشخص
Insufficient evidence.

Search cards should remain concise.

Detailed provenance can be exposed on the ad detail page.

The workspace must never communicate more certainty than the evidence supports.

---

# 20. Suggestions & Recent Searches

Suggestions exist to reduce typing effort.

They must never hijack intent.

Possible real sources:

- recent searches;
- recognized categories;
- recognized locations;
- supported query patterns.

Rules:

- never silently replace input;
- never submit unexpectedly;
- remain secondary;
- disappear when no longer useful;
- be keyboard accessible.

Do not fabricate recent searches for visual density.

---

# 21. No Results

Primary message:

> «با این شرایط نتیجه‌ای پیدا نشد.»

Useful deterministic recovery actions:

- «ویرایش جستجو»;
- remove a recent filter;
- edit include/exclude terms.

Only offer actions that actually exist.

## 21.1 Never silently relax

Do not automatically remove:

- price;
- city;
- category;
- include term;
- exclude term;
- other explicit constraints.

If the backend can reliably identify a restrictive condition, it may be explained.

If it cannot, do not invent the reason.

---

# 22. Partial / Uncertain Matches

A result can contain some evidence while another requirement remains unknown.

Example:

~~~text
✓ یاماها
✓ U3
✓ تهران
؟ وضعیت آکوستیک مشخص نیست
~~~

Do not display a generic strong-match state if a major requirement is unresolved.

Only use this pattern where the backend actually exposes the underlying signals.

---

# 23. Error & Recovery

Search error:

> «دریافت نتایج با مشکل مواجه شد. جستجوی شما حفظ شده است.»

Action:

> «تلاش دوباره»

Retry must reuse the exact current search context.

Errors must not expose internal implementation details such as MCP/provider/network stack terminology.

## 23.1 Validation

Validation appears next to the relevant control.

Example:

> «کف قیمت نمی‌تواند از سقف قیمت بیشتر باشد.»

## 23.2 Unsupported features

If backend support does not exist, do not render a fake working control.

Planned capabilities belong in documentation, not fake production UI.

---

# 24. Detail Continuity

When a user opens an ad:

~~~text
Search
 ↓
scroll to result 27
 ↓
open result
 ↓
Back
 ↓
result 27 remains approximately where expected
~~~

Preserve:

- query;
- include/exclude;
- category;
- location;
- price;
- extra filters;
- sort;
- useful result position/context.

Back must not reset to result 1 unless the actual navigation architecture makes that impossible and an explicit alternative is provided.

---

# 25. Save Search

Save Search is part of the hunting workflow.

It must not dominate the workspace.

## 25.1 Placement

Discoverable after a meaningful search exists.

Secondary to search and triage.

## 25.2 Semantics

Saved Search preserves the canonical search context:

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
~~~

Rerunning the saved search must mean the same thing as the active search.

## 25.3 Authentication

If save requires auth:

~~~text
ذخیره جستجو
 ↓
Auth
 ↓
Resume save
~~~

The user must not return to an empty home state.

---


---

# 26. Radar — Active Hunt Layer

Radar extends the current hunt from **what exists now** to **what appears next**.

Core mental model:

~~~text
Search = الان چی پیدا شده؟
Radar = از این به بعد چی پیدا بشه؟
~~~

Radar is not a separate page, a second search system, or a chatbot.

It is a persistent monitoring layer on top of the same canonical Search Context used by Search Workspace.

## 26.1 Canonical use case

Example:

~~~text
1. User searches:
   «پیانو اکوستیک یاماها U3 تهران زیر ۲۰۰ میلیون»

2. Search returns:
   ۰ نتیجه

3. Workspace offers:
   «می‌خواهی شکار را ادامه بدهم؟»
   [فعال کردن رادار]

4. Radar becomes active.

5. A new listing later matches the same canonical search semantics.

6. Shakar surfaces the new match through the supported notification/in-app mechanism.
~~~

The important promise is continuity:

> «لازم نیست فردا دوباره همین جستجو را انجام بدهم.»

## 26.2 Why Radar belongs in Search Workspace

Radar is a natural continuation of professional search behavior.

Do not force this flow:

~~~text
Search
 ↓
No results
 ↓
My Shakar
 ↓
Saved Searches
 ↓
Find the search
 ↓
Turn on monitoring
~~~

Preferred:

~~~text
Search
 ↓
No results
 ↓
Activate Radar
~~~

The user should be able to continue the hunt at the moment they realize that waiting is useful.

## 26.3 Activation entry points

### Zero results

Primary opportunity:

> «با این شرایط نتیجه‌ای پیدا نشد.»

Then, when monitoring is supported:

> «می‌خواهی شکار را ادامه بدهم؟»

Action:

> **فعال کردن رادار**

This action must use the exact current canonical Search Context.

### Results exist

Radar may be offered as a secondary action after a meaningful search:

> **فعال کردن رادار برای این جستجو**

It must not compete visually with the primary result-scanning flow.

## 26.4 Active state

After activation, communicate clearly but quietly:

> **رادار فعاله**

Supporting copy:

> «اگر آگهی جدیدی مطابق این جستجو پیدا بشه، بهت خبر می‌دیم.»

The UI must not promise a notification channel, frequency, speed, or matching quality that the current backend does not actually support.

## 26.5 Radar states

The conceptual product states are:

~~~text
OFF
ACTIVE
PAUSED
~~~

An implementation may have additional technical states such as error or provisioning, but those must not be exposed as product states unless the backend and UX define their meaning.

### OFF

No active monitoring exists.

### ACTIVE

The canonical search context is being monitored for future matching listings.

### PAUSED

The Radar configuration remains available, but active monitoring is temporarily disabled.

Pause/resume must preserve the monitored Search Context.

## 26.6 What exactly does Radar monitor?

Radar monitors the **canonical Search Context**, not merely the raw query string.

That means the monitoring definition may include:

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
~~~

The exact persisted schema belongs to the actual repository/data model.

Critical rule:

> A Radar must not silently relax or change explicit search constraints.

If the user activated Radar for:

~~~text
query: پیانو اکوستیک یاماها U3
city: تهران
priceMax: 200000000
exclude: دیجیتال, طرح اکوستیک
~~~

the future matching process must use the same supported semantics.

## 26.7 Search changes after Radar activation

A Radar is a snapshot of the search meaning at the time it was activated unless the user explicitly updates it.

If the user changes the current Search Workspace afterward, do **not** silently mutate the active Radar.

Example:

~~~text
Current Radar:
تهران · تا ۲۰۰ میلیون · U3

User changes current search:
تا ۲۵۰ میلیون
~~~

The Radar should remain attached to its previous context until the user explicitly chooses an update action.

A future implementation may expose:

> «رادار فعلی با این جستجو فرق داره.»

with an explicit action such as:

> «به‌روزرسانی رادار»

The exact interaction can be refined during implementation, but silent mutation is forbidden.

## 26.8 Search Context identity

Two searches are equivalent for Radar purposes only when their effective canonical search semantics are equivalent.

Do not deduplicate Radars using raw query text alone.

For example:

~~~text
«پیانو یاماها تهران»
~~~

and:

~~~text
«پیانو یاماها»
city = تهران
~~~

may be semantically equivalent if the canonical model says so.

The implementation should use the canonical search representation rather than ad-hoc string comparison.

## 26.9 New match behavior

When a future listing matches an active Radar:

1. verify the listing against the same supported search semantics;
2. deduplicate by stable listing identity where available;
3. surface only real listings;
4. preserve evidence provenance;
5. reuse the same result/card semantics as normal search;
6. allow the user to open the listing and continue into VERIFY;
7. do not fabricate match scores, reasons, counts, or notification metadata.

A Radar match should feel like:

~~~text
Radar
 ↓
New matching listing
 ↓
Triage
 ↓
Verify
~~~

not like a separate content type that requires learning a new interface.

## 26.10 Duplicate prevention

The same listing must not repeatedly appear as a new Radar match merely because the monitoring job ran again.

Deduplication should use a stable listing ID when the source provides one.

If stable identity is unavailable, the implementation must define a documented fallback; never pretend that two visually similar listings are definitely different listings.

## 26.11 Missing / changed listings

A listing that was previously surfaced may later disappear, become unavailable, or change.

Radar must not imply that a previously seen listing is still available unless the backend actually confirms current availability.

If a monitoring result becomes stale, the UI should use the same truthfulness rules as normal search/detail.

## 26.12 Auth interruption

If Radar activation requires authentication:

~~~text
Activate Radar
 ↓
Auth
 ↓
Resume Radar activation
~~~

The exact Search Context must survive the interruption.

Do not send the user back to an empty Search Workspace or ask them to reconstruct the search.

## 26.13 Relationship to Saved Search

Saved Search and Radar are related but not identical:

| Concept | Purpose |
|---|---|
| Saved Search | Remember this search so I can run it again |
| Radar | Actively monitor this search for future matching listings |

A Radar may be represented internally as a monitoring configuration associated with a saved search/context, but the product must preserve the conceptual distinction.

Do not create two competing search-context models.

## 26.14 Relationship to My Shakar

Search Workspace is where a Radar is naturally created.

My Shakar is where active monitoring can later be managed:

~~~text
My Shakar
├── Saved Searches
└── Active Radars
~~~

The exact information architecture can be refined later.

Management should eventually support, where actually implemented:

- view monitored search summary;
- open the underlying search;
- pause;
- resume;
- deactivate/delete;
- see meaningful recent matches;
- understand current state.

Do not expose controls whose backend behavior does not exist.

## 26.15 Notification semantics

Notification is a delivery mechanism, not the definition of Radar.

Radar may eventually surface a match through:

- in-app indication;
- notification;
- another supported channel.

The current UX contract must not promise:

- instant notification;
- a specific delivery channel;
- a specific monitoring interval;
- guaranteed processing priority;
- guaranteed match completeness.

Those are backend/product capabilities to be defined when implemented.

## 26.16 Future subscription extension

Radar is intentionally designed as a future monetization extension point.

Possible future subscription dimensions include:

- maximum active Radars;
- monitoring frequency;
- processing priority;
- notification priority/speed;
- monitoring history;
- advanced matching capabilities.

These are **future capability dimensions, not V1 pricing decisions**.

Do not add:

- tier prices;
- paywalls;
- quotas;
- priority labels;
- monetization copy;

to the current Search Workspace implementation unless separately approved.

## 26.17 Radar UX principles

Radar must:

- feel like continuing the current hunt;
- use the same Search Context;
- preserve explicit constraints;
- avoid a new mental model;
- remain secondary to active result scanning;
- make active state understandable;
- never silently mutate;
- avoid fake monitoring;
- avoid fake notifications;
- avoid fake match counts;
- avoid duplicate matches;
- preserve auth continuity.

## 26.18 Radar acceptance criteria

The experience is correct when:

1. a user can activate Radar directly from a meaningful search where supported;
2. zero results can naturally lead to Radar activation;
3. activation preserves the exact canonical Search Context;
4. active state is visible;
5. current search edits do not silently mutate the Radar;
6. future matches use the same supported search semantics;
7. duplicate future matches are prevented;
8. Radar matches reuse normal triage/detail behavior;
9. auth interruption can resume activation where auth is required;
10. My Shakar can be the management surface where implemented;
11. unsupported notification/monitoring promises are absent;
12. no subscription economics are hard-coded into V1.


# 42. Performance Perception

The interface should feel fast even when retrieval is not instant.

## 26.1 Stable geometry

During loading:

- keep query visible;
- keep constraints visible;
- preserve result layout;
- use realistic skeleton dimensions.

## 26.2 Layout stability

Reserve image/card geometry where possible.

Avoid sudden:

- card resizing;
- image jumps;
- toolbar movement;
- filter movement.

## 26.3 Long-session stability

Repeated scanning must not create:

- duplicate listings;
- scroll jumps;
- excessive animation;
- cumulative layout drift;
- unusable DOM growth.

---

# 42. Mobile UX

## 27.1 360–390px

This is a primary target.

Requirements:

- single column;
- compact readable cards;
- advanced filters in sheet;
- no page-level horizontal overflow;
- chips may scroll horizontally only inside a bounded region when genuinely necessary;
- long titles clamp;
- no desktop sidebar;
- no giant search hero.

## 27.2 390–480px

Default mobile experience.

Core flow must be comfortable one-handed:

- search;
- refine;
- scroll;
- favorite;
- open;
- back;
- save.

## 27.3 Bottom navigation

Bottom navigation must not cover:

- result content;
- card actions;
- filter actions;
- important controls.

Respect safe-area insets.

---

# 42. Desktop UX

At 1280–1440px:

- center the workspace;
- preserve comfortable reading width;
- use extra space for breathing room and scanability;
- preserve professional density;
- keep search as visual center.

Do not create:

- analytics sidebar;
- promotional rail;
- dashboard metrics;
- decorative statistics.

Desktop may be wider, but the product logic remains the same.

---

# 42. Accessibility

## 29.1 Keyboard

Support:

- focus SearchInput;
- Enter submits;
- Escape closes temporary UI where appropriate;
- keyboard-accessible chips;
- keyboard-accessible sort/filter controls.

## 29.2 Focus

Use the design-system focus ring.

Never remove focus visibility without an equivalent.

After closing a filter sheet, restore focus sensibly.

## 29.3 Screen readers

Icon-only actions require meaningful labels, e.g.:

- «افزودن به علاقه‌مندی‌ها»
- «حذف از علاقه‌مندی‌ها»
- «پاک کردن جستجو»
- «باز کردن فیلترهای دقیق»
- «باز کردن آگهی اصلی»

## 29.4 Live regions

Use aria-live only for meaningful changes:

- result count;
- search completion/error;
- chip addition/removal.

Do not announce the entire result list.

---

# 42. Motion

Motion communicates state, not personality.

Use approximately 150–250ms transitions where consistent with the design system.

Good:

- filter sheet;
- chip addition/removal;
- favorite state;
- subtle loading;
- focus.

Avoid:

- bouncing cards;
- large page transitions;
- score theatrics;
- decorative particles.

Respect reduced-motion preferences.

---

# 42. Copy

Voice:

- Persian;
- direct;
- professional;
- concise;
- calm;
- human;
- time-saving.

Preferred:

> «چی شکار می‌کنی؟»

> «این کلمات در توضیحات باشد»

> «این کلمات در توضیحات نباشد»

> «فیلتر دقیق‌تر»

> «چرا این آگهی نمایش داده شده؟»

> «با این شرایط نتیجه‌ای پیدا نشد.»

> «دریافت نتایج با مشکل مواجه شد. جستجوی شما حفظ شده است.»

Avoid:

> «قدرت هوش مصنوعی شکار را تجربه کن!»

> «AI Match Intelligence»

> «صدها فرصت طلایی برای شما»

The product is a tool, not a campaign.

---

# 42. Truthfulness Rules

Never invent:

- result counts;
- scores;
- match reasons;
- prices;
- listing age;
- seller facts;
- new-match counts;
- monitoring state;
- contact information;
- supported filters;
- backend semantics.

If data is unavailable:

- omit it, or
- clearly expose unknown where useful.

Never use fake production-looking listings to fill empty states.

---

# 42. AI Boundary

AI helps compress intent into structured search.

Preferred:

~~~text
Natural language
 ↓
Structured interpretation
 ↓
User-visible editing
 ↓
Search
 ↓
Evidence-backed results
~~~

Forbidden as core UX:

~~~text
«از شکار هر چیزی بپرس»
~~~

The user came to hunt listings.

If AI is unavailable:

- raw search works;
- structured filters work;
- include/exclude works when supported;
- no broken chatbot surface;
- no fake AI response.

AI is additive, not a single point of failure.

---

# 42. Component Contract

Prefer reuse of:

- SearchInput;
- SearchSuggestions;
- KeywordChips;
- IncludeKeywords;
- ExcludeKeywords;
- CategorySelect;
- CitySelect;
- PriceRange;
- AdvancedFilters;
- SearchSummary;
- ActiveFilterChips;
- ResultCount;
- SortControl;
- AdList;
- AdCard;
- ShekarScoreBadge;
- MatchReasons;
- FavoriteButton;
- EmptyState;
- ErrorState;
- Skeleton;
- FloatingSearchShortcut;
- BottomTabBar.

If two components have the same semantic interaction, reuse the component.

Do not create separate visually equivalent variants merely because the page name differs.

Variants are justified only by genuine context differences such as compact, mobile, read-only, loading, or disabled behavior.

---

# 42. Data / Engineering Boundary

This document defines product behavior, not permission to replace repository architecture.

Before coding, the Agent must inspect:

1. PWA_app/docs/userFlow.md;
2. PWA_app/docs/PAGE-EXPERIENCE-SPECS-V1.md;
3. docs/designSystem.md;
4. current Search Workspace page;
5. current SearchInput/SearchFilters/KeywordChips/SearchSection/AdCard implementations;
6. actual data models and API/server boundaries.

Resolve conflicts before implementation.

Do not:

- invent backend capabilities;
- move MCP/data access into client components;
- replace existing data contracts without a documented product decision;
- fabricate live-looking data;
- create fake score/count endpoints;
- implement unsupported search semantics.

---

# 42. Responsive Acceptance Matrix

| Capability | 360px | 390px | 480px | 768px | 1280px+ |
|---|---|---|---|---|---|
| Search | full width | full width | full width | comfortable | centered |
| Include/exclude | compact/sheet | compact | compact | wider | wider |
| Results | single column | single column | single column | same hierarchy | wider reading area |
| Sort | sheet/menu | sheet/menu | sheet/menu | compact | compact |
| Bottom nav | yes | yes | yes | context-dependent | desktop shell |
| Page overflow | never | never | never | never | never |
| Forced sidebar | no | no | no | no | no |

---

# 42. Visual QA

The Agent must inspect rendered UI, not only code.

## 37.1 390×844

Verify:

- SearchInput hierarchy;
- Persian RTL;
- no clipped text;
- keyboard behavior;
- suggestions;
- include/exclude chips;
- filter sheet;
- result density;
- image proportions;
- favorite target;
- bottom navigation;
- safe-area spacing;
- no horizontal overflow.

## 37.2 480×840

Verify:

- search-to-results transition;
- active constraint density;
- long titles;
- price formatting;
- match evidence;
- sort;
- card scanability.

## 37.3 1280×800

Verify:

- centered composition;
- search remains dominant;
- no giant empty hero;
- no unnecessary dashboard columns;
- professional density;
- readable result list;
- keyboard/focus behavior.

---

# 42. UX Self-QA Before PASS

The Agent must answer these from the user's perspective.

### Discovery
1. Do I immediately know what to do?
2. Can I search without reading instructions?

### Precision
3. Can I express what must be present?
4. Can I express what must not be present?
5. Can I edit interpretation quickly?
6. Is inferred meaning distinguishable from explicit intent?

### Triage
7. Can I scan many ads quickly?
8. Can I understand why a result appeared?
9. Can I identify obvious false matches before opening them?

### Trust
10. Is every score real?
11. Is every count real?
12. Are match reasons evidence-backed?
13. Is uncertainty represented honestly?

### Continuity
14. Does refinement preserve the rest of the search?
15. Does detail back preserve useful position?
16. Does failure preserve search work?
17. Does auth resume the pending action where implemented?

### Mobile
18. Can I use the core flow one-handed?
19. Does the keyboard behave naturally?
20. Are touch targets comfortable?
21. Does bottom navigation stay out of the way?

### Visual quality
22. Is hierarchy obvious?
23. Is the workspace too dense?
24. Is it too empty?
25. Are there unnecessary boxes?
26. Is spacing consistent?
27. Does motion help?

A clearly negative answer means the Agent must fix the issue before PASS.

---

# 42. First Implementation Slice

The first coding slice derived from this document should establish the core workspace experience.

Priority order:

1. SearchInput;
2. quick precision controls;
3. interpreted/active constraint presentation;
4. include/exclude interaction;
5. advanced filter sheet/draft behavior;
6. result summary;
7. sort;
8. AdCard triage hierarchy;
9. loading/empty/error states;
10. responsive behavior;
11. accessibility;
12. search/detail continuity;
13. Radar activation/continuity where supported.

Do not use this slice to invent:

- a new scoring algorithm;
- AI infrastructure;
- MCP integration;
- unsupported filters;
- fake live data;
- fake monitoring;
- fake Radar matches;
- fake result counts.

---

# 42. Recommended Implementation Sequence

~~~text
1. Read source-of-truth docs
        ↓
2. Inspect current implementation
        ↓
3. Map existing components to this specification
        ↓
4. Identify conflicts/missing capabilities
        ↓
5. Establish SearchInput + workspace shell
        ↓
6. Establish interpreted/active constraints
        ↓
7. Establish include/exclude interaction
        ↓
8. Establish advanced filter draft/apply/cancel
        ↓
9. Establish result summary + sort
        ↓
10. Refine AdCard triage hierarchy
        ↓
11. Implement loading/empty/error states
        ↓
12. Verify back/context preservation
        ↓
13. Establish Radar activation/state contract where supported
        ↓
14. Full RTL/mobile/accessibility QA
        ↓
15. Fix all discovered UX issues
        ↓
16. Typecheck/build/tests
        ↓
17. Visual self-QA
        ↓
18. PASS only after all applicable checks pass
~~~

---

# 42. Definition of Done

Search Workspace is complete only when:

## Product
- Search is immediately understandable.
- Search/Precision/Results feel like one workspace.
- Complexity is progressive.
- AI is additive.
- No unnecessary navigation interrupts hunting.

## Search
- Raw query is preserved.
- Enter works.
- Interpretation is visible where supported.
- Explicit and inferred meaning are not falsely conflated.
- Include/exclude semantics are obvious.
- Unsupported semantics are not promised.

## Results
- Count is real or omitted.
- Sort options are real or omitted.
- Cards are optimized for scanning.
- Match reasons are evidence-backed.
- Scores are real or omitted.
- Uncertainty is honest.

## States
- Initial;
- typing;
- interpreting;
- refined;
- loading;
- results;
- no results;
- error;
- partial/uncertain where applicable.

## Continuity
- Refinement preserves search context.
- Errors preserve user work.
- Detail back preserves useful result position.
- Auth interruption resumes protected actions where implemented.

## Visual
- Persian/RTL is polished.
- 4/8pt spacing system is respected.
- Design tokens are used.
- No unnecessary boxes.
- Professional density is maintained.
- Mobile and desktop are intentionally designed.

## Accessibility
- Keyboard works.
- Focus is visible.
- Icon actions have labels.
- Chips are keyboard accessible.
- Dynamic updates are appropriately announced.
- Reduced motion is respected.

## Engineering
- Existing architecture is respected.
- No client-side MCP/data access.
- No invented backend capability.
- No fake production data.
- Shared components are reused.
- TypeScript/build/tests pass.
- Visual QA is completed at approximately 390×844 and desktop.

**Compile success is not UX PASS.**

Final standard:

> «اگر من یک کاربر حرفه‌ای دیوار بودم که این جستجو را مرتب انجام می‌دهم، آیا این رابط واقعاً کارم را سریع‌تر، واضح‌تر و کم‌خستگی‌تر می‌کند؟»

If not, keep refining.
