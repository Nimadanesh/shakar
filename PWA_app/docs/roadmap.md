Roadmap

Phase 0 — Foundation (Current)





[x] Problem & audience defined



[x] Core decisions locked (name, PWA, all categories, template_2, divar-mcp)



[x] Design tokens & visual direction finalized



[x] Documentation set complete and aligned with BASE-TEMPLATE



[x] Project scaffolding from template_2



[x] Design system tokens implemented in globals.css / Tailwind



[x] Root layout: RTL + Vazirmatn + dark theme

Phase 1 — MVP (Core Value)

Goal: A professional user can search with description filters, see scored results, save searches, and favorite ads. Time-to-find is noticeably reduced.

Must-have (P0)





[ ] Advanced search UI (query + category + location + price + include/exclude keywords)



[ ] Server-side integration with divar-mcp (search + ad details)



[ ] Rule-based description filtering



[ ] Shekar Score + smart tags on list cards



[ ] Ad list (infinite scroll / pagination, loading & empty states)



[ ] Ad detail page



[ ] Saved Search (CRUD + re-run)



[ ] Favorites (add / remove / list)



[ ] Basic auth structure (mobile + OTP, mockable)



[ ] Bottom navigation & core screens



[ ] PWA installability & mobile-first layout



[ ] Dark theme fully applied

Should-have (P1)





[ ] Real OTP provider integration



[ ] Standard Divar filters fully exposed



[ ] New-ad notifications for saved searches (in-app at minimum)



[ ] Subscription status model + simple feature gating



[ ] Basic caching layer for frequent searches

Explicitly deferred





Chat with seller



Posting ads



Advanced maps



Native apps



Real payment gateway (structure only)



Light theme



Multi-ad comparison, price estimation, history (P2)

Phase 2 — Retention & Monetization





[ ] Production OTP + payment gateway



[ ] Reliable push / PWA notifications



[ ] Subscription plans & paywall UX



[ ] Usage analytics (search volume, save rate, retention)



[ ] Performance & rate-limit hardening



[ ] Optional lightweight LLM stage for harder matching cases



[ ] Improved Shekar Score (more signals)

Phase 3 — Growth & Differentiation





[ ] Market discovery / price insights features



[ ] Comparison tools



[ ] Search & view history



[ ] Deeper personalization



[ ] Evaluate native apps only after clear retention & willingness-to-pay

Success Criteria for MVP Exit





Users can complete the core happy path without friction



Professional testers report meaningful time savings



At least one Saved Search + Favorites flow works end-to-end



Cost per active user remains controllable



Codebase is clean, typed, and ready for the coding agent to continue iterating

Guiding Principle

Ship the smallest thing that makes a professional Divar user feel:
“Without Shekar my searches take much longer.”