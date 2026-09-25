# Design System

> Scaffold for per-project design tokens and component rules.  
> Implement tokens in `src/app/globals.css` (CSS variables / Tailwind v4 `@theme`).  
> Replace every `{{PLACEHOLDER}}`.

## Brand Summary

- **Direction:** `{{VISUAL_DIRECTION}}`
- **Light / dark:** `{{THEME_MODE}}` <!-- light only | dark only | both -->
- **Density:** `{{DENSITY}}` <!-- comfortable | compact -->

## Color

Map brand colors to semantic tokens. Prefer oklch.

| Token | Light | Dark | Usage |
| ----- | ----- | ---- | ----- |
| `background` | `{{BG_LIGHT}}` | `{{BG_DARK}}` | Page background |
| `foreground` | `{{FG_LIGHT}}` | `{{FG_DARK}}` | Primary text |
| `primary` | `{{PRIMARY_LIGHT}}` | `{{PRIMARY_DARK}}` | Primary actions |
| `primary-foreground` | `{{PRIMARY_FG_LIGHT}}` | `{{PRIMARY_FG_DARK}}` | Text on primary |
| `secondary` | `{{SECONDARY_LIGHT}}` | `{{SECONDARY_DARK}}` | Secondary surfaces |
| `muted` | `{{MUTED_LIGHT}}` | `{{MUTED_DARK}}` | Subtle backgrounds |
| `muted-foreground` | `{{MUTED_FG_LIGHT}}` | `{{MUTED_FG_DARK}}` | Secondary text |
| `accent` | `{{ACCENT_LIGHT}}` | `{{ACCENT_DARK}}` | Highlights |
| `destructive` | `{{DESTRUCTIVE_LIGHT}}` | `{{DESTRUCTIVE_DARK}}` | Errors / danger |
| `border` | `{{BORDER_LIGHT}}` | `{{BORDER_DARK}}` | Borders |
| `ring` | `{{RING_LIGHT}}` | `{{RING_DARK}}` | Focus rings |

### Brand palette (raw)

- **Brand primary:** `{{BRAND_PRIMARY}}`
- **Brand secondary:** `{{BRAND_SECONDARY}}`
- **Success / warning / info:** `{{STATUS_COLORS}}`

## Typography

| Role | Family | Size / line-height | Weight | Notes |
| ---- | ------ | ------------------ | ------ | ----- |
| Display | `{{FONT_DISPLAY}}` | `{{DISPLAY_SCALE}}` | `{{W}}` | Hero / marketing |
| Heading | `{{FONT_HEADING}}` | h1–h6 scale | `{{W}}` | Section titles |
| Body | `{{FONT_BODY}}` | `{{BODY_SIZE}}` | `{{W}}` | Default copy |
| Label | `{{FONT_LABEL}}` | `{{LABEL_SIZE}}` | `{{W}}` | UI labels |
| Mono | `{{FONT_MONO}}` | `{{MONO_SIZE}}` | `{{W}}` | Code |

**Loading:** `next/font/google` or `next/font/local` in `src/app/layout.tsx` — `{{FONT_LOADING_NOTES}}`

## Spacing & Layout

- **Base unit:** `{{SPACING_BASE}}` <!-- e.g. 4px -->
- **Scale:** `{{SPACING_SCALE}}` <!-- e.g. 4, 8, 12, 16, 24, 32, 48, 64 -->
- **Content max-width:** `{{CONTENT_MAX_WIDTH}}`
- **Page padding:** `{{PAGE_PADDING}}`
- **Section vertical rhythm:** `{{SECTION_Y}}`
- **Grid:** `{{GRID_NOTES}}`

## Radius, Shadow, Motion

| Token | Value | Usage |
| ----- | ----- | ----- |
| Radius | `{{RADIUS}}` | buttons, cards, inputs |
| Shadow sm/md/lg | `{{SHADOWS}}` | elevation |
| Motion duration | `{{MOTION_DURATION}}` | default transitions |
| Motion easing | `{{MOTION_EASING}}` | default easing |

**Motion principles:** `{{MOTION_PRINCIPLES}}` <!-- subtle | expressive; reduced-motion support -->

## Breakpoints

| Name | Width | Notes |
| ---- | ----- | ----- |
| Mobile | ~390px | default (mobile-first) |
| Tablet | ~768px | `{{TABLET_NOTES}}` |
| Desktop | ~1440px | `{{DESKTOP_NOTES}}` |
| Custom | `{{CUSTOM_BP}}` | `{{CUSTOM_BP_NOTES}}` |

## Iconography

- **Library:** Lucide React (default) — `{{ICON_OVERRIDES}}`
- **Default size:** `{{ICON_SIZE}}`
- **Stroke:** `{{ICON_STROKE}}`

## Components

Document each shared component as you add it.

### Button

- Variants: `{{BUTTON_VARIANTS}}` <!-- default, secondary, outline, ghost, destructive, link -->
- Sizes: `{{BUTTON_SIZES}}`
- States: default, hover, focus-visible, active, disabled, loading
- Notes: `{{BUTTON_NOTES}}`

### Input / Form

- Types: `{{INPUT_TYPES}}`
- Validation / error display: `{{FORM_VALIDATION_UI}}`
- Notes: `{{FORM_NOTES}}`

### Card

- Structure: `{{CARD_STRUCTURE}}`
- Variants: `{{CARD_VARIANTS}}`

### Navigation

- Pattern: `{{NAV_PATTERN}}` <!-- top bar, sidebar, etc. -->
- Mobile behavior: `{{NAV_MOBILE}}`

### Feedback

- Toast / dialog / empty / skeleton: `{{FEEDBACK_PATTERNS}}`

### Additional components

| Component | Path | Variants | Notes |
| --------- | ---- | -------- | ----- |
| `{{COMPONENT_NAME}}` | `src/components/...` | `{{VARIANTS}}` | `{{NOTES}}` |

## Content Guidelines

- **Voice:** see project brief
- **Placeholder policy:** `{{PLACEHOLDER_POLICY}}`
- **Image style:** `{{IMAGE_STYLE}}`

## Do / Don't

| Do | Don't |
| -- | ----- |
| Use semantic tokens from this doc | Hard-code one-off hex in components |
| Spec states before building | Ship default-only UI |
| Match spacing scale | Magic numbers outside the scale |
| `{{DO_CUSTOM}}` | `{{DONT_CUSTOM}}` |
