# TAKATAK homepage SEO — 2026-11-02

Signed: Codex SEO @ ChatGPT Work. Owner mandate: full control to complete TAKATAK; prioritize the supplied Semrush audit (28/100, nine critical and three minor issues). Continue existing code; preserve the active website PR #240.

## Observed baseline

The live homepage HTML was fetched directly, independently of the screenshots:

- Title: `TAKATAK — Websites, domains, hosting & growth`.
- Meta description: 84 characters, using the short brand tagline.
- One H1 and a canonical URL already exist.
- JSON-LD **already exists**: Organization + WebSite. The screenshot flag does not prove that structured data is absent or invalid.
- All 36 images already have an `alt` attribute; 19 are empty. Decorative thumbnails/logos next to equivalent text should keep empty alt text rather than repeat adjacent content to screen readers.
- No hreflang links. French text was only selected after hydration, so crawlers without JavaScript received English.
- Catalog counters render as zero until intersection/animation, despite real catalog values.

## Changes

1. Homepage EN/FR titles and descriptions describe the actual services and Montréal market; sharing metadata uses the same copy.
2. `/?lang=fr` renders French before JavaScript, including the root language, header and footer. English uses `/`; `/?lang=en` canonicalizes to `/`. Explicit language URLs take precedence over browser preferences.
3. Reciprocal en-CA/fr-CA/x-default alternates, French sitemap entry and crawlable full-document language links. Query language is forwarded by the proxy as a presentation header that overwrites client-supplied values; no auth permissions change.
4. Informative offer/listing photos receive the existing bilingual photo descriptions. Decorative repeats remain silent.
5. JSON-LD now also describes the localized WebPage linked to WebSite and Groupe TAKATAK. No fabricated rating, address, logo or social-profile URL.
6. Real catalog values render immediately. No zero-valued server placeholders.
7. `scripts/ops/audit-home-seo.py` verifies the actual HTTP response without JavaScript: root language, title/description, one H1, canonical, alternates, schema types and alt attributes. It is read-only.

## Validation and deployment evidence

- Local SEO suite: 11/11 passed, including actual React server rendering in English and French and metadata/schema consistency.
- Local auth cookie, frontend and session suites passed; access matrix 17/17 passed.
- Typecheck passed. Initial full lint identified only two new native language-link errors; links intentionally reload the document to refresh root layout language, with a scoped explanatory lint exception. Other 12 warnings predate this change.
- First production build compiled; its TypeScript worker hit the default 2 GiB Node heap. Retry uses a 6 GiB local heap; no server or repository memory settings changed.
- Production HTML audit still fails the new checks until this revision is deployed. A GitHub merge is not proof of deployment.
- Coolify console currently shows the login form; no authenticated deployment session has been verified.

## Remaining audit items requiring real external evidence

- Facebook, Instagram, LinkedIn, X and YouTube: add only verified official TAKATAK profile URLs to the footer and Organization `sameAs`. No handles have been established in the inspected source or public search. Never link unrelated namesakes or create profiles just to satisfy an audit.
- Structured-data result: re-run the audit after deployment; inspect its exact reported error rather than assume missing markup. This code does not promise rich-result eligibility.
- Text-to-code ratio: do not add filler content or delete required scripts to chase a percentage. Measure actual load and rendering performance after deployment.
- Domain authority/backlinks and search rankings: require legitimate external links, indexing and time. They cannot be assigned by changing application code.
- The current header/footer still reference the retired gold TK image. BRAND.md requires the owner's official blue assets; those files are not in this repository. Do not invent a replacement mark.
- No new Semrush score has been measured. Neither 100/100 nor complete platform functionality is claimed.

## Next verification

Run the exact branch CI, deploy the CI-verified main revision through authenticated Coolify access, then run:

```sh
python3 scripts/ops/audit-home-seo.py https://takatak.ca
```

Verify `/`, `/?lang=fr`, switching languages, the sitemap, signup and login without modifying credentials. Obtain a fresh Semrush report and compare each remaining flag. Record exact deployed SHA, all failures and proof in WORKLOG, coordination issue #105 and the existing Drive master/journal.
