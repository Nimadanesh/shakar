Requirements

Functional and non-functional requirements for Shekar MVP. Source of truth for what must be built.

1. Functional Requirements

1.1 Search & Filtering (P0)





Search across all Divar categories.



Standard Divar filters: category, city, neighborhood, price range, condition, etc. (via divar-mcp).



Description text filtering:





Include keywords (must appear in description/title)



Exclude keywords (must not appear)



Case-insensitive; supports Persian and English



Filtering strategy (cost-aware):





Apply Divar structured filters + rule-based keyword matching first



Optional lightweight LLM only on ambiguous / remaining candidates



Cache frequent search results



Results ranked by Shekar Score.

1.2 Shekar Score & Smart Tags (P0)





Every ad receives a numeric Shekar Score (0–100 scale recommended).



Score signals: keyword match quality, price attractiveness, freshness, simple heuristics.



Smart tags on cards (examples): “High match”, “Good price”, “New”, etc.



Score and tags visible at a glance on list cards.

1.3 Ad List (P0)





Mobile-first scrollable list of ad cards.



Card content: primary image, title, price, short description snippet, Shekar Score + tags, location / time ago.



Infinite scroll or pagination.



Loading, empty, and error states (Persian copy).

1.4 Ad Detail Page (P0)





Clean, fast detail view.



Full description, image gallery, price, location, seller info (as provided by MCP), Shekar Score + tags.



Actions: Favorite / Unfavorite, Share, Back.



Contact actions only if MCP publicly exposes them.

1.5 Saved Search (P0)





Save current search configuration (filters + keywords + category + location).



Named saved searches.



List with last-run info and match count when available.



One-tap re-run.

1.6 Favorites (P0)





Favorite any ad (requires auth).



Favorites list using same card style.



Remove from favorites.



Persist across sessions.

1.7 Authentication (P1)





Mobile number + OTP flow.



OTP provider not finalized (structure ready; can be mocked for early MVP).



Authenticated users unlock Saved Search, Favorites, subscription status.



Guest mode allowed for browsing and searching (limited persistence).

1.8 Notifications (P1)





New matching ads for saved searches.



Delivery for MVP: in-app (push later via PWA).



Frequency controls deferred.

1.9 Standard Divar Filters (P1)





Expose useful filters supported by divar-mcp (city, neighborhood, price min/max, has image, etc.).



UI should feel familiar to Divar users.

1.10 Subscription / Monetization (Structure only)





Monthly subscription model for professional users.



Payment gateway and exact pricing deferred.



System must support subscription status (none | trial | active | expired).



Feature gating ready (e.g. saved search limits, notification frequency).

2. Non-Functional Requirements

2.1 Performance





List page must feel fast on mobile networks.



Prefer caching; limit expensive ad_details and any LLM calls.



Respect divar-mcp rate limit (~60 req/min per IP).

2.2 Reliability & Data





All Divar data is read-only via divar-mcp.



No phone numbers or private seller data beyond what MCP exposes.



Graceful degradation when MCP is slow or rate-limited.

2.3 Platform





Progressive Web App (PWA): installable, offline shell, mobile-first.



RTL layout, Persian-first UI.



Dark theme only (no light mode in MVP).

2.4 Security & Privacy





No storage of Divar credentials.



User data (favorites, saved searches, phone) stored securely.



OTP and future payment integrations follow provider best practices.

2.5 Cost Control





Rule-based filtering is the default path.



LLM usage optional, limited, and cacheable.



Design so cost per active user stays well below subscription price.

2.6 Accessibility & UX





High contrast dark theme for long sessions.



Touch targets sized for mobile.



Clear loading / empty / error states in Persian.



Persian typography (Vazirmatn) with proper numbers and English fallback.

3. Out of Scope for MVP





Seller chat / messaging



Posting or editing ads



Advanced map views



Native iOS / Android apps



Complex payment flows or multiple tiers (structure only)



Light theme



Multi-language UI (Persian primary)

4. Data Source Constraints







Item



Detail





Source



divar-mcp





Type



Public free MCP server, read-only





Used capabilities



Search with filters, full ad details (including description), category helpers





Limitations



Rate limit ≈ 60 req/min/IP; no advanced description search (we implement it); no private seller phones; read-only

5. Success Metrics (MVP)





Professional users report significantly reduced search time



High retention among users who create at least one Saved Search



Willingness to pay for monthly subscription after early usage

