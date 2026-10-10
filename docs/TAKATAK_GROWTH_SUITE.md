# TAKATAK Growth Suite

Status: **Phases 1–3 built:**
- **Phase 1:** catalog, SEO audit, request builder.
- **Phase 2:** reputation backend, AI credit ledger.
- **Phase 3:** analytics, audiences, web chat.
- **Phase 4:** SMS/WhatsApp delivery, Stripe credit checkout, AI agent run queue.
- **Phase 5:** autopilot schedules, automatic triggers, review → lead.
- **Phase 6:** review showcase widget, Chat Concierge, Review Responder drafts, Core Web Vitals.
- **Phase 7:** GA4 and Search Console data, monthly growth report.
- **Phase 8:** Google Business Profile connect, review import, reply publishing.
- **Phase 9:** plan subscriptions (Stripe) and entitlements.

The Phase 2–9 migrations are awaiting owner approval for staging and production. It adds the marketing layer on top of the existing modules: Domain → Hosting → Social → Marketing → AI.

## Scope rule

The Social module (`src/app/dashboard/social`, `src/lib/social`) is **not modified**. Growth pages link to it, for example to the social inbox, but never re-implement or change it.

## Routes

| Route | What works today |
|---|---|
| `/dashboard/growth` | Journey map, connector readiness, module directory |
| `/dashboard/growth/connectors` | 31-connector catalog with presence-only status |
| `/dashboard/growth/analytics` | Live TAKATAK ADS totals for the active workspace + GA4/Search Console/pixel status |
| `/dashboard/growth/reviews` | Google review link builder + SMS/WhatsApp/email request templates (no API needed) |
| `/dashboard/growth/conversations` | WhatsApp click-to-chat button + embed snippet generator (no API needed) |
| `/dashboard/growth/ads-manager` | TAKATAK ADS live totals + Google/Meta/TikTok/Microsoft connector status |
| `/dashboard/growth/audiences` | Geo-targeting rules already live in TAKATAK ADS + retargeting audience plan |
| `/dashboard/growth/ai-engine` | 13-engine roster, AI Gateway status, agents, credit costs and packs |
| `/dashboard/growth/pricing` | Draft service catalog and bundle pricing (CAD) |
| `/dashboard/seo` | **Live site audit** (on-page, robots.txt, sitemap, score) |
| `/dashboard/seo/keywords`, `/backlinks` | Provider-gated (Search Console, Semrush, Ahrefs, DataForSEO) |

## Honesty rules (unchanged from the platform)

- Status is computed from env-var presence only: `built_in`, `configured_untested`, `not_configured` or `planned`. `connected` is never produced here.
- Env-var names are shown to platform operators only. Client users see states.
- No metric is estimated. Empty states stay empty until a provider returns real data.
- Prices in `src/lib/growth/plans.ts` and `src/lib/growth/ai-engine.ts` are **draft**. Nothing charges a card.

## Site audit safety

`src/lib/seo/site-audit.ts` accepts http/https only, rejects credentials and non-standard ports, and resolves DNS for every redirect hop, rejecting private, loopback, link-local, CGNAT and metadata ranges. It also enforces a 10 s timeout, a 4-redirect cap and a 1.5 MB size cap, and stores nothing. Residual risk: DNS rebinding between our lookup and fetch's lookup. Acceptable while the tool is behind dashboard authentication.

## AI Gateway contract

The dashboard never calls model providers. AI tasks go to the owner's gateway (`TAKATAK_AI_GATEWAY_URL` + `TAKATAK_AI_GATEWAY_TOKEN`). The gateway holds provider keys, routes to one of the 13 engines, applies approval gates and debits credits.

## Phase 2 — Reputation backend + AI credit ledger

Migration: `prisma/migrations/20261009010000_growth_reputation_and_ai_credits`. It adds:
- **Tables:** `review_profiles`, `review_requests`, `review_responses`, `ai_credit_accounts`, `ai_credit_entries`.
- **Permissions:** `view_reputation` and `manage_reputation`.
- **Database checks:** rating must be 1–5, balance must be ≥ 0, a ledger entry can't be 0.
- **Access:** RLS on every table, and all `anon`/`authenticated` grants revoked.

### Production approval gate

**Status (2026-10-09):** the owner approved all 9 Growth migrations for staging; they are in `APPROVED_DEPLOY_MIGRATIONS` in `scripts/reconcile-staging-migrations.mjs`. They are **not** yet in `scripts/reconcile-production-migrations.mjs`, whose list also still lacks the billing migrations: production database approval is a separate owner step. To ship:
1. Add it to the staging list.
2. Run the staging reconciler.
3. Verify.
4. Add it to the production list.

### Review funnel (Birdeye-style)

| Piece | Where |
|---|---|
| Review pages, tracked requests, feedback inbox | `/dashboard/growth/reviews` (needs a client workspace with `view_reputation`; writes need `manage_reputation`) |
| Public rating page (French first, English below) | `/r/<slug>` and `/r/<slug>?t=<token>` |
| Tracked redirect to Google/Facebook | `/r/<slug>/go?to=google&r=<responseId>`: the destination is built from the stored profile, never from input |

Rules enforced in code and tested:
- **Request tokens:** 24 random bytes. Only the SHA-256 hash is stored. Each token works once and expires after 30 days.
- **Customer contact details:** stored only when the customer ticks the consent box.
- **No review gating:** every rating, including low ones, is offered the public review link.
- **Spam protection:** a honeypot field, plus a per-IP limit of 8 submissions per 10 minutes. The IP is hashed and kept in memory only.
- **Tenant isolation:** every dashboard read and write is scoped by `activeClientId`.

Automatic SMS/WhatsApp sending is not wired. Staff send the tracked link from their own phone with one tap. Twilio and WhatsApp Cloud plug in later.

### AI Gateway credit API

Your AI backend calls this API, server to server, with `Authorization: Bearer $TAKATAK_AI_GATEWAY_TOKEN`. The token must be at least 32 characters, or the API answers 503.

| Call | Body / query | Result |
|---|---|---|
| `GET /api/ai/credits/balance` | `?clientId=` | `{ ok, balance }` |
| `POST /api/ai/credits/debit` | `{ clientId, actionKey, units?, idempotencyKey }` | 201 debited · 200 replay · 402 `insufficient_credits` · 409 `idempotency_conflict` |
| `POST /api/ai/credits/refund` | `{ clientId, debitIdempotencyKey, note? }` | Refunds that debit in full, at most once |

- The cost is always `AI_CREDIT_ACTIONS[actionKey].credits × units`, with units from 1 to 100. The caller cannot set a price.
- Use the task ID as the `idempotencyKey`, so retries are free.

Platform admins grant, sell or adjust credits on `/dashboard/growth/ai-engine`. Each form render carries a one-time key, so a double submit can't apply twice. Clients see their live balance and receipts on the same page.

### Ecosystem fit (from GitHub)

- **`takatakca/knowledgeAI`**, `projects/SOCIAL-CORE.md`: TAKATAK Social is native. Metricool is a benchmark only, so the catalog lists **TAKATAK Social** as the built-in social engine and Metricool as a legacy adapter.
- **`takatakca/takatak-automate`** (Render backend): runs the AI intake today through an external AI gateway. It is the natural home for the TAKATAK AI Gateway, which should call the credit API above before and after each task.
- **`knowledgeAI` `docs/08-INTEGRATION-STANDARDS.md`**: the provider checklist (official APIs, signed webhooks, idempotency, encrypted tokens) applies to every connector still marked "Not connected".

## Phase 3: First-party analytics, retargeting audiences, web chat

Migration: `prisma/migrations/20261009020000_growth_analytics_and_conversations`. It adds:
- **Tables:** `analytics_sites`, `analytics_events`, `analytics_audiences`, `chat_widgets`, `chat_conversations`, `chat_messages`.
- **Permissions:** `view_conversations` and `manage_conversations`.
- **Database checks:** message length, lookback range, accent colour format.
- **Access:** RLS on every table, browser-role grants revoked, and the event and chat tables added to the advisor's sensitive-table list.

It is approved for staging (2026-10-09), not yet for production.

### TAKATAK Analytics (cookie-free)

Install snippet (shown per site on `/dashboard/growth/analytics`):
`<script defer src="https://takatak.ca/takatak-analytics.js" data-site="tk_…"></script>`

What it records:
- **Page views:** includes single-page-app navigation.
- **Automatic conversions:** `call_click`, `email_click`, `whatsapp_click` and `form_submit`.
- **Custom events:** `window.takatak.track("name", { conversion: true })`.

Privacy and safety rules:
- **Visitor ID:** `HMAC(daily-salt, siteId|ip|userAgent)`. It resets every day, and raw IP addresses and user agents are never stored.
- **Opt-outs:** Global Privacy Control and Do Not Track are honoured, and bots are skipped.
- **Where data is accepted from:** only the site's own `https://domain` and `https://www.domain` origins, and the page URL must be on that host too.
- **No query strings stored:** query strings are dropped from paths, and only the UTM source, medium and campaign values are kept.
- **Country:** filled in only when a CDN geo header is present (Cloudflare, Vercel).
- Set `ANALYTICS_HASH_SECRET` (32+ chars) so visitor IDs stay consistent across server processes.

Dashboard: page views, daily unique visits, conversions, conversion rate (visits with at least one conversion, so never above 100%), a daily chart, top pages, traffic sources, campaigns, devices and countries, with a site and period filter.

**Retargeting audiences:** rules made of page-path prefixes and/or event names, plus a lookback window. Reach is the number of matching daily-unique visits. The audiences are listed on `/dashboard/growth/audiences`. Syncing them to Meta or Google turns on when those ad accounts are connected.

### TAKATAK Web Chat

Install snippet (shown per widget on `/dashboard/growth/conversations`):
`<script defer src="https://takatak.ca/takatak-chat.js" data-widget="tc_…"></script>`

The chat bubble:
- Renders inside a Shadow DOM.
- Inserts all text with `textContent` only.
- Switches to French or English from the page language.
- Uses the client's brand colour and can show a WhatsApp fallback button.

The visitor's random token lives in their browser's localStorage, and only its SHA-256 hash is stored. Visitors' send and poll requests are rate-limited.

Staff inbox:
- Open and closed tabs, unread counts, and a thread view that refreshes every 5 seconds.
- Reply, close or reopen a conversation.
- **Convert to lead** creates one `Lead` in the existing Leads module, exactly once.

## Phase 4: Automatic delivery, card checkout for credits, AI agent workforce

Migration: `prisma/migrations/20261009030000_growth_agents_and_delivery`. It adds:
- **New columns on `review_requests`:** `sentAt`, `deliveryStatus`, `providerMessageId` and `recipientMasked`.
- **New tables:** `ai_agent_settings` and `ai_agent_runs`.
- **Database checks and access:** RLS on both tables, browser grants revoked, and `ai_agent_runs` added to the advisor's sensitive-table list.

It is approved for staging (2026-10-09), not yet for production.

### Automatic review requests (SMS / WhatsApp)

On `/dashboard/growth/reviews`, a "Send it for me" option appears only when the channel is fully configured. The customer's number is used once to send and only a masked version (`•••0123`) is stored.

| Channel | Turns on when |
|---|---|
| SMS (Twilio) | `GROWTH_SMS_ENABLED=true`, plus `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, plus either `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_SMS_FROM` |
| WhatsApp Cloud | `GROWTH_WHATSAPP_ENABLED=true`, plus `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_REVIEW_TEMPLATE` (an approved template with {{1}} name, {{2}} business, {{3}} link) and `WHATSAPP_GRAPH_VERSION` (e.g. `v21.0`, set explicitly and never guessed). `WHATSAPP_TEMPLATE_LANGUAGE` is optional and defaults to `fr_CA`. |

SMS messages identify the business and include "Répondez STOP" (CASL). Confirm with counsel that review requests fit implied consent for each client's customer base.

### Buying AI credits by card (Stripe Checkout)

To turn it on, set `AI_CREDITS_CHECKOUT_ENABLED=true` and `STRIPE_SECRET_KEY`. Do this only after confirming the pack prices in `src/lib/growth/ai-engine.ts`.

- Clients who have `manage_settings` see **Buy** buttons on `/dashboard/growth/ai-engine`.
- Webhook: `POST /api/billing/ai-credits/webhook`, signed with `STRIPE_AI_CREDITS_WEBHOOK_SECRET`. In Stripe, subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Credits are granted only when the mode, payment status, currency (CAD), amount, pack, credit count and client all match the server catalog (`decideCreditGrant`).
- The grant uses `stripe:<sessionId>` as its idempotency key, so Stripe retries never double-credit.

### AI agent workforce (approval-gated)

Clients turn on agents, set standing instructions, press **Run now**, and approve or reject results on `/dashboard/growth/ai-engine`. The Ads Optimizer always requires approval.

Gateway API, called by your AI backend with bearer `TAKATAK_AI_GATEWAY_TOKEN`:

| Call | Result |
|---|---|
| `POST /api/ai/agents/claim` | 200 `{ run: { runId, clientId, agentKey, phase, input, output, instructions, requireApproval } }`, or 204 when there's nothing to do |
| `POST /api/ai/agents/runs/<runId>/report` | Body `{ succeeded, output?: { summary, preview, ... }, creditsDebited?, error? }` |

Run lifecycle:
1. `queued` → `running`, when the gateway claims it (phase `generate`).
2. → `awaiting_approval`, or `completed` if the client turned approval off.
3. → `approved`, when a human approves.
4. → `executing` (phase `execute`).
5. → `completed`.

Other rules:
- **Locking:** claims use `FOR UPDATE SKIP LOCKED`, so parallel workers never double-claim.
- **Crash recovery:** a run claimed for more than 30 minutes is re-queued.
- **Credits:** charge through `/api/ai/credits/debit` with the run ID as part of the idempotency key, then report the total in `creditsDebited`.

## Phase 5: Autopilot schedules, automatic triggers, review → lead

Migration: `prisma/migrations/20261009040000_growth_agent_schedules`. It is additive only:
- **`ai_agent_settings`:** new `schedule`, `scheduleWeekday`, `scheduleHour` and `lastScheduledFor` columns, an index, and range checks.
- **`review_responses`:** new `leadId` column.

It is approved for staging (2026-10-09), not yet for production.

### Autopilot

Each agent can run on a schedule: manual only, every day, or every week on a chosen day, at a chosen hour in **the client's own time zone** (`clients.timezone`). Daylight-saving changes are handled.

Schedule `/api/cron/growth-agents` every 15 minutes with `Authorization: Bearer $CRON_SECRET`, the same convention as the existing cron routes.
- A time slot is claimed before its run is queued, so overlapping cron ticks enqueue it once.
- Saving a schedule never fires a slot that already passed.

### Automatic triggers

Every new 1–3★ rating on a review page queues a **Review Responder** run, if that agent is enabled. The run carries `{ reviewResponseId, rating, feedback, businessName }` and allows up to 5 pending at once. A trigger failure never blocks the customer's rating from saving.

### Review follow-up → lead

When a customer ticked "contact me", **Create lead for follow-up** in the feedback inbox creates one Lead, exactly once. It is high priority for 1–2★ ratings, and it only works when the customer consented.

## Phase 6: Review showcase, AI that acts, Core Web Vitals

Migration: `prisma/migrations/20261009050000_growth_review_showcase` adds `review_responses.publishConsent` and `review_responses.hiddenFromShowcase`, plus an index. It is additive, approved for staging (2026-10-09), not yet for production.

### Review showcase (Birdeye-style widget)

On the rating page, customers who give 4–5★ can tick "show my comment and first name on the business's website".

Embed code (copied per review page in the dashboard):

```
<div data-takatak-reviews="<slug>" data-review-link="1"></div>
<script defer src="https://takatak.ca/takatak-reviews.js"></script>
```

Data comes from `GET /api/public/reviews?p=<slug>`, which is public, cached for 5 minutes and read-only.
- **The average covers every rating**, not only the featured ones.
- **Only consented 4–5★ comments are listed**, with the first name only and no contact details.
- **Owners can hide** any entry from the feedback inbox.

### Chat Concierge (AI answers website chat)

When the agent is on, each visitor message queues one run per conversation. The AI Gateway uses two endpoints:

| Call | Purpose |
|---|---|
| `GET /api/ai/chat/context?runId=` | Conversation history (last 30 messages), plus `canReply` |
| `POST /api/ai/chat/reply { runId, body }` | Posts an `ai` message |

Rules for replying:
- **Approval on (the default):** the reply is shown for approval first. Posting is only allowed in the execute phase, after a human approves.
- **Approval off:** the concierge replies in real time.
- **Locked to the run:** authority comes from the run itself (same agent, same client, same conversation), so the gateway can never post anywhere else.

### Review Responder drafts in the inbox

The run output `{ reply }` (or `preview`) shows up under the review it answers in `/dashboard/growth/reviews`, along with its approval status.

### Core Web Vitals

The SEO page runs Google PageSpeed Insights v5 for mobile or desktop: performance score, LCP, CLS, TBT, FCP and Speed Index, graded on Google's thresholds, plus the real-user category from the Chrome UX Report.
- It requires `PAGESPEED_API_KEY`, because the keyless shared quota is exhausted (verified: HTTP 429).

## Phase 7: Google Analytics 4, Search Console, monthly growth report

Migration: `prisma/migrations/20261009060000_growth_google_data_sources` adds `analytics_sites.ga4PropertyId` and `analytics_sites.searchConsoleProperty`, each with a format check. It is approved for staging (2026-10-09), not yet for production.

### Google data (official APIs, read-only)

- **One TAKATAK service account:** set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (a PEM key; escaped `\n` is fine). The app signs its own RS256 assertion and caches the token.
- **Per website:** under Analytics → Tracked websites → Google connections, paste the **GA4 property ID** and the **Search Console property** (`sc-domain:example.com` or `https://www.example.com/`).
  - The client first adds the service-account email as a Viewer in GA4 and as a user in Search Console. The email is shown in that form.
  - **Ownership check (security fix, migration `20261009090000_growth_site_domain_verification`).** Every workspace shares one service account, so an identifier alone proves nothing: without this, a workspace could link another business's `sc-domain:` or GA4 ID and read its data. Now:
    - each website has its own random verification token;
    - the owner publishes it as a DNS TXT record on the domain (`takatak-site-verification=<token>`) or a `<meta name="takatak-site-verification">` tag in the homepage `<head>`, then clicks **Verify ownership**. The page must be served from the domain itself or its `www.` alias after redirects, and the fetch uses the site-audit SSRF guard;
    - linking requires a verified domain. The Search Console property must be `sc-domain:<domain>` or a URL prefix on `<domain>` / `www.<domain>`. The GA4 property must have a web data stream on that domain, checked live with the Analytics Admin API (read-only scope);
    - a database CHECK refuses Google links on unverified sites. Reads ignore links on unverified sites and Search Console properties off the domain;
    - the migration clears any link made before this check existed.
- **Analytics page:** a GA4 card shows sessions, active users, page views and a daily chart for the selected period.
- **Keywords page:** real Google queries from Search Console (clicks, impressions, CTR, average position) for the last 28 days. Search Console data lags 2–3 days.
- **Errors are shown honestly:** a 403 tells the client to grant access to the service account. Nothing is ever estimated.

### Monthly growth report

`/dashboard/growth/report?month=YYYY-MM` (with a print/PDF version at `/growth-report`) covers:
- visits and page views, contact actions, leads;
- new ratings and average rating, public review clicks;
- chat conversations, AI tasks completed, TAKATAK ADS impressions and clicks.

Each number is compared with the previous month, and the page lists French highlights, top pages, traffic sources and contact actions. Months are calendar months (UTC), and visits are unique daily visitors who viewed a page.

## Phase 8: Google Business Profile (import Google reviews, publish replies)

Migration: `prisma/migrations/20261009070000_growth_google_business_profile` adds `google_business_connections`, `google_business_oauth_states`, `google_business_locations` and `external_reviews`. All four have RLS, browser grants revoked and value checks, and are on the advisor's sensitive list. It is approved for staging (2026-10-09), not yet for production.

### Setup

To turn it on, set:
- `GOOGLE_BUSINESS_PROFILE_ENABLED=true`
- `GOOGLE_BUSINESS_PROFILE_CLIENT_ID` and `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET` (a Google OAuth web client)
- `GROWTH_TOKEN_ENCRYPTION_KEY_V1` (32 random bytes)

In the OAuth client, register the redirect URI `https://<app>/api/integrations/google-business/callback`, or set `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`.

The Business Profile APIs require Google's access approval for the project.

### Flow

1. **Connect:** a workspace manager clicks **Connect Google Business Profile**.
   - OAuth 2.0 + PKCE (S256), scope `business.manage`, offline access.
   - The state is random, stored only as a hash, single-use, expires in 10 minutes, and is bound to the same user and workspace.
   - The PKCE verifier and refresh token are encrypted with AES-256-GCM, bound to the client and connection.
2. **Discovery:** accounts (Account Management v1) → locations (Business Information v1), stored as `accounts/{a}/locations/{l}`.
3. **Import:** `GET v4/{location}/reviews`, paginated (up to 5 × 50 per location per sync). Re-syncs are idempotent and only update changed reviews.
   - Triggered by **Sync now** or hourly via `/api/cron/growth-reviews-sync` (Bearer `CRON_SECRET`).
   - A new unanswered 1–3★ Google review queues the **Review Responder** (`source: "google"`).
4. **Reply:**
   - **Staff:** the AI draft is pre-filled in the reply box; edit it and click **Publish reply on Google** (`PUT v4/.../reviews/{id}/reply`).
   - **Gateway:** `POST /api/ai/reviews/reply { runId, comment }` publishes only in the execute phase (after approval), or immediately when approval is off. It works only for that run's Google review and client.
5. **Disconnect:** revokes the token at Google and destroys the local ciphertext.

## Phase 9: Plan subscriptions and entitlements

Migration: `prisma/migrations/20261009080000_growth_plan_subscriptions` adds:
- **`growth_subscriptions`:** one row per client and plan, separate from the Social `client_subscriptions`.
- **`growth_billing_events`:** Stripe event IDs, for idempotency.

Both have RLS and revoked grants. It is approved for staging (2026-10-09), not yet for production.

- **Subscribe:** `GROWTH_BILLING_ENABLED=true` plus `STRIPE_SECRET_KEY` turns on **Subscribe** buttons on Plans & Pricing (for clients with `manage_settings`). Checkout is a Stripe subscription, billed monthly in CAD with prices from the catalog; TAKATAK One is the bundle. **Manage billing** opens the Stripe customer portal.
- **Webhook:** `POST /api/billing/growth/webhook`, signed with `STRIPE_GROWTH_WEBHOOK_SECRET`. Subscribe it to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.paid`.
  - Each event ID is processed once; a failed apply forgets the ID so Stripe's retry can succeed.
  - Status follows Stripe: `past_due` keeps access during payment retries, `canceled` removes it.
  - **Included AI credits:** AI Autopilot adds 500 and TAKATAK One adds 1,000 on every paid subscription invoice, exactly once per invoice.
- **Entitlements:** set `GROWTH_ENTITLEMENTS_ENFORCED=true` to require plans. It stays off during the pilot, so everything is unlocked.

| Plan | Unlocks |
|---|---|
| Reputation Pro | Tracked/automatic review requests, Google Business Profile |
| Conversations | Website chat widgets |
| AI Autopilot | Agent runs, by every path: manual, schedule, chat and review triggers |
| Local SEO | Core Web Vitals tests, Google data links |
| Ads Manager | Retargeting audiences |
| TAKATAK One | Everything |

## Review fixes (2026-10-07)

A full code review of the branch found ten issues. Each was checked against the code, fixed, and covered by a test that fails on the old code (the widget fix was checked in a real browser).

- **Stripe billing:**
  - `invoice.paid` can arrive before the subscription is recorded. Included credits are now granted from the invoice's subscription snapshot. A Growth invoice that can't be attributed fails, so Stripe retries it.
  - A late event for an old subscription can no longer overwrite the plan's live subscription.
- **Web chat widget:** sending a message no longer skips a staff or AI reply that arrived just before.
- **Google reviews cron:** connections rotate by last attempt, so failing connections can't starve healthy ones.
- **WhatsApp:** a request with no name uses "à vous" / "there", because WhatsApp rejects empty template values.
- **Rate limits and visitor ids:** the client IP is taken from the trusted proxy's `X-Forwarded-For` entry, not the forgeable leftmost one. Set `TRUSTED_PROXY_HOPS` (default 1; 2 for Cloudflare in front of Traefik), or `CLIENT_IP_HEADER` (e.g. `cf-connecting-ip`). If no `X-Forwarded-For` is present, `X-Real-IP` is used, as before. **Before go-live, confirm on each host (MochaHost/Passenger, Vercel, Coolify)** which `X-Forwarded-For` the app actually receives; this could not be checked from the build environment.
- **AI agents:**
  - A run interrupted mid-action is marked failed (`execution_interrupted`) instead of being executed again, so a reply is never posted twice.
  - A `null` report output is stored as JSON null.
- **Reviews widget:** the count is a whole number from 1 to 12.
- **Schedules:** on the DST fall-back day, the repeated local hour fires once.

## Waiting on outside approvals

These need provider access that only the owner can request:
1. **Google Business Profile API access** (Google approval for the Cloud project); the integration is fully built and tested against a simulated Google.
2. **Syncing retargeting audiences** to Meta and Google Ads (ad-account OAuth and app review).
3. **Google service account** for GA4 and Search Console (create it in Google Cloud; each client then grants it access).

## Going back

See [GROWTH_SUITE_ROLLBACK.md](GROWTH_SUITE_ROLLBACK.md): feature switches, per-phase commits to revert, and a verified script that returns the database to `main`'s schema (`scripts/rollback/growth-suite-down.sql`).

## QA

- `npm run qa:growth-suite` checks catalog integrity, that every route link resolves, that statuses stay presence-only, and the audit URL guard. It needs no database.
- `npm run qa:growth-backend` runs against a disposable migrated database. It covers:
  - the full review funnel, single-use tokens and consent-only contact storage;
  - credit idempotency, no overdraft under 8 concurrent debits, and single refunds;
  - analytics origin locking, bot and GPC skipping, no stored IPs, daily-rotating visitor IDs, accurate summaries and audience reach;
  - chat domain locking, hashed tokens, live staff replies, closed threads and one-time lead conversion;
  - masked delivery records, card purchases credited exactly once, and the agent queue (no double-claims under 5 parallel workers, the approval gate, crash recovery, cancel);
  - autopilot (once per slot under overlapping cron ticks, in the client's time zone), low-rating triggers, and consent-only review → lead;
  - the showcase (honest average, consent and first name only, owner hide) and the Chat Concierge approval gate and tenant lock;
  - exact monthly report numbers with month boundaries, and tenant-scoped Google links;
  - the complete Google Business Profile flow against a simulated Google: PKCE verification, state attacks (wrong user, wrong workspace, replay, expiry), encrypted tokens, paginated idempotent import, approval-gated publishing, revoke;
  - the subscription lifecycle (activation, duplicate events, past_due/canceled), included credits exactly once per invoice, and enforced entitlements per workspace;
  - tenant isolation for all of the above, and the database constraints.

Both run in CI.
