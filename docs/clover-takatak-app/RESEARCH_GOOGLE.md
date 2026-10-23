# Research: Google Business Profile for the TAKATAK Clover app

Read on 2026-10-23. Research only. **Not legal advice.** **FACT** = what a dated source says. **INFERENCE** = our
reading for TAKATAK.

## Bottom line (INFERENCE)

Google's rules allow the plan if four things hold:

1. **TAKATAK is a third-party manager, never the owner.** Each restaurant stays the owner of its Business Profile and
   invites TAKATAK's organization as Manager, with written or digital consent kept as proof.
2. **TAKATAK has Business Profile API access** for one Google Cloud project (an application to Google; still pending).
3. **TAKATAK passes OAuth verification** for the `business.manage` scope.
4. **The product follows** the Business Profile API policies, the third-party (agency) policies and the review policies.

The owner's idea "take other people's businesses" only works **opt-in**: no claiming profiles without consent, no
prospecting through the API, no lead generation.

## What the APIs can do for a restaurant

| Need | API (version) | Notes |
|---|---|---|
| Name, address, phone, website, description, open/closed status | Business Information v1 | Name must be the real-world name; no taglines |
| Regular, special and "more" hours | Business Information v1 | `specialHours` needs `regularHours` |
| Structured food menu | v4 `getFoodMenus` / `updateFoodMenus` | Only where `canHaveFoodMenus` is true; each item needs name, price, currency |
| Photos and videos | v4 `media` | Byte upload for location media; post media from a URL |
| Posts | v4 `localPosts` | EVENT, OFFER, or posts with a button (ORDER, BOOK, SHOP, LEARN_MORE, SIGN_UP, CALL); no product posts by API |
| Reviews: list and reply | v4 reviews | Reply needs the client's authorization |
| "Order online" button | Place Actions v1 `placeActionLinks` | `FOOD_ORDERING`, `FOOD_TAKEOUT`, `FOOD_DELIVERY`; provider `MERCHANT` covers the business or an agency acting for it |
| Verification | Verifications API | Only when the owner asks for it |
| Questions and answers | — | Q&A API discontinued 2025-11-03 |

**INFERENCE.** TAKATAK can point the restaurant's "Order online" button to the restaurant's own Clover online ordering
page as a `MERCHANT` link. This fits the owner's no-aggregator rule and Clover's "do not promote competing ordering"
rule.

## Sources and findings

### 1. API access: eligibility and request

- **FACT.** Applicants manage a verified Business Profile active for 60+ days (their own or a client's), have a Google
  Cloud project, an Organization account and a website listed on the profile. Access is requested through Google's
  contact form ("Application for Basic API Access") with the project number, from an email that is owner or manager of
  that profile. Quota 0 QPM = not approved; 300 QPM = approved. No rejection reasons listed.
  Source: https://developers.google.com/my-business/content/prereqs (page updated 2026-08-28; read 2026-10-23).
- **INFERENCE.** This is the gate for everything. Apply once for the takatak-v1 Cloud project. A takatak.ca profile (or a
  managed client profile) must be verified and 60+ days old, with takatak.ca on it. takatak-v1
  `docs/TAKATAK_GROWTH_SUITE.md` already lists this approval as the outstanding blocker.

### 2. APIs to enable and OAuth scope

- **FACT.** Seven APIs: Google My Business API (v4), Account Management, Lodging, Place Actions, Notifications,
  Verifications, Business Information. v4 only appears in the Cloud console after approval. Scope:
  `https://www.googleapis.com/auth/business.manage`. Google Workspace accounts need Business Profile turned on (else
  403). Source: https://developers.google.com/my-business/content/basic-setup (updated 2026-08-28; read 2026-10-23).
- **FACT (code).** takatak-v1 already uses this scope: `src/lib/integrations/google-business/service.ts` and
  `src/lib/social/providers/google-oauth.ts`.

### 3. Agency organization account

- **FACT.** Agencies sign up at business.google.com/agencysignup with an email on the agency's own domain. One
  organization per company. The organization cannot directly own a profile; it manages a location only after the
  location grants permission. A user who already directly owns or manages locations cannot be added to an organization.
  Google recommends one organization for all profile groups.
  Sources: https://support.google.com/business/answer/7663063 ; https://support.google.com/business/answer/9199701 ;
  https://support.google.com/business/answer/7655842 (read 2026-10-23).
- **INFERENCE.** Create one Quadro Holdings / TAKATAK organization with a Google account on the takatak.ca domain, not
  the account that owns TAKATAK's own restaurant profiles. Each Clover merchant invites TAKATAK as Manager.

### 4. Third-party (agency) policies

- **FACT.** Applies to agencies and online-ordering providers. Rules:
  - the client keeps ownership or co-ownership at all times; for a new profile the business is owner, the third party
    manager;
  - express consent (verbal is not enough; written or digital proof if disputed); explicit approval before replying to
    reviews;
  - tell clients that Business Profile is free; disclose fees in writing before management starts and on invoices; no
    sudden fee hikes;
  - third parties serving small businesses link Google's "Working with a third party" notice in an easy-to-find place
    and tell clients at onboarding or renewal;
  - clients can disconnect and regain exclusive control within 7 business days;
  - reports keep each client's data separate; no comparing or sharing one client's data with others;
  - prohibited: guaranteeing top placement, implying Google affiliation, holding profiles hostage, pressure tactics,
    auto-discarding Google's suggested edits without asking the merchant (can reduce API quota);
  - violations can lead to suspension or a permanent ban from managing profiles.
  Source: https://support.google.com/business/answer/7353941 (read 2026-10-23).
- **INFERENCE.** Before go-live the app needs: a stored consent step, a "Business Profile is free" notice, the fee on
  invoices (Clover billing statement), the Google notice linked in the takatak.ca footer, a one-click disconnect flow,
  and per-client reports.

### 5. Business Profile API policies (developer)

- **FACT.**
  - Use the APIs only for listings you own or are authorized to manage.
  - Automated or triggered actions (review replies, listing creation or edits) need the user's prior, specific and
    express consent.
  - Account changes (such as adding a manager) are notified to the client within 48 hours, separately from Google's
    notices.
  - Content may be stored only in limited amounts for performance, for no more than 30 calendar days, securely, and it
    "cannot be manipulated or aggregated in any way".
  - The GoogleLocations endpoint is only for merchants you already have a relationship with; lead generation is
    prohibited.
  - Verification only on the owner's direct request.
  - No indirect access to your project; agencies or end-clients doing programmatic use need their own project; you
    cannot require end-clients to apply for their own project.
  - Do not mimic the Business Profile UI or imply Google endorsement.
  - Provide a live demo within 7 days if Google asks. Google may disable the project.
  Source: https://developers.google.com/my-business/content/policies (updated 2026-08-28; read 2026-10-23).
- **INFERENCE.**
  - "Take other businesses' listings" = only with each business's consent.
  - The Master API (`/api/v1`) must never expose Business Profile functions to outside companies.
  - Every scheduled or AI action on a profile (post, hours change, menu push, auto-reply) needs a per-merchant opt-in.
  - Copies of reviews and insights must expire within 30 days.

### 6. Usage limits

- **FACT.** Business Information: 300 QPM; Create Location 300/day; SearchGoogleLocation 300/day; Update Location
  10,000/day; **10 edits per minute per location, cannot be raised**. Other APIs 300 QPM each. A 0 quota means apply for
  access. Source: https://developers.google.com/my-business/content/limits (updated 2026-08-28; read 2026-10-23).
- **INFERENCE.** Clover → Google sync needs a queue with a limit per location (≤10 edits/min) and per project (300 QPM),
  pushing only what changed.

### 7. Food menus by API

- **FACT.** Check `canHaveFoodMenus` first ("Not all locations are eligible"). Then `getFoodMenus`, change, and `PATCH
  updateFoodMenus` (v4). **Without an `updateMask` the call replaces the whole menu.** Menus → sections → items; each
  item needs name, price and currency. Optional: description, nutrition, people served, portion size, preparation,
  cuisines, spiciness, allergens, dietary restrictions, options, photos (by `mediaKey`; not cover or profile photos).
  Sources: https://developers.google.com/my-business/content/update-food-menus (updated 2026-10-09) ;
  https://developers.google.com/my-business/reference/rest/v4/accounts.locations/updateFoodMenus (read 2026-10-23).
- **INFERENCE.** Clover maps cleanly: categories → sections, items → items (price in cents → Money in CAD), modifier
  groups → options or notes. Always read first and send an `updateMask`. Allergen and dietary fields only from data the
  merchant entered, never invented by AI. takatak-v1 `BusinessLocation` has no menu, hours or photo fields yet.

### 8. Menu editor after an API push

- **FACT.** A business whose menu comes from the API may lose the menu editor in Business Profile and Search.
  Multi-location menu updates must use the API. Changes can take 24–48 hours to show. Owners can also upload menu photos
  or a PDF. Source: https://support.google.com/business/answer/9455840 (read 2026-10-23).
- **INFERENCE.** After the first push, TAKATAK (fed by Clover) becomes the menu's source of truth on Google. Say so in
  the consent step. Show a "publishing, 24–48 h" state. On disconnect, explain how the owner gets editing back.

### 9. Location info and hours

- **FACT.** Business Information v1: `title` is the real-world name (no taglines, store codes, hours, phones, URLs).
  `primaryPhone` required; phone numbers and categories sent as complete sets on update. `specialHours` needs
  `regularHours`. `moreHours` uses type IDs from the categories endpoint. `profile.description` required. `openInfo.status`
  = OPEN, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY. Read-only metadata includes `canHaveFoodMenus`, `canOperateLocalPost`,
  `hasVoiceOfMerchant`, `hasPendingEdits`. Source:
  https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations (page updated
  2024-10-16; read 2026-10-23).
- **INFERENCE.** Clover opening hours → `regularHours`; holiday closures → `specialHours`. Read metadata before offering
  menus or posts. The AI never writes into `title`.

### 10. Guidelines for representing a business (names, hours, several brands at one address)

- **FACT.** Real-world name only. One profile per location. No promotions, prices or links in the description. Real
  customer-facing hours; 24-hour hours only when true. No combined names such as "Brand A / Brand B". Co-located food
  brands offering pick-up need permanent separate signage and show the address only if pick-up is offered to all
  customers. Delivery-only food brands need distinct branded packaging and website, set service areas, hide the address,
  and face extra verification when several share a location. Penalties: changes, removal or suspension.
  Source: https://support.google.com/business/answer/3038177 (read 2026-10-23).
- **INFERENCE.** Important for TAKATAK's own brands (real restaurants with brands split from one master menu) and for any
  Clover merchant with several brands. Each brand profile must match its real signage and pick-up setup. The owner's
  rule "never 24h" matches Google's rule. AI-written descriptions must not keyword-stuff.

### 11. Local posts

- **FACT.** Create, edit (PATCH with `updateMask`) and delete at `accounts/{a}/locations/{l}/localPosts` (v4). EVENT,
  OFFER (coupon, redemption URL, terms) and button posts. Buttons: BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL. No product
  posts by API. Posts with unverified phone numbers, emails or social handles may be removed; use the CALL button.
  Sources: https://developers.google.com/my-business/content/posts-data (updated 2026-08-28) ;
  https://support.google.com/business/answer/7213077 (read 2026-10-23).
- **INFERENCE.** The takatak-v1 status machine (`src/lib/social/status.ts`) can drive Google posts. Button ORDER → the
  merchant's Clover ordering page. Strip phone numbers, emails and handles from post text. Check `canOperateLocalPost`.

### 12. Photos and media

- **FACT.** Upload via `accounts/{a}/locations/{l}/media` from a `sourceUrl` or as bytes (startUpload → upload → create
  with `dataRef`); byte upload only for location media, post media from a URL. Photos: JPG or PNG, 10 KB–5 MB, 720×720
  recommended (min 250×250), minimal editing, should represent reality. Video: ≤30 s, ≤75 MB, 720p+.
  Sources: https://developers.google.com/my-business/content/upload-photos (updated 2026-08-28) ;
  https://support.google.com/business/answer/6103862 (read 2026-10-23).
- **INFERENCE.** Validate size, format and resolution before upload. Host post images on a public URL. Never post
  AI-generated food images as if they were real dishes.

### 13. Reviews: API and reply rules

- **FACT.** v4: list, get, `batchGetReviews`, `updateReply`, delete reply. API policies: client authorization before
  replying; prior specific express consent for automated replies.
  Sources: https://developers.google.com/my-business/content/review-data (updated 2026-08-28) ;
  https://developers.google.com/my-business/content/policies (read 2026-10-23).
- **INFERENCE.** The Growth Suite reply flow is already approval-gated: keep it. The AI low-rating responder stays
  draft-only unless the merchant opts in to auto-replies, recorded.

### 14. Asking customers for reviews (no gating)

- **FACT.** Reviews must reflect real experiences. No paid or incentivized reviews (including to change or remove one), no
  conflict-of-interest reviews. Merchants may not selectively solicit positive reviews, discourage negative ones, require
  reviews on site or set staff quotas. Source: https://support.google.com/contributionpolicy/answer/7400114 (read
  2026-10-23).
- **FACT (code, takatak-v1 origin/main `4c308b4`).** `src/components/reputation/public-rating-form.tsx` asks for a 1–5
  rating first, then shows "A public review would really help a local business." only when the rating is 4 or more; lower
  ratings see "The team will read your message personally." The Google button is shown for every rating.
- **INFERENCE.** The different wording is a soft form of review gating. Fix before any Clover merchant uses it: the same
  invitation for every customer, with the Google link offered before or independent of the private rating.

### 15. Stored Google reviews vs the 30-day cap

- **FACT (code, origin/main `4c308b4`).** `src/lib/integrations/google-business/service.ts` imports Google reviews into
  `prisma.externalReview` (model `ExternalReview` in `prisma/schema.prisma`). No delete or purge of `ExternalReview`
  exists in `src/`. The Growth Suite was tested only against a simulated Google.
- **INFERENCE.** Kept indefinitely, this conflicts with the 30-day content cap in the API policies. Before production API
  access: add a purge or refresh job (delete or re-fetch Google-sourced rows older than 30 days) and do not aggregate them
  across clients.

### 16. Ordering inside Google

- **FACT (research summary, 2026-10-23).** Google's checkout inside Search has been replaced by redirect links. Becoming
  an Actions Center ordering partner is a separate path for ordering platforms (about 6–8 weeks) and is not needed to
  start. Place Actions reference: https://developers.google.com/my-business/reference/placeactions/rest/v1/locations.placeActionLinks
  (localized copies read 2026-10-23; the English page was not loaded).
- **INFERENCE.** P1 uses a `MERCHANT` "Order online" link to Clover online ordering. No Actions Center work.

### 17. Merchant Center local inventory

- **INFERENCE.** Local inventory in Merchant Center is for retail products, not restaurant menus. It matters only for a
  later ON2GO retail product, not for this app.

## Requirements (Google)

1. Business Profile API access granted for the takatak-v1 Cloud project (300 QPM visible).
2. OAuth consent screen verified for `business.manage`; privacy policy with Google API Services User Data Policy
   ("Limited Use") — takatak.ca/privacy already has a Limited Use section.
3. One agency organization on the takatak.ca domain; each merchant invites it as Manager; consent stored.
4. Notices: "Business Profile is free", fee disclosure, link to Google's third-party notice, 48-hour change notice,
   7-business-day disconnect.
5. Per-location queue (≤10 edits/min), read-before-write, `updateMask` everywhere.
6. 30-day expiry for stored Google content; no cross-client aggregation.
7. No review gating; no auto-replies without opt-in.
8. Never claim Google partnership or guaranteed ranking; do not copy the Business Profile UI.
9. Brand profiles match real signage and pick-up; real hours only.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| API access refused or slow; nothing works without it | Blocker | Apply now with a 60+ day verified profile and takatak.ca website; Facebook can be the first live channel if Google is late |
| Menu wiped by an `updateFoodMenus` call without `updateMask` | High | Read first; always send a mask; test against a real test location; keep the previous menu for rollback |
| Merchant loses Google's menu editor after first push and is surprised | Medium | Explain in the consent step; show how to regain control on disconnect |
| Suspension for multi-brand profiles that do not match Google's rules | High | Brand-by-brand check of signage and pick-up before connecting; never publish "virtual" or combined names |
| Stored reviews beyond 30 days | Medium | Purge job before production access |
| Review gating in the public rating form | Medium | Same invitation for every rating |
| Auto-actions without consent (posts, replies, hours) | High | Per-merchant opt-in, recorded in the consent table |
| Implying Google partnership in the Clover listing | Medium | Wording rules in [MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md) |

## Open questions

1. Has Google answered the Business Profile API access request? Which Cloud project and which profile were used?
2. Which Google account will hold the agency organization (must be on the takatak.ca domain and must not already own
   locations)?
3. For each of TAKATAK's own brands: is there permanent separate signage and pick-up for all customers? (Decides whether
   each brand can have its own profile with an address.)
4. Does Google accept a `MERCHANT` Place Action link pointing to the merchant's Clover online ordering page for every
   restaurant category we serve? (Category limits are reported but not confirmed.)
5. Will the Growth Suite (Google reviews) and the TAKATAK Clover app share one Google OAuth client, or use separate
   ones? One client is simpler; the consent text must cover both uses.
