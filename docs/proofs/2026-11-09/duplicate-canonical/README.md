# Search Console: "Duplicate, Google chose different canonical than user" (2026-11-09)

Google Search Console sent this alert for takatak.ca on 2026-11-09 at 08:12 UTC (seen in the agents' Drive journal; the
email went to takatak.ca@gmail.com, which this session cannot read, so the exact URL in the alert is not known here).

## What was found (local production build of `main` 96cd734d)

Every page in the sitemap was compared with every other one (shared 3-word sequences in the page's main text):

| Pair | Likeness | Both declare themselves canonical | Both in the sitemap |
|---|---|---|---|
| `/hosting` ↔ `/services/hosting` | 100 % (same page) | yes | yes |
| `/domain` ↔ `/services/domains` | 100 % (same page) | yes | yes |
| next pair (`/marketplace/search` ↔ `/search`) | 74 % | — | — |

`/services/[slug]` renders the same core-category sales page as `/domain` and `/hosting`, with its own canonical. Google
sees two addresses for one page, each saying it is the original: that is this alert.

Also checked and fine: `/` and `/?lang=fr` (each its own canonical, reciprocal hreflang, French served in the HTML);
`/?lang=en` points to `/`; `/privacy-policy` and `/terms-of-service` already redirect to `/privacy` and `/terms`; the
French homepage does not link inner pages with `?lang=fr`.

## Fix

| Where | Change |
|---|---|
| `next.config.ts` | `/services/domains` → `/domain` and `/services/hosting` → `/hosting`, permanent (308); `?lang=fr` is kept |
| `src/app/sitemap.ts` | The two addresses are no longer listed (83 URLs, none twice) |
| `src/lib/website/service-pages.ts` | Their `route` is `/domain` and `/hosting`, so the `/services` page links there directly |
| `src/lib/website/transformation-stages.ts` | "Business email" links to `/hosting` directly |
| `scripts/verify-website-seo.ts` | New check: aliases redirect permanently, are not in the sitemap, and no address is listed twice |

Checked on the build: `/services/domains` 308 → `/domain`, `/services/hosting?lang=fr` 308 → `/hosting?lang=fr`,
`/services/websites` 200; the sitemap has no `/services/domains` or `/services/hosting`; `/services` links `/domain` and
`/hosting`; the duplicate scan finds no identical pair left. `qa:website-seo` 12/12, `tsc --noEmit` clean, build passes.

## Left for the owner / the SEO agent

- Once deployed: in Search Console, open the alert, then **Validate fix** on the URL it names. If the URL is not one of
  these two, send it to the site agent.
- `/marketplace/search` and `/search` share 74 % of their text. `/search` (the top search) is not touched by this agent.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-09 09:56 UTC
