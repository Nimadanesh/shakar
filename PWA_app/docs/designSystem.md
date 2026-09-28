Design System



Shekar design tokens and component rules. Implement tokens in src/app/globals.css (CSS variables / Tailwind v4 @theme).

Brand Summary





Direction: Professional dark theme, familiar to Divar users but cleaner and more modern. High contrast for long sessions. Mobile-first PWA, fully RTL.



Light / dark: dark only



Density: compact (power-user product; readable but space-efficient)

Color

Map brand colors to semantic tokens. Prefer oklch when convenient; hex values below are authoritative for MVP.

Shekar is dark-only. Light column is left as reference / future-proofing but is not used.

| Token                | Light (unused)          | Dark                   | Usage                          |
| -------------------- | ----------------------- | ---------------------- | ------------------------------ |
| `background`         | —                       | `#0B0B0D`              | Page background                |
| `foreground`         | —                       | `#F4F4F5`              | Primary text                   |
| `card` / surface     | —                       | `#161618`              | Ad cards, boxes                |
| `card-foreground`    | —                       | `#F4F4F5`              | Text on cards                  |
| `popover`            | —                       | `#1E1E21`              | Elevated surfaces, modals      |
| `popover-foreground` | —                       | `#F4F4F5`              |                                |
| `primary`            | —                       | `#FF4D3A`              | Logo, primary CTAs, active tab, “شکار” tag |
| `primary-foreground` | —                       | `#FFFFFF`              | Text / icons on primary        |
| `secondary`          | —                       | `#1E1E21`              | Secondary surfaces, header, tab bar |
| `secondary-foreground`| —                      | `#F4F4F5`              |                                |
| `muted`              | —                       | `#27272A`              | Subtle backgrounds             |
| `muted-foreground`   | —                       | `#A1A1AA`              | Descriptions, metadata, placeholders |
| `accent`             | —                       | `#F5A623`              | Shekar Score, important badges, highlights |
| `accent-foreground`  | —                       | `#0B0B0D`              | Text on accent                 |
| `destructive`        | —                       | `#EF4444`              | Errors / danger / delete       |
| `destructive-foreground` | —                   | `#FFFFFF`              |                                |
| `border`             | —                       | `#27272A`              | Borders, dividers, card strokes|
| `input`              | —                       | `#27272A`              | Input borders                  |
| `ring`               | —                       | `#FF4D3A`              | Focus rings                    |
| `success`            | —                       | `#22C55E`              | Positive status                |

Brand palette (raw)





Brand primary: #FF4D3A (Shekar red/orange)



Brand accent / score: #F5A623



Success / warning / info: success #22C55E; destructive #EF4444; warning can reuse accent

Typography

| Role    | Family             | Size / line-height          | Weight          | Notes                          |
| ------- | ------------------ | --------------------------- | --------------- | ------------------------------ |
| Display | Vazirmatn          | 20–24 px / 1.3              | Bold (700)      | Rare; page-level emphasis      |
| Heading | Vazirmatn          | h1–h6 scale (18–20 px base) | Bold / Medium   | Section & page titles          |
| Body    | Vazirmatn          | 13–14 px / 1.6–1.7          | Regular (400)   | Default copy, descriptions     |
| Label   | Vazirmatn          | 11–12 px / 1.4              | Regular / Medium| Tags, metadata, captions       |
| Mono    | Inter / system mono| 13 px                       | Regular         | Numbers, codes if needed       |

Loading: next/font/google or next/font/local in src/app/layout.tsx.
Primary: Vazirmatn (weights 400, 500, 700). Secondary/fallback for English & numbers: Inter.
Entire app is RTL; apply dir="rtl" at root.

Spacing & Layout





Base unit: 4px



Scale: 4, 8, 12, 16, 20, 24, 32, 48



Content max-width: full-width on mobile; constrained on larger screens only if needed



Page padding: 16px horizontal



Section vertical rhythm: 16–24px



Grid: Mobile-first single column; card lists stack vertically. No complex multi-column grids required for MVP.

Radius, Shadow, Motion

| Token           | Value                 | Usage                  |
| --------------- | --------------------- | ---------------------- |
| Radius          | 8px–12px (cards), 6px–8px (buttons/inputs) | buttons, cards, inputs, badges |
| Shadow sm/md/lg | subtle dark shadows only | elevation (use sparingly) |
| Motion duration | 150–250 ms            | default transitions    |
| Motion easing   | ease-out / standard   | default easing         |

Motion principles: Subtle only. Respect prefers-reduced-motion. No large decorative animations.

Breakpoints

| Name    | Width           | Notes                  |
| ------- | --------------- | ---------------------- |
| Mobile  | ~390px          | default (mobile-first) |
| Tablet  | ~768px          | optional refinements   |
| Desktop | ~1440px         | not primary focus for MVP |
| Custom  | —               | —                      |

Iconography





Library: Lucide React (default)



Default size: 20px (actions), 24px (tab icons)



Stroke: match shadcn / Lucide defaults (usually 2)

Components

Document each shared component as you add it.

Button





Variants: default (primary), secondary, outline, ghost, destructive



Sizes: default, sm, lg, icon



States: default, hover, focus-visible, active, disabled, loading



Notes: Primary uses brand #FF4D3A. Keep high contrast.

Input / Form





Types: text, search, number (price), tel (mobile)



Validation / error display: inline message under field in Persian + destructive color



Notes: Dark surface inputs, clear focus ring using ring token. Include/Exclude keyword fields should be visually distinct.

Card





Structure: image (top) → title → price → short description → score + tags → meta (location / time)



Variants: default ad card, compact list card if needed



Notes: Background surface (#161618), subtle border, compact padding (12–16px).

Navigation





Pattern: Bottom tab bar (primary on mobile)



Tabs: آگهی‌ها | شکار من | کشف بازار | پروفایل



Mobile behavior: fixed bottom, safe-area aware, active tab in primary color



Header: elevated surface, logo “شکار” in primary, search trigger

Feedback





Toast / dialog / empty / skeleton: use shadcn patterns; all copy in Persian



Empty states and error messages must be clear and actionable



Skeletons for list and detail loading

Additional components (MVP)

| Component            | Path (suggested)              | Variants       | Notes                          |
| -------------------- | ----------------------------- | -------------- | ------------------------------ |
| AdCard               | `src/components/ads/AdCard`   | default        | Score badge + smart tags       |
| ShekarScoreBadge     | `src/components/ads/...`      | default        | Accent color                   |
| SearchFilters        | `src/components/search/...`   | —              | Include/exclude keywords       |
| SavedSearchList      | `src/components/search/...`   | —              |                                |
| BottomTabBar         | `src/components/layout/...`   | —              | Fixed, RTL                     |

Content Guidelines





Voice: Professional, direct, time-saving. Avoid marketing fluff. See project brief.



Placeholder policy: Persian placeholders that describe the expected input (e.g. «کلمات کلیدی که باید در توضیحات باشد»)



Image style: Real ad photos from Divar; maintain aspect ratio; graceful fallback when missing

Do / Don't







Do



Don't





Use semantic tokens from this doc



Hard-code one-off hex in components





Spec states before building



Ship default-only UI





Match spacing scale



Magic numbers outside the scale





Keep density compact but readable



Add light theme or LTR layouts





Put all MCP / data logic server-side



Call divar-mcp from the client





Write UI strings in Persian



Mix English UI copy

