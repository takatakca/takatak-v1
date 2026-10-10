# takatak.ca SEO and HTTPS fixes (TK-015, TK-016)

The TAKATAK SEO audit engine scored takatak.ca **79/100** on 2026-10-06. This branch fixes every finding the application can fix.

| Finding (live site) | Fix |
| --- | --- |
| `http://takatak.ca` answers 200 instead of redirecting | `src/proxy.ts` sends plain-HTTP visits to HTTPS (308, path and query kept) |
| Homepage title is 76 characters | Homepage title is now "TAKATAK — Websites, domains, hosting & growth" (45 characters) |
| No canonical URL on 9 indexable pages | Every page in `src/app/sitemap.ts`, plus service, category and package pages, declares `alternates.canonical` |
| No `og:image` on any page | `src/app/(website)/opengraph-image.tsx` generates a 1200×630 share image at build time for every public page |
| No structured data | The homepage emits Organization + WebSite JSON-LD (`src/lib/website/structured-data.ts`) with a site-search action |
| Doubled brand in titles, e.g. "Search marketplace — TAKATAK — TAKATAK" (seen live) | Page titles no longer add "— TAKATAK"; the layout template adds it once |

## HTTPS redirect: how it stays safe

The host (Apache + Phusion Passenger) forwards the original scheme in `x-forwarded-proto`. This was confirmed on the live site: `/dashboard` redirects to `http://…/login` over HTTP and to `https://…/login` over HTTPS. That redirect URL is built from this header.

`httpsRedirectTarget` (`src/lib/security/https-redirect.ts`) redirects only when **all** of these are true:

- the app runs in production
- the header is explicitly `http`
- the host is `takatak.ca` or `www.takatak.ca`
- the path is not `/api/health*` or `/.well-known/*` (uptime probes and certificate validation)

HTTPS traffic, a missing header, local development and unknown hosts are never redirected, so a redirect loop is not possible.

**Not added:** HSTS (`Strict-Transport-Security`). Add it only after every subdomain serves HTTPS, because browsers remember it.

## Structured data: only published facts

The JSON-LD contains name, URL, description, support email, Canada as the service area, and English/French. **No street address, phone or opening hours** are included: `brand.ts` has none. Add them to `brand.ts` first if TAKATAK wants a `LocalBusiness` listing.

## Verification

`npm run qa:website-seo` (runs in CI), 9 checks:

- redirect cases, including no loop on HTTPS, local or unknown hosts, and probe paths left alone
- the proxy applies the redirect first, as a 308
- title length
- canonical URL on every indexable page
- the sitemap and the canonical list stay in sync
- no doubled brand in titles
- og:image present
- JSON-LD shape and script-tag escaping

Manual, against `next build` + `next start` in production mode:

- HTTP request for `/pricing?x=1` with host `takatak.ca` → 308 `https://takatak.ca/pricing?x=1`
- the same request over HTTPS → 200
- `/api/health` over HTTP → 200
- each page tested (home, `/pricing`, `/marketplace/search`, `/services`, `/marketplace/gigs/logo-design`) has a single title, a correct canonical URL and `og:image`
- the homepage has exactly one JSON-LD block
- the image route returns a 95 KB PNG

After deploy, re-run the audit from `/dashboard/seo` (branch `claude/seo-site-audit`) to confirm the new score.
