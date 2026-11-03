# Full product pages on takatak.ca

*Pages complètes des produits TAKATAK. Chaque produit de l'accueil mène à une vraie page détaillée, pas à un mini-site.*

| Product | Page on takatak.ca | Subdomain the owner asked for | State |
| --- | --- | --- | --- |
| SEO TAKATAK | `/seo` (`src/components/website/seo/SeoProductPage.tsx`) | `seo.takatak.ca` | page built |
| 10 core services | `/services/<slug>` (with "Voyez-le en action") | — | built |
| TAKATAK Food Hub | `/foodhub` (`src/components/website/foodhub/FoodHubPage.tsx`), facts from the `takatakca/foodhubca` README (RC10) | — | page built |
| Clover suite (9 apps) | `/clover` (`src/components/website/clover/CloverSuitePage.tsx`), facts from each app README and `foodhubca/docs/TAKATAK_SUITE.md` | — | page built |

## What `/seo` says, and where each fact comes from

- Live today: site audit (page, robots.txt, sitemap, score history, PDF), Core Web Vitals (PageSpeed), the free tools
  (`src/lib/seo/free-tools-catalog.ts`; `scripts/concierge-tests.ts` checks the "15 tools that work today" copy).
- Early access: the SEOTAKATAK service (`takatakca/SEOTAKATAK` README): DNS-verified sites, Search Console query import
  with an explained priority score, CSV/JSON exports, content briefs that a person approves, editorial link prospects
  (never bought), site deletion with a receipt, 60-second signed tokens per workspace.
- Needs a data source: keyword and map-pack positions, AI answer citations, Google index status.
- Prices: only the marketplace catalog starting prices (`local-seo-setup`, `gbp-optimization`, `citation-package`,
  `qmaps-listing-setup`).
- Never promised: first place on Google, bought links, invented numbers, text published without a person reading it.

## Owner step for `seo.takatak.ca`

The SEOTAKATAK API should stay on its own internal HTTPS address (`SEOTAKATAK_API_URL`). If `seo.takatak.ca` is free:
add the DNS record to the takatak.ca server, then in Coolify a permanent redirect (301) from `https://seo.takatak.ca/*`
to `https://takatak.ca/seo`. One page, one address for Google (the canonical is `/seo`).

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-01
