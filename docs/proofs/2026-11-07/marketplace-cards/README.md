# Marketplace and /seo cards on the real catalog (2026-11-07)

## What was wrong

The cards on `/marketplace` (hero, "Popular services", "Featured services") and on `/seo` read the demo catalog
`src/lib/website/marketplace-packages.ts`. The package page `/marketplace/gigs/[id]`, the search and the category pages
read the real catalog `src/lib/website/marketplace-catalog.ts`, with prices from the database catalog.

- 7 cards linked to packages that do not exist in the real catalog, so the link answered 404, in production too:
  `local-seo-setup`, `gbp-optimization`, `citation-package`, `qmaps-listing-setup`, `app-ui-prototype`,
  `ecommerce-shopify`, `ai-chatbot-setup`.
- 4 "from" prices on the cards differed from the package page: data entry 49 $ vs 20 $, menu 89 $ vs 45 $,
  flyer 49 $ vs 30 $, automation 249 $ vs 399 $.

## Fix

- `loadMarketplaceCards()` (server only) takes the real catalog and applies the database prices, exactly like the
  package page. `/marketplace` and `/seo` pass these cards to the client components.
- Card ids now point at real packages (`local-seo`, `mobile-app-prototype`, `ecommerce-store`, `ai-assistant`; `/seo`
  shows `local-seo`, `content-writing`, `website-redesign`).
- 14 real packages had no French title; they now have one, and `scripts/concierge-tests.ts` checks the real catalog too.
- The header category rail still reads the demo catalog: the header is not touched without the owner.

## Checks (local dev server, French)

- Every internal link on `/marketplace` and `/seo` (59) answers 200.
- `price-check.js`: each of the 15 cards opens its package page with status 200, and the card's "from" price equals the
  cheapest tier on the page: 0 mismatches.
- axe-core WCAG A/AA on `/marketplace` and `/seo`, desktop and phone: no violation.
- `tsc`, ESLint, `qa:concierge`, `qa:website-seo`, `qa:seo-free-tools`, `qa:website-theme`: pass.

Screenshots: `marketplace-fr-desktop.png`, `seo-fr-desktop.png`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 16:54 UTC
