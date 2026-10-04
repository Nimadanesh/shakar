# Shakar Design System V2

Status: Foundation / pre-UI-design
Version: 2.0
Direction: Signal-driven professional search workspace

This document is the visual source of truth for Shakar before page-level UI design begins.

## 1. Design intent

Shakar is a professional hunting instrument for people who repeatedly search high-volume marketplaces.

The visual language must communicate precision, speed, signal over noise, confidence without arrogance, calm under dense information, modern product quality, and long-session comfort.

Brand idea:

**Hunt · Signal · Precision**

The interface should feel closer to a precision instrument than a social feed or marketplace clone.

We borrow the discipline of mature design systems, not another company's appearance: token-first implementation, semantic color roles, restrained palette, deliberate typography hierarchy, consistent spacing, predictable component states, accessibility, reusable primitives, and separation of raw values from semantic meaning.

Stripe's public design-language study is a useful methodology reference for palette, typography, spacing/layout and motion. Shakar must remain visually independent.

What Shakar must NOT become:
- a copy of Divar
- a copy of Stripe
- a generic blue SaaS dashboard
- a neon AI product
- a glassmorphism showcase
- a card-heavy analytics dashboard
- a marketing landing page

## 2. Brand DNA

Personality:
- Professional: high
- Calm: high
- Precise: very high
- Energetic: controlled
- Luxurious: subtle
- Playful: low-medium — expressed as ONE signature moment per surface
  (e.g. hero glow, frosted favorite button, spring sheet entrance); never as
  decoration spread everywhere
- Technical: medium
- Trustworthy: very high

Visual principles:
1. Signal earns color. Color is not decoration.
2. Information before decoration.
3. Contrast creates hierarchy.
4. Quiet surfaces.
5. No visual shouting.
6. Brand is cumulative: typography + spacing + surfaces + signal color + geometry + evidence-first UI.

## 3. Theme architecture

Shakar supports Dark and Light from the same semantic token system.

Raw palette tokens answer: "What color is this?"
Semantic tokens answer: "What does this color mean here?"

Components must consume semantic tokens only.

Never put a brand HEX directly inside a component. A future rebrand must be possible by changing the token layer rather than rewriting component markup.

Architecture:

raw palette -> semantic tokens -> component tokens -> components

## 4. Brand palette

Shakar uses a cool indigo-violet brand anchor. It is intentionally not Stripe Purple and is not used as a decorative wash.

Core brand:
- brand-500: #6D5EF5
- brand-400: #8174FF
- brand-600: #5B4CE0
- brand-100: #E9E7FF
- brand-900: #211D50

Use brand for primary CTA, active navigation, focus, selected controls and important interactive links.

Do not use brand for every heading, badge, card border or decorative background.

Concrete brand-form rules (binding — distribution targets alone are not enforceable):

- Active navigation = brand TINT background (surface-brand) + brand icon/text.
  NEVER a solid brand fill for a nav/tab active state.
- Solid brand fills: at most TWO per viewport (the primary CTA + one accent at
  most). A third solid brand element in the same viewport is a defect.
- Focus rings and selection rings may be brand; ordinary borders stay neutral.
- When reviewing a screen, count solid brand fills. More than two → fail the
  visual QA for that screen.

## 5. Signal palette

Signal is Shakar's distinctive decision-support color. It represents useful evidence, a confirmed match, or a meaningful discovery.

- signal-500: #27C7B0
- signal-400: #4AD8C5
- signal-600: #159F8D
- signal-100 dark: #123A36
- signal-100 light: #DDF7F2

Signal must remain sparse. If everything is Signal-colored, nothing is a signal.

## 6. Status palette

Warning:
- warning-500 dark: #F2B84B
- warning-500 light: #B97900
- warning surface dark: #3A2E18
- warning surface light: #FFF3D6

Danger:
- danger-500 dark: #F06A7A
- danger-500 light: #C9364D
- danger surface dark: #3C1D25
- danger surface light: #FDE7EA

Warning is for ambiguity, incomplete evidence and attention.
Danger is for errors and destructive actions.
Neither is branding.

## 7. Neutral palette

Dark foundation:
- neutral-0 #FFFFFF
- neutral-50 #F5F7FA
- neutral-100 #E8ECF2
- neutral-200 #CBD3DE
- neutral-300 #AAB5C3
- neutral-400 #7F8B9A
- neutral-500 #5C6877
- neutral-600 #3E4855
- neutral-700 #2A333E
- neutral-800 #1B232D
- neutral-900 #111821
- neutral-950 #0A0F15
- neutral-1000 #070B10

## 8. Semantic colors

### Dark

| Semantic | Value | Meaning |
|---|---|---|
| surface-page | #0A0F15 | page canvas |
| surface-base | #111821 | main content |
| surface-raised | #1B232D | cards, sheets, popovers |
| surface-overlay | #222C38 | highest temporary surface |
| surface-brand | #211D50 | subtle brand tint |
| surface-signal | #123A36 | signal tint |
| text-primary | #F5F7FA | primary content |
| text-secondary | #CBD3DE | supporting content |
| text-muted | #AAB5C3 | metadata/placeholders |
| text-disabled | #5C6877 | disabled content |
| text-on-brand | #FFFFFF | content on brand |
| text-on-signal | #061512 | content on signal |
| border-subtle | #1E2731 | quiet dividers |
| border-default | #2A333E | standard borders |
| border-strong | #3E4855 | emphasized borders |
| action-primary | #6D5EF5 | primary actions |
| action-primary-hover | #8174FF | primary hover |
| action-primary-active | #5B4CE0 | primary active |
| signal | #27C7B0 | useful match/evidence |
| warning | #F2B84B | attention |
| danger | #F06A7A | error/destructive |
| focus-ring | #8174FF | keyboard focus |

### Light

| Semantic | Value | Meaning |
|---|---|---|
| surface-page | #F7F9FC | page canvas |
| surface-base | #FFFFFF | main content |
| surface-raised | #FFFFFF | cards, sheets, popovers |
| surface-overlay | #FFFFFF | highest temporary surface |
| surface-brand | #EEECFF | subtle brand tint |
| surface-signal | #DDF7F2 | signal tint |
| text-primary | #111821 | primary content |
| text-secondary | #3E4855 | supporting content |
| text-muted | #5C6877 | metadata/placeholders |
| text-disabled | #AAB5C3 | disabled content |
| text-on-brand | #FFFFFF | content on brand |
| text-on-signal | #061512 | content on signal |
| border-subtle | #E8ECF2 | quiet dividers |
| border-default | #CBD3DE | standard borders |
| border-strong | #AAB5C3 | emphasized borders |
| action-primary | #5B4DE8 | primary actions |
| action-primary-hover | #6D5EF5 | primary hover |
| action-primary-active | #4D40C7 | primary active |
| signal | #159F8D | useful match/evidence |
| warning | #B97900 | attention |
| danger | #C9364D | error/destructive |
| focus-ring | #5B4DE8 | keyboard focus |

## 9. Color usage rules

Target visual distribution is approximately 80–90% neutral, 5–15% brand, and very small Signal/Warning/Danger usage. These are design targets, not hard implementation percentages.

Primary brand: interaction and navigation.
Signal: actual evidence or useful match.
Warning: uncertainty or attention.
Danger: failure or destructive action.
Neutral: most of the interface.

Never use a strong match treatment when a major requirement is unresolved.

## 10. Typography

Shakar is Persian-first. We must not blindly reproduce a Latin typography system.

Primary family:
Vazirmatn

Fallback:
Inter, system-ui, sans-serif

Mono:
ui-monospace, SFMono-Regular, Menlo, Consolas, monospace

Use one primary UI family. Do not add a decorative display font.

Type scale:

| Token | Size | Line height | Weight | Use |
|---|---:|---:|---:|---|
| display-lg | 40px | 1.12 | 600 | rare major statement |
| display-md | 32px | 1.15 | 600 | major section |
| heading-xl | 24px | 1.25 | 600 | page title |
| heading-lg | 20px | 1.35 | 600 | section title |
| heading-md | 18px | 1.4 | 600 | card/section heading |
| body-lg | 16px | 1.55 | 400 | explanatory copy |
| body-md | 15px | 1.55 | 400 | default body |
| body-sm | 14px | 1.5 | 400 | compact body |
| label-md | 13px | 1.4 | 500 | controls |
| label-sm | 12px | 1.35 | 500 | metadata/tags |
| caption | 11px | 1.35 | 400 | low-priority metadata |
| mono-md | 13px | 1.45 | 400 | technical/numeric |

Allowed default weights: 400, 500, 600. Use 700 only when genuinely necessary.

For prices, counts and comparison-heavy numeric UI, use tabular numerals when supported.

## 11. Spacing

Shakar follows an **8px primary rhythm** for page-level composition, with **4px micro-spacing** available inside controls. This preserves the spacious/editorial discipline of the reference while remaining practical for a dense professional search product.

### Canonical spacing tokens

| Token | Value | Primary use |
|---|---:|---|
| space-1 | 4px | icon/text micro-gap, tight internal adjustment |
| space-2 | 8px | label→field, icon→text, chip internals |
| space-3 | 12px | related controls, compact card groups |
| space-4 | 16px | standard mobile gap, card padding, control groups |
| space-5 | 24px | section internals, desktop card padding |
| space-6 | 32px | major internal separation |
| space-7 | 48px | mobile section separation / large group |
| space-8 | 64px | desktop section separation |
| space-9 | 80px | major editorial separation |
| space-10 | 120px | rare large desktop separation |

### Mobile spacing rules — 360–480px

Mobile is **not** a shrunken desktop. It uses a deliberate compact rhythm so professional users can scan more without feeling cramped.

- page gutter: **16px**
- minimum safe content width: 328px at 360px viewport
- section-to-section: **32px**, increasing to **48px** only for true major transitions
- heading→supporting copy: **8–12px**
- field/control groups: **12px**
- label→field: **8px**
- chip rows/groups: **8–12px**
- card internal padding: **16px**
- result-to-result gap: **12px**
- primary CTA group: **12px**
- bottom-nav clearance: **at least 16px + safe-area inset**
- floating controls from viewport edge: **16px + safe-area inset**

### Desktop spacing rules — 768px+

- page gutter: **24–32px**
- section-to-section: **48–64px**
- major section transition: **80px**; 120px only when composition genuinely benefits
- card padding: **20–24px**
- result-to-result gap: **16px**
- content measure should remain readable; extra width becomes whitespace, not extra UI chrome

### Spacing hierarchy

Use spacing to communicate grouping:

1. **4–8px** = belongs together
2. **12–16px** = related items
3. **24–32px** = separate groups
4. **48–64px** = separate sections
5. **80–120px** = major editorial transition

Do not create extra cards or dividers when spacing can establish the hierarchy.

### Mobile anti-drift rules

- Do not mix 16px, 18px, 20px, 22px and 24px gaps for equivalent relationships.
- Equivalent relationships must use the same token.
- Prefer 8/12/16/24/32/48 over one-off values.
- A component may use a smaller internal token than its parent, but should not invent a new rhythm.
- Vertical rhythm is more important than decorative symmetry.
- Never compensate for a weak hierarchy by adding extra padding.

### Density rule

Shakar has:
- **low density** between major sections
- **medium density** inside the search workspace
- **high information density only where it improves result scanning**

The result list may be information-dense, but page chrome should remain quiet.

## 12. Layout

Target widths:
- 360
- 390
- 430
- 480
- 768
- 1280+
- 1440

Mobile:
- single column
- one-handed core actions
- no horizontal page overflow
- safe-area-aware bottom navigation
- result cards optimized for scanning

Tablet:
- additional breathing room
- two-column composition only when it improves the hunt
- never become a dashboard

Desktop:
- centered content
- comfortable reading width
- search remains primary
- no decorative analytics sidebar

Suggested maximum content width: 1200px.

### Viewport composition rule

No viewport may spend more than ~30% of its first screen on header/filter chrome
before useful content. On the results page this is enforced by the single sticky
context bar (PAGE-EXPERIENCE-SPECS-V1.md §2.2). Treat chrome-budget violations as
layout defects, not style preferences. Use judgment rather than a ruler — the
principle is: the hunter reaches the first meaningful result fast.

## 13. Radius

| Token | Value | Use |
|---|---:|---|
| radius-none | 0 | structural exceptions |
| radius-sm | 4px | compact controls |
| radius-md | 8px | inputs/buttons/small cards |
| radius-lg | 12px | cards/sheets |
| radius-xl | 16px | prominent containers |
| radius-2xl | 20px | major floating surfaces |
| radius-pill | 9999px | chips/pills/floating nav |

## 13.1 Shape roles (LAW)

Every visible element belongs to exactly one shape role. Roles must be visually
distinct — when everything shares one geometry, hierarchy dies.

1. **Field** — text inputs, search inputs, selects: rounded rectangle
   (radius-md/lg). NEVER a full capsule/pill. A pill-shaped input reads as a
   button, which is why screens built from pill-inputs feel like "a page of
   buttons".
2. **Button** — ONE consistent button geometry per size (pick pill OR rounded
   rect and use it everywhere). A button must never be visually confusable with
   a field or a panel.
3. **Card / panel** — radius-lg and above, NEVER a full capsule. A collapsible
   panel, summary block, or notice must not look like a button.

Corollary: **no element may look like a button unless it is one.**

## 13.2 Nested radius law (LAW)

An inner element's radius = its container's radius − the padding between them.
A full circle floating inside a capsule is banned. Button geometry must derive
from its container's geometry.

Example: search bar with 18px outer radius and 6px inner padding → submit button
uses 12px radius, not a full circle.

## 14. Borders

Use:
- border-subtle
- border-default
- border-strong

Borders establish hierarchy. Do not outline every child. Avoid double borders on nested surfaces.

## 15. Elevation

Shakar is relatively flat.

Preferred hierarchy:
1. surface contrast
2. border
3. backdrop treatment for floating chrome
4. shadow only when necessary

Use three conceptual levels:
- elevation-0: none
- elevation-1: subtle floating control
- elevation-2: sheet/popover/dialog
- elevation-3: rare system overlay

Avoid decorative shadows on ordinary cards.

## 16. Glass

Glass is a utility, not the brand.

Allowed mainly for:
- floating header
- bottom navigation
- temporary floating controls

Recipe:
translucent semantic surface + backdrop blur + hairline border + restrained shadow.

Ordinary result cards should not become glass cards.

## 17. Motion

Durations:
- micro: 150ms
- standard: 200ms
- complex: 250ms

Easing:
cubic-bezier(0.23, 1, 0.32, 1)

Use motion for state changes, filtering, navigation continuity and result insertion.

Avoid bounce, particles, decorative parallax and attention-seeking animation.

Respect prefers-reduced-motion.

## 18. Interaction states

Every interactive component defines:
- default
- hover
- focus-visible
- active/pressed
- selected
- disabled
- loading
- error where relevant

Focus must be visible and not rely only on color.

Minimum touch target: 44x44px.
Icon-only controls: normally at least 40x40px.

## 19. Component rules

### Button
Variants: primary, secondary, outline, ghost, destructive.
States: default, hover, focus-visible, pressed, disabled, loading.
Primary uses action-primary.

### Input
Types: search, text, number, tel, password if needed.
Must support label, placeholder, value, focus, error, disabled and loading where applicable.

### Search input
The main query input is the only true search input. It should dominate ordinary controls without becoming oversized.

### Include / Exclude chips
Shared chip primitive.
Include = must be present.
Exclude = must not be present.
Difference must remain understandable without color alone.

### Card
A card is a structural container, not the default pattern for every UI block.

AdCard hierarchy:
1. image
2. title
3. price
4. evidence
5. match signal
6. location/time
7. favorite/action

### Badge
Use only for meaningful metadata. Do not badge everything.

### Bottom navigation
May use controlled glass treatment, safe-area handling and a clear active state.

### Sheet/Dialog
Use surface hierarchy rather than heavy shadows.
Filter sheets preserve draft state until Apply.

## 20. Iconography

Library: Lucide React.

Rules:
- monochrome
- currentColor
- no decorative multi-color icons
- 18–20px default
- 22–24px tab icons
- 14–16px inline icons
- consistent stroke weight

Icons support meaning; they do not replace necessary labels.

## 21. Search-specific visual language

Most important surface:
Query -> Meaning -> Precision -> Results -> Evidence

Visual priority:
1. query
2. active constraints
3. result count/sort
4. listing title/price
5. evidence
6. metadata
7. secondary actions

The UI rewards precision, not decoration.

Signal language:
- verified supporting evidence -> Signal
- uncertain evidence -> Warning or neutral
- no evidence -> no positive signal

## 22. Evidence language

Shakar distinguishes:
- Direct evidence
- Detected evidence
- Inferred interpretation
- Unknown

Example:
✓ یاماها
✓ U3
؟ وضعیت آکوستیک مشخص نیست

Never show a strong match treatment when a major requirement is unresolved.

## 23. Accessibility

Requirements:
- keyboard navigable
- visible focus
- WCAG AA contrast target for normal text
- semantic HTML
- accessible names for icon buttons
- no color-only meaning
- reduced-motion support
- logical RTL reading order

Both themes must be contrast-tested before UI slices are considered complete.

## 24. RTL and bilingual robustness

Shakar is Persian-first and RTL.

Rules:
- root dir=rtl
- prefer logical CSS properties
- do not hard-code left/right when start/end is appropriate
- numbers may remain visually LTR where appropriate
- URLs/codes use appropriate LTR isolation
- mixed Persian/English content must not break layout

## 25. Agent implementation rules

Before modifying UI, read:
1. this document
2. PWA_app/docs/userFlow.md
3. PWA_app/docs/PAGE-EXPERIENCE-SPECS-V1.md
4. PWA_app/docs/SEARCH-WORKSPACE-SPEC-V1.md
5. current globals.css
6. relevant components and data boundaries

Resolve conflicts before coding.

During implementation:
- use semantic tokens
- never hard-code brand HEX values in components
- do not invent colors
- do not invent arbitrary spacing
- do not create one-off radii
- reuse primitives
- preserve RTL and responsive behavior
- preserve product semantics
- never invent unsupported backend behavior

## 26. Visual QA matrix

Check every meaningful UI slice at:
360x800, 390x844, 430x932, 480x840, 768x1024, 1280x800, 1440x900.

Check:
- hierarchy
- contrast
- spacing rhythm
- RTL
- long Persian strings
- mixed Persian/English
- touch targets
- focus states
- overflow
- safe-area
- dark/light parity
- empty/loading/error states

## 27. Design-system acceptance criteria

- Dark and Light semantic architecture exists.
- Raw palette and semantic roles are separated.
- Typography scale is explicit.
- Spacing scale is explicit.
- Radius scale is explicit.
- Border/elevation/motion rules are explicit.
- Interaction states are explicit.
- Accessibility rules are explicit.
- RTL rules are explicit.
- Search-specific visual language is explicit.
- Component rules are explicit.
- Agent implementation rules are explicit.
- Components do not need brand HEX values.
- Theme can be changed centrally.
- Both themes are included in visual QA.

## 28. Final principle

> **Shakar should look calm when the data is noisy.**

The product wins when hundreds of listings feel manageable because the interface makes signal obvious, keeps irrelevant information quiet, and lets a professional user move from need to decision with minimal friction.

### Reference

Stripe design language study:
https://stripe.design/
