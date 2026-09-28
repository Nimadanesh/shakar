Tech Stack

Overview

Shekar is a single Next.js application (from template_2) that serves both the PWA frontend and lightweight backend needs for the MVP. Divar data is consumed read-only via the public divar-mcp server. No heavy separate backend service is required for the initial release.

Frontend







Layer



Choice



Notes





Framework



Next.js 16 (App Router)



From template_2





UI Library



React 19









Language



TypeScript (strict)









Styling



Tailwind CSS v4









Component library



shadcn/ui









Icons



Lucide React









Fonts



Vazirmatn (Persian) + Inter



Via next/font





Direction



RTL



Entire app





Theme



Dark only



Fixed professional dark palette





PWA



next-pwa or built-in support



Installable, mobile-first





Runtime



Node.js 24+





Backend / Server (MVP)





Everything lives inside the same Next.js project.



Route Handlers and Server Actions for:





Authentication (OTP flow)



Saved Searches CRUD



Favorites CRUD



User profile & subscription status



Controlled calls to divar-mcp (rate-limit awareness, server-only)



No separate NestJS / Fastify service for MVP.



Future option: extract a dedicated API service if traffic or complexity grows.

Data Sources







Data



Source



Access pattern





Divar ads, search, details



divar-mcp (public MCP)



Server-side only, rate-limit aware





User accounts, saved searches, favorites, subscription



Own database



Via Next.js server

divar-mcp Constraints





Free, public, read-only



Approximate rate limit: ~60 requests / minute / IP



Provides: search with filters, full ad details (including description text), category helpers



Does not provide advanced description text search → we implement filtering ourselves



No seller phone numbers beyond publicly returned data

Database (MVP Recommendation)





Supabase (PostgreSQL + Auth helpers) or plain PostgreSQL



Alternatives: Turso, Neon, or SQLite for very early prototypes



Schema must cover: users, saved_searches, favorites, subscription_status

Authentication





Mobile number + OTP



Provider not finalized for MVP (Kavenegar, Ghasedak, SMS.ir, etc. are common options)



Structure must be ready; early development can use a mock OTP service



Session management via Next.js (cookies / JWT) or Supabase Auth

Payments / Subscription





Monthly subscription model



Gateway not finalized (Zarinpal, IDPay, etc.)



For MVP: implement subscription status fields and feature gating; real payment integration comes after MVP validation



Document clearly: “Payment provider decision deferred post-MVP”

Smart Filtering Architecture (Cost Control)





Stage 1 – Structured + Rule-based





Call divar-mcp with category, city, price, etc.



Apply include / exclude keyword filters on title + description (simple string matching, normalized Persian text)



Stage 2 – Optional LLM





Only for remaining ambiguous candidates



Use a cheap / fast model



Strict limit on number of ads sent to LLM



Caching





Cache frequent search results and ad details



Respect freshness needs of the domain



Rate-limit protection





All MCP traffic goes through server-side helpers



Queue or throttle if approaching limits

Hosting & Deployment (Suggested)





Vercel (natural fit for Next.js) or similar



Environment variables for DB, OTP provider, any future LLM keys



PWA assets and service worker configured

Development Tooling





TypeScript strict mode



ESLint + Prettier (as provided by template_2)



Quality gate: npm run check (lint + typecheck + test + build)



Path alias: @/ → src/

What Is Explicitly Not in Stack (MVP)





Separate heavy backend service



Native mobile codebases (React Native / Flutter)



Real-time WebSocket infrastructure (unless notifications later require it)



Complex multi-tenant or multi-region setup

