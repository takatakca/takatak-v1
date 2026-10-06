# TAKATAK Growth Suite

Status: **Phase 1 (catalog, SEO audit, request builder) + Phase 2 (reputation backend, AI credit ledger). The Phase 2 migration is awaiting owner approval for staging and production.** It adds the marketing layer on top of the existing modules: Domain → Hosting → Social → Marketing → AI.

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

## Next phase

1. Twilio/WhatsApp Cloud delivery for review requests, plus Google Business Profile review import.
2. First-party analytics events + retargeting audience lists.
3. Web chat widget + unified conversations inbox.
4. Stripe checkout for credit packs, calling `grantCredits` with `reason: "purchase"` from the webhook.

## QA

- `npm run qa:growth-suite` checks catalog integrity, that every route link resolves, that statuses stay presence-only, and the audit URL guard. It needs no database.
- `npm run qa:growth-backend` runs against a disposable migrated database. It covers the full review funnel, tenant isolation, single-use tokens, consent-only contact storage, credit idempotency, no overdraft under 8 concurrent debits, single refunds, and the database constraints.

Both run in CI.
