# SEO site audit (`/dashboard/seo`)

First real SEO capability of the TAKATAK agency stack. It needs no third-party account: TAKATAK reads the public pages of the workspace's **own** websites and scores their technical SEO health.

## What it checks

Up to 10 pages per site, within a 35-second budget and 6 seconds per request:

| Area | Checks |
| --- | --- |
| Site | HTTPS reachable, `http://` → `https://` redirect, robots.txt present and not blocking everything, XML sitemap (via robots `Sitemap:` or `/sitemap.xml`, one sitemap-index level) |
| Page | HTTP errors, `noindex` (meta or `X-Robots-Tag`), title present, length and duplicates, meta description present and length, H1 missing or multiple, canonical, viewport (mobile), `lang`, images without `alt`, Open Graph title/image, JSON-LD on homepage, server response time, HTML weight |

**Score:** 100 minus, for each failed check, a weight (critical 12, warning 5, notice 1) plus 1 per additional affected page (max +4). Each finding has a plain-language label and detail.

## Who can do what

- **View:** `view_reports` (every workspace role).
- **Run:** `manage_brands` (owner, admin, manager) via `POST /api/seo/audits`. The request is same-origin JSON (2 KB max), and the workspace comes from the server session only.
- **Allowed sites:** a host can be audited only if it is one of the workspace's `DomainAsset` domains (not cancelled) or a `BusinessBrand.website`. TAKATAK cannot be used to scan arbitrary sites.
- **Limits:** one running audit per workspace (3-minute window), 20 audits per workspace per 24 h. A run interrupted by a restart shows as "interrupted".

## Network safety (SSRF)

`src/lib/seo/safe-fetch.ts`:

- **URLs:** http/https only, default ports only, hostnames only. IP literals, credentials, `.local`/`.internal` and single-label names are refused.
- **DNS:** every answer is validated at connect time. Private, loopback, link-local, CGNAT, multicast, documentation and IPv4-mapped/NAT64 private ranges are refused, which also blocks DNS rebinding.
- **Redirects:** followed manually (max 4) and re-validated, and only to the same site (host or `www.` variant).
- **Requests:** no cookies or credentials are sent, the body is capped at 1.5 MB, and requests go out with the `TAKATAK-SEO-Audit/1.0` user agent.

## Data

- Migration `20261006140000_seo_site_audits` adds two tables:
  - `seo_audits`: status, score, pages scanned, summary.
  - `seo_audit_issues`
- Both are tenant-scoped by `clientId` and have RLS enabled with no policies (no Data API access). They are additive only.

## Verification (2026-10-06)

- `npm run qa:seo-audit` (runs in CI): 14 checks covering:
  - the address filter (public vs 23 private/reserved forms)
  - URL rules
  - DNS refusal for `localhost`
  - a real local server proven unreachable
  - HTML extraction, including entity decoding and ignoring scripts/comments
  - robots and sitemap parsing
  - the rules and score
  - crawler confinement and page cap
  - an unreachable site
  - host normalization
  - workspace site listing
  - service refusals (foreign site, invalid host, busy, daily cap)
  - stored tenant-scoped issues
  - route gating
- Migration:
  - applied on top of the current `main` schema and re-ran safely
  - `prisma migrate diff` reported no difference
  - RLS is on for both tables
- **Live run** on takatak.ca (real internet), with the result saved and read back on PostgreSQL 16:
  - 10 pages in about 2 s, score 79/100
  - Real findings:
    - `http://takatak.ca` does not redirect to HTTPS (confirmed with curl)
    - homepage title too long
    - no canonical URL on 9 pages
    - no Open Graph tags
    - no JSON-LD on the homepage
  - A second workspace trying to audit takatak.ca was refused and saw nothing.

## Not included yet

- Keyword rankings, impressions and backlinks: need Google Search Console OAuth or an SEO data provider. `/dashboard/seo/keywords` and `/dashboard/seo/backlinks` stay placeholders.
- Scheduled re-audits, history charts, PDF/white-label report, JavaScript-rendered pages (the HTML is read as served).
