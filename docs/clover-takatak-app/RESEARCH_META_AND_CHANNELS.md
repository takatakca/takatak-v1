# Research: Meta (Facebook, Instagram, Threads) and other channels

Read on 2026-10-23. Research only. **Not legal advice.** **FACT** = what a dated source says. **INFERENCE** = our
reading for TAKATAK. **UNVERIFIED** = seen only in secondary sources; check before relying on it.

## Bottom line (INFERENCE)

- **Facebook Pages** is the channel closest to working: takatak-v1 already asks for `pages_manage_posts` at login. What
  is missing is the publishing code, Meta **App Review** (Advanced Access) for the publishing permissions, and Meta's
  **Access Verification as a Tech Provider** (business verification first).
- **Instagram** needs one more scope (`instagram_business_content_publish`), App Review, and publishing code. Instagram
  has no API for menus, hours or bio: it is a **posts-only** channel.
- **Pinterest** works only in "Trial" today: Pins created are visible only to their creator. Public Pins need
  **Standard access** (video demo, review with no fixed delay).
- **TikTok** posts from an unaudited app are private. An audit is needed before it is useful.
- **Apple, Bing, Yelp, TripAdvisor:** no confirmed self-serve write API for a small restaurant. Treat as manual or
  later partner programs (P2+).
- Meta's Platform Terms make TAKATAK a **Tech Provider** that processes each client's data only for that client,
  separately, with a public deletion process. This matches Clover's "one merchant, one app" rule.

## Facebook Pages

### Publishing posts

- **FACT.** Text posts: `POST /{page_id}/feed`; photos: `POST /{page_id}/photos`; video through the Video API. The app
  needs Facebook Login with `pages_manage_engagement`, `pages_manage_posts`, `pages_read_engagement`,
  `pages_read_user_engagement` (and `publish_video` for video), and receives a Page access token. "Your app user must be
  able to perform the `CREATE_CONTENT`, `MANAGE`, and `MODERATE` tasks on the Page." Scheduling: `published=false` with
  `scheduled_publish_time`; "The publish date must be between 10 minutes and 30 days from the time of the API request."
  Source: https://developers.facebook.com/docs/pages-api/posts (no date shown; examples use Graph API v26.0; read
  2026-10-23).
- **FACT (code).** `src/lib/social/providers/meta-oauth.ts` asks for `public_profile`, `pages_show_list`,
  `pages_read_engagement`, `pages_manage_posts`, `read_insights`. `src/lib/social/providers/meta-pages.ts` already
  checks "pages_manage_posts + CREATE_CONTENT task + Page token" before calling a Page publish-ready. No code sends a post.
- **INFERENCE.** Add `pages_manage_engagement` and `pages_read_user_engagement` only if the app replies to comments.
  For P1 (posts only), `pages_manage_posts` + `pages_read_engagement` + `pages_show_list` should be enough; confirm in
  App Review.

### Page info and hours

- **FACT.** With the MANAGE task, an app can `POST /{page_id}` with the fields to change (the guide's example is
  `about`); reading uses `?fields=about,...,hours,website`. Permission list includes `pages_manage_metadata`.
  Source: https://developers.facebook.com/docs/pages-api/manage-pages (read 2026-10-23).
- **UNVERIFIED.** Whether `hours` is writable and its exact key format (`mon_1_open`, …) — seen only in a third-party
  data dictionary. Check the Page reference before building.
- **INFERENCE.** Menu on Facebook = posts and photos with a link to Clover online ordering. No native "menu" API was
  found.

### App Review and access levels

- **FACT.** "App Review allows you to request approval for individual permissions and features." Unapproved permissions
  "can only be requested from app users who have a role on the requesting app." "Any requested permission or feature
  missing a screen recording will not be approved." "It typically takes us less than one week", often 2–3 days. If only
  people with a role on the app use it, App Review is not required.
  Source: https://developers.facebook.com/docs/app-review/introduction (read 2026-10-23).
- **INFERENCE.** For Clover merchants (who have no role on our Meta app), App Review with a screencast per permission is
  mandatory. TAKATAK's own restaurants can be tested earlier by giving their managers a role on the app.

### Access Verification (Tech Provider) and business verification

- **FACT.** "Access verification is the process we use to determine if a business operates as a Tech Provider."
  Required when an app used by other businesses needs permissions such as `ads_management`, `business_management` or
  `pages_manage_posts`. Without it, calls from users without a role on the app fail (error code 100). Prerequisites: a
  business admin completes **Business Verification**; no restrictions on the business account; the admin describes how
  the business uses other businesses' data. Decision "within approximately 5 days". "Access verification is independent
  of App Review and permission access levels."
  Source: https://developers.facebook.com/docs/development/release/access-verification (read 2026-10-23).
- **INFERENCE.** Two separate Meta steps: (1) Business Verification of the business chosen under decision D9 (lawyer
  question 16; for example Quadro Holdings Ltée) in Meta Business Manager (owner uploads company documents), then
  Access Verification as Tech Provider; (2) App Review per permission.
  Both before any Clover merchant can publish to Facebook.

## Instagram

- **FACT.** Content publishing with **Instagram Login**: token = Instagram User token; host `graph.instagram.com`;
  permissions `instagram_business_basic` + `instagram_business_content_publish`. With **Facebook Login for Business**:
  Page token; `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`. Access level: Advanced or
  Standard.
  - Media "hosted on a publicly accessible server at the time of the attempt"; "JPEG is the only image format supported".
  - Types: image, video, reels, carousel (up to 20 items), stories.
  - Endpoints: `POST /{ig_id}/media` (container) → `POST /{ig_id}/media_publish`; check status; `GET
    /{ig_id}/content_publishing_limit`.
  - Limit: "Instagram accounts are limited to 100 API-published posts within a 24-hour moving period" (the carousel
    section says 50 — the page does not reconcile the two).
  - "Shopping tags are not supported." "Filters are not supported." An `is_ai_generated` field exists (on the carousel
    container only, not on its children).
  - An account whose Page needs Page Publishing Authorization cannot be published to until it is done.
  Source: https://developers.facebook.com/docs/instagram-platform/content-publishing/ (no date shown; mentions a
  2025-03-24 change; read 2026-10-23).
- **FACT (code).** `src/lib/social/providers/instagram-oauth.ts` asks only `instagram_business_basic` and
  `instagram_business_manage_insights`. No publish scope; no publishing code.
- **INFERENCE.**
  - Add `instagram_business_content_publish` to the Instagram Login flow and pass App Review for it.
  - Convert images to JPEG and host them on a public URL (for example a public storage bucket) before publishing.
  - Use `is_ai_generated` when an image is AI-made (P3 policy: real dish photos only; AI images, if ever, labelled).
  - Respect a lower internal cap (for example 10 posts/day per account) far below Meta's limit.
  - Instagram has no API for bio, hours or menu: posts and reels only.

## Threads

- **FACT (Meta overview, via search).** "Threads profiles are limited to 250 API-published posts within a 24-hour moving
  period." Usage at `GET /{threads-user-id}/threads_publishing_limit`, which needs `threads_basic` and
  `threads_content_publish`. Source: https://developers.facebook.com/docs/threads/overview (seen through search
  results on 2026-10-23; page not loaded directly).
- **FACT (code).** A Threads connection exists in `src/lib/social/providers/registry.ts` (read only).
- **INFERENCE.** P2 channel: same App Review pattern as Instagram.

## Meta Platform Terms (obligations for an app that serves other businesses)

- **FACT.** Last updated 2026-02-03. Source: https://developers.facebook.com/terms/ (read 2026-10-23). Main points:
  - s.3.a: no discrimination, no eligibility decisions (housing, jobs, credit…), no selling, licensing or buying Platform
    Data, no building or augmenting user profiles without valid consent, processing only for permitted purposes.
  - s.3.c: share only in listed cases (law, Service Provider, user direction or consent).
  - s.3.d: delete data promptly on request, when no longer needed, when the product stops, when a user leaves; report
    data received in error.
  - s.4: public, non-geoblocked privacy policy in the App Dashboard, explaining what data is processed, why, and how to
    request deletion; "The right to request deletion must be available to all Users who can access your App."
  - s.5.a: written agreements with service providers, same obligations flowed down; delete on termination.
  - s.5.b (Tech Providers): process only on behalf of and at the direction of each Client, not for your own purposes;
    keep each Client's data separate; keep a Client list; tell Clients promptly about Meta communications on users'
    data requests.
  - s.6: industry-standard security; a way to report vulnerabilities; never collect Meta users' passwords; protect tokens
    and app secrets; report incidents "as soon as practicable".
  - s.7: Meta may audit once a year (more if a "Necessary Condition"), with at least 10 business days' notice; you pay if
    non-compliant; Meta may suspend or terminate.
- **INFERENCE.** TAKATAK's sub-processors (database host, app server, the AI gateway and each AI provider it uses) need
  written agreements that flow these
  terms down. No use of Meta data across clients (no "industry benchmarks" made from clients' Page data). The existing
  competitor sync (`src/lib/social/sync/*`) must be checked against s.3 before it is offered to Clover merchants.

## Data Protection Assessment and Data Use Checkup (yearly)

- **FACT.** "The Data Protection Assessment is a questionnaire that is an annual requirement for apps accessing certain
  types of data." An app admin has 60 days to complete it; "Providing incomplete or vague answers may result in loss of
  platform access." Notices arrive by email, in the Alert Inbox and on the App Dashboard. The questionnaire covers how
  Platform Data is used, shared and protected. The **Data Use Checkup** is separate: an annual process in which
  developers certify how each permission is used.
  Source: https://developers.facebook.com/docs/development/maintaining-data-access/data-protection-assessment (no date
  shown; read 2026-10-23).
- **INFERENCE.** Without these, Facebook and Instagram publishing could be cut off for every Clover merchant after
  launch. A named app admin watches the Alert Inbox; answers must match the privacy policy, the sub-processor list and
  agreements (including the AI providers, ARCHITECTURE §11) and Platform Terms s.5.b. See ROADMAP "Post-launch
  operations checklist".

## Data deletion callback

- **FACT.** "Developers need to specify either a data deletion callback instruction URL or a callback URL." The callback
  receives a `signed_request` (HMAC-SHA256 with the app secret; payload has `user_id`) and must answer
  `{ url: '<status url>', confirmation_code: '<code>' }`, over HTTPS.
  Source: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback (read
  2026-10-23).
- **FACT (code).** `src/app/data-deletion` gives instructions only; no `signed_request` handler exists in `src/`. The
  page's visible email text and its link target are two different addresses.
- **INFERENCE.** Instructions are enough to pass, but a callback is cleaner for a Tech Provider: build
  `/api/meta/data-deletion` (verify, queue deletion, return a status URL). Fix the address mismatch on the page.

## Pinterest

- **FACT.** Two tiers. Trial: "all Pins and Boards created with Trial access are only visible to their creator as
  Sandbox entities"; rate-limited per day per app. Standard: full functionality; per-minute, per-user, per-app limits.
  Upgrade: app already approved for Trial and compliant; a video demo that shows the OAuth flow and live Pinterest
  integration; app info with use case and privacy policy. Denials: missing auth flow, unapproved login methods, no live
  integration. Source: https://developers.pinterest.com/docs/key-concepts/access-tiers/ (read 2026-10-23).
- **UNVERIFIED.** Community posts report Standard upgrades pending for weeks; Pinterest says it has no exact turnaround.
- **FACT (code).** `src/lib/social/providers/pinterest-oauth.ts` asks `user_accounts:read`, `boards:read`, `pins:read`,
  `pins:write` (PR #221). No Pin creation code.
- **INFERENCE.** Pinterest is P2: build Pin creation (image + link to Clover online ordering), record the demo video, ask
  for Standard. Never list Pinterest in the Clover listing before Standard is granted.

## TikTok

- **FACT.** Direct Post needs the `video.publish` scope approved, the user's authorization, and a Query Creator Info call
  first. "All content posted by unaudited clients will be restricted to private viewing mode." An audit lifts it.
  Source: https://developers.tiktok.com/doc/content-posting-api-get-started (read 2026-10-23).
- **INFERENCE.** P2 or later; video-only; needs the audit and TikTok's own UX rules (creator chooses privacy, sees a
  preview).

## Apple Business Connect, Bing, Yelp, TripAdvisor

- **UNVERIFIED (secondary).** Apple Business Connect is free for businesses; an API exists for companies with 25+
  locations and for listing partners (named partners include Yext, SOCi, Uberall); a restaurant ordering company
  (Sauce) launched an integration in late 2025. Sources: https://restauranttechnologynews.com/2026/01/sauce-launches-apple-business-connect-integration-to-boost-restaurant-discovery-across-apple-apps/
  and secondary articles (read 2026-10-23).
- **Not found:** a self-serve write API for Bing Places or Yelp menus for a small restaurant.
- **INFERENCE.** P2: guided manual set-up (TAKATAK gives the merchant ready-to-paste text and photos), or a partner
  application later. Never promise these in the Clover listing until an API path is confirmed.

## Delivery marketplaces are out of scope

**INFERENCE + owner rules.** Uber Eats, DoorDash, Skip and others stay with TAKATAK Food Hub (its own Clover app, its own
data). The TAKATAK app does not push menus to delivery marketplaces, and posts made for Clover merchants link first to
the merchant's own Clover online ordering. Each delivery platform hears only about itself.

## Channel matrix (what is API, what is manual)

| Channel | Profile / info | Hours | Menu | Posts | Reviews | Status in takatak-v1 | Gate |
|---|---|---|---|---|---|---|---|
| Google Business Profile | API | API | API (structured) | API | API (reply) | OAuth + review import (simulated) | Google API access |
| Facebook Page | API (fields; `hours` UNVERIFIED) | UNVERIFIED | Posts/photos only | API | Comments (later) | OAuth live, no publishing | App Review + Tech Provider |
| Instagram | No API | No API | Posts only | API | — | OAuth live, no publish scope | Scope + App Review |
| Threads | No API | No API | Posts only | API | — | Connection, read only | App Review |
| Pinterest | — | — | Pins with link | API | — | OAuth live (#221), no Pins | Standard access |
| TikTok | — | — | Video only | API | — | Connection, read only | Audit |
| Apple Business Connect | Manual (API ≥25 locations / partners, UNVERIFIED) | Manual | Manual | Manual | — | None | Partner path |
| Bing Places, Yelp, TripAdvisor | Manual | Manual | Manual | — | — | None | Not found |
| Uber Eats, DoorDash, Skip | **Out of scope** (Food Hub) | | | | | | |

## Requirements (Meta and others)

1. Meta Business Verification, then Access Verification as Tech Provider (owner does the upload).
2. App Review with screencasts for: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`,
   `instagram_business_content_publish` (and any later permission).
3. Public privacy policy listed in each developer dashboard; deletion instructions (and a Meta deletion callback).
4. Per-client data separation; client list; written sub-processor agreements.
5. Publishing code per channel driven by the approved post; per-account caps far below platform limits.
6. Pinterest Standard access before listing Pinterest; TikTok audit before listing TikTok.
7. Meta Data Protection Assessment: completed within 60 days each time Meta requests it (annual); answers consistent with
   the privacy policy, sub-processor agreements and Platform Terms s.5.b.
8. Meta Data Use Checkup: each permission's use certified every year; an app admin watches the Alert Inbox.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Meta business or access verification refused or slow | High | Start now; documents in the legal entity's exact name. The Clover developer account is an Individual Developer account (kept by the owner), so "same name as the Clover developer account" cannot be met by a company: which entity is verified is lawyer question 16 / decision D9 |
| Data Protection Assessment or Data Use Checkup missed or answered vaguely; platform access lost for all merchants | High | Named app admin, Alert Inbox watched, answers kept consistent with the privacy policy and sub-processor list (ROADMAP post-launch checklist) |
| App Review rejects a permission (screencast unclear) | Medium | One clear screencast per permission, French UI with English captions, test user for the reviewer |
| Instagram publish fails on non-JPEG or private image URLs | Medium | Convert to JPEG; public, signed-and-expiring URLs; poll container status |
| Publishing to the wrong Page or account (multi-brand) | High | Brand → account mapping shown in the preview; approval step names the destination |
| Using Meta data across clients (benchmarks, competitor sync) | High | Review `src/lib/social/sync/*` against Platform Terms s.3 and s.5.b before exposing it to Clover merchants |
| Pinterest stays in Trial; Pins invisible | Medium | Do not promise Pinterest until Standard is granted |

## Open questions

1. Which legal entity is (or will be) the verified business in Meta Business Manager? Meta needs a business with
   documents in its exact legal name, while the Clover developer account is an Individual Developer account. How the
   Meta business, the EULA licensor and the Clover developer line up is lawyer question 16 (decision D9).
2. Is `hours` writable on a Facebook Page by API today, and in what format?
3. Should Instagram use Instagram Login (current code) or Facebook Login for Business (one Meta login for both Page and
   Instagram)? One login is simpler for merchants; the current code uses separate logins.
4. Will Meta accept AI-written captions with no extra label? (Meta labels relate to images, video and audio; text is not
   covered by the `is_ai_generated` field.) To check at App Review time.
5. Apple Business Connect: does a partner or API path exist for single-location restaurants in Canada?
