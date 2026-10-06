# TAKATAK Growth Suite

Status: **Phases 1–3 built:**
- **Phase 1:** catalog, SEO audit, request builder.
- **Phase 2:** reputation backend, AI credit ledger.
- **Phase 3:** analytics, audiences, web chat.
- **Phase 4:** SMS/WhatsApp delivery, Stripe credit checkout, AI agent run queue.

The Phase 2–4 migrations are awaiting owner approval for staging and production. It adds the marketing layer on top of the existing modules: Domain → Hosting → Social → Marketing → AI.

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

Migration: `prisma/migrations/20261006120000_growth_reputation_and_ai_credits`. It adds:
- **Tables:** `review_profiles`, `review_requests`, `review_responses`, `ai_credit_accounts`, `ai_credit_entries`.
- **Permissions:** `view_reputation` and `manage_reputation`.
- **Database checks:** rating must be 1–5, balance must be ≥ 0, a ledger entry can't be 0.
- **Access:** RLS on every table, and all `anon`/`authenticated` grants revoked.

### Production approval gate

The migration is **not** in `APPROVED_DEPLOY_MIGRATIONS` in `scripts/reconcile-staging-migrations.mjs` or `scripts/reconcile-production-migrations.mjs`. That is deliberate: until the owner adds it to both lists, the reconcilers report it as unexpected-pending and refuse to deploy. To ship:
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

Migration: `prisma/migrations/20261006150000_growth_analytics_and_conversations`. It adds:
- **Tables:** `analytics_sites`, `analytics_events`, `analytics_audiences`, `chat_widgets`, `chat_conversations`, `chat_messages`.
- **Permissions:** `view_conversations` and `manage_conversations`.
- **Database checks:** message length, lookback range, accent colour format.
- **Access:** RLS on every table, browser-role grants revoked, and the event and chat tables added to the advisor's sensitive-table list.

Like Phase 2, it is **not** in the approved deploy lists yet.

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

Migration: `prisma/migrations/20261006180000_growth_agents_and_delivery`. It adds:
- **New columns on `review_requests`:** `sentAt`, `deliveryStatus`, `providerMessageId` and `recipientMasked`.
- **New tables:** `ai_agent_settings` and `ai_agent_runs`.
- **Database checks and access:** RLS on both tables, browser grants revoked, and `ai_agent_runs` added to the advisor's sensitive-table list.

It is **not** in the approved deploy lists yet.

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

## Next phase

1. Google Business Profile review import and AI reply posting (needs Google API access approval).
2. Syncing retargeting audiences to Meta and Google Ads (needs ad-account OAuth).
3. Scheduled triggers for agents (weekly autopilot) through the existing cron routes.

## QA

- `npm run qa:growth-suite` checks catalog integrity, that every route link resolves, that statuses stay presence-only, and the audit URL guard. It needs no database.
- `npm run qa:growth-backend` runs against a disposable migrated database. It covers:
  - the full review funnel, single-use tokens and consent-only contact storage;
  - credit idempotency, no overdraft under 8 concurrent debits, and single refunds;
  - analytics origin locking, bot and GPC skipping, no stored IPs, daily-rotating visitor IDs, accurate summaries and audience reach;
  - chat domain locking, hashed tokens, live staff replies, closed threads and one-time lead conversion;
  - masked delivery records, card purchases credited exactly once, and the agent queue (no double-claims under 5 parallel workers, the approval gate, crash recovery, cancel);
  - tenant isolation for all of the above, and the database constraints.

Both run in CI.
