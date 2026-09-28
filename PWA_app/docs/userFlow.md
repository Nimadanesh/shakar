User Flows

Mobile-first, RTL, dark theme. All UI copy in Persian.

1. First Launch / Guest Browse





User opens the PWA (or installs it).



Lands on the main Ads / Search screen.



Can immediately:





Type a search query



Select category



Apply location / price / other standard filters



Add include / exclude keywords for description



Results appear as scored cards.



User can open any ad detail without logging in.



Attempting to Save Search or Favorite prompts login.

2. Search & Filter Flow (Core)





User enters keywords in the main search bar (or opens advanced filters).



Optionally selects:





Category (all Divar categories supported)



City / neighborhood



Price range



Other Divar structured filters



Adds Include keywords and Exclude keywords for description text.



Taps Search / Apply.



System:





Calls divar-mcp with structured filters (server-side)



Applies rule-based keyword filtering on titles + descriptions



Optionally runs lightweight LLM scoring on remaining candidates



Computes Shekar Score + smart tags



Returns ranked list



User scrolls the list, opens details, favorites, or refines filters.



User can save the entire search configuration as a Saved Search.

3. Ad Detail Flow





From list or favorites, user taps an ad card.



Detail page loads (image gallery, full description, price, location, score, tags).



Actions available:





Favorite / Unfavorite



Share



Back



Contact seller only if MCP provides public contact info



User returns to list or navigates via bottom tab.

4. Authentication (Mobile + OTP)





User triggers a protected action (Save Search, Favorite, Profile, Subscription).



Auth modal / screen appears:





Enter mobile number (Iranian format)



Request OTP



User enters OTP.



On success:





Session created



Previous guest actions (if any) can be merged



User is returned to the interrupted flow



OTP provider is pluggable; early MVP may use a mock.

5. Saved Search Flow





After performing a search, user taps “Save Search”.



Optionally names the search.



Search is stored under the authenticated user.



From My Shekar tab:





User sees list of saved searches



Can re-run any saved search with one tap



Can edit or delete



(P1) System periodically checks for new matching ads and notifies the user.

6. Favorites Flow





On list or detail, user taps the favorite icon.



Ad is added to Favorites (requires auth).



From Favorites section (under My Shekar):





User sees all favorited ads with current score / status



Can remove or open detail



Favorites persist across sessions.

7. Bottom Navigation







Tab



Purpose





آگهی‌ها (Ads)



Main search & results list





شکار من (My Shekar)



Saved Searches + Favorites + recent activity





کشف بازار



(Future / light) insights, price trends





پروفایل (Profile)



Account, subscription status, settings

8. Subscription / Paywall (Structure)





User reaches a gated feature or sees upgrade prompt.



Shown current plan status (Free / Trial / Active / Expired).



Can start subscription (payment gateway deferred; structure ready).



After successful payment, status updates and gated features unlock.

9. Error & Edge Cases







Situation



Behavior





MCP rate limit



Friendly message + retry / cached results





No results



Clear empty state with suggestions to relax filters





Network offline



PWA shell + cached last results if available





OTP failure



Clear retry path





Invalid filters



Validation messages in Persian

10. Key Happy Path (Professional User)





Install / open Shekar



Login with mobile + OTP (or continue as guest then login)



Create a precise search with description keywords



Save the search



Browse ranked results, favorite interesting ads



Receive notifications when new matching ads appear



Decide to subscribe because time is being saved

