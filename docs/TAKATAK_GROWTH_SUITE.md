# TAKATAK Growth Suite

Status: **Phase 1, no database changes.** It adds the marketing layer on top of the existing modules: Domain → Hosting → Social → Marketing → AI.

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

## Next phase (needs approved Prisma migrations)

1. Review funnel backend: review requests, public rating page, private feedback, imported reviews.
2. First-party analytics events + retargeting audience lists.
3. AI credit ledger (balance, debits, Stripe top-ups) shared with the gateway.
4. Web chat widget + unified conversations inbox.

Each new migration must be added to the production and staging reconcile lists, with RLS, following the existing migration train.

## QA

`npm run qa:growth-suite` checks catalog integrity, that every route link resolves, that statuses stay presence-only, and the audit URL guard. It runs in CI.
