Project Brief



Product source of truth for agents. All placeholders filled for Shekar.

Overview

| Field            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| **Project name** | shekar / شکار                                                  |
| **One-liner**    | Independent service for professional Divar users that reduces serious hunt time from days to 1–2 hours by filtering on ad description text, smart scoring, and a clean professional experience. |
| **Status**       | build (MVP documentation complete, ready for agent implementation) |

Goals





Primary goal: Make professional / high-frequency Divar users feel that their hunt time has been meaningfully reduced — the monthly subscription they pay for.



Success looks like:





Users complete core search → filter → score → save/favorite flows without friction



Testers report clear time savings



Cost per active user stays controllable relative to subscription price



Out of scope (for now):





Seller chat / messaging



Posting or editing ads



Advanced maps



Native iOS / Android apps



Complex payment flows (structure only)



Light theme



Multi-language UI (Persian primary)

Audience





Primary users: Professional and high-frequency Divar users — dealers, serious continuous buyers, people who perform heavy searches daily or weekly and value their time enough to pay.



Jobs to be done:





Quickly find truly relevant ads without opening hundreds of listings



Filter on free-text description (include / exclude keywords)



Save recurring searches and get notified of new matches



Favorite and compare promising ads



Context of use: Mobile-first (PWA), often on the go or during focused search sessions; hurried but deliberate; high-frequency use.

Brand & Voice





Brand name: شکار (Shekar)



Personality: Professional, direct, efficient, slightly sharp (like a hunter that saves time)



Tone of copy: Clear, concise, Persian, no marketing fluff. Focus on time saved and precision.



Visual direction: Dark professional theme, familiar to Divar users but cleaner and more modern. High contrast for long sessions. Compact density. Primary accent red/orange (#FF4D3A), score accent amber (#F5A623).



Logo / assets: Logo text “شکار” in primary color. No external brand assets required beyond the design tokens. Screenshot reference exists for layout inspiration only (colors come from the design system, not pixel extraction).

Product Surface

Pages / routes

| Route              | Purpose                                      | Priority |
| ------------------ | -------------------------------------------- | -------- |
| `/` (Ads / Search) | Main search, filters, scored ad list         | P0       |
| `/ads/[id]`        | Ad detail page                               | P0       |
| `/my` or `/saved`  | Saved Searches + Favorites (My Shekar)       | P0       |
| `/profile`         | Account, subscription status, settings       | P1       |
| `/auth` or modal   | Mobile + OTP login                           | P1       |
| Market Discovery   | Light insights / future (کشف بازار)          | P2       |

Key user flows





Core Hunt — Enter query + category + location + price + include/exclude description keywords → see ranked list with Shekar Score & smart tags → open detail or refine.



Save & Re-run — After a search, save it → later re-run from My Shekar with one tap → (P1) receive notifications for new matches.



Favorite — Tap favorite on list or detail → manage list under My Shekar (requires auth).



Auth — Protected action triggers mobile + OTP → on success resume original action. Guest can still search and view.

Constraints





Technical:





Frontend from template_2 (Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui)



Data: public free divar-mcp (read-only, ~60 req/min/IP). All MCP calls server-side only.



Filtering: rule-based first → optional cheap LLM on limited candidates → cache.



Backend for MVP: Next.js Route Handlers / Server Actions + database (Supabase or PostgreSQL). No heavy separate service required yet.



OTP and payment provider deferred; structure must be ready.



Accessibility: Keyboard reachable interactive elements, focus-visible, meaningful alt text. Target practical mobile accessibility; full WCAG 2.2 AA as stretch.



Performance: Fast list rendering on mobile networks. Minimize expensive MCP / LLM calls. Respect rate limits.



Content: UI in Persian. Code, comments, docs in English. RTL throughout. Real Divar ad data (no fake content in production flows).



Timeline: MVP focused on P0 features first. Documentation complete; implementation via coding agent.

Design System Link

Tokens, type, spacing, and component rules live in designSystem.md.
Code conventions live in conventions.md.
Build process lives in workflows.md.

Open Questions





[ ] Final OTP provider (Kavenegar / Ghasedak / SMS.ir / mock for early MVP)



[ ] Final payment gateway and exact subscription pricing



[ ] Exact Shekar Score formula weights (to be tuned after first real data)



[ ] Notification delivery details (in-app first, push later)

Notes





Domain: all Divar categories (not limited to one product type).



Platform start: PWA (installable, mobile-first). Native only after proven traction.



Cost control is critical: never default to heavy LLM usage.



The product should make a professional user feel: “Without Shekar my searches take much longer.”

