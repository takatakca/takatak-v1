# TAKATAK Free SEO Tools integration

This first-party TAKATAK V1 dashboard page is protected by the existing TAKATAK Auth session, current workspace selection and view_dashboard permission. The server action enforces client_scoped access again. No separate login or payment card.

All 23 requested tools are represented; nine safe public-page scanners use the existing pinned-DNS, redirect-controlled fetchPublicPage from the SEO engine; robots.txt, schema.org JSON-LD, llms.txt and SERP snippet generators and two text analyzers are interactive. Eight tools which genuinely require Google, competitor or AI-search observations are marked provider required and link to existing connector pages. No rankings or LLM citations are invented.

The live sitemap checker reads a capped public sitemap and at most 300 locations, but does not probe each URL. Page word counts are sampled; search snippets approximate. Google Search Console or other authorized data is required for actual indexing and ranking assertions. llms.txt is voluntary.

Review PR under the V1 coordinator rules, run typecheck/lint/build, then merge and release with existing gate. This dashboard feature does not migrate any database or touch production credentials. Next connect SEOTAKATAK server-side portfolio API with signed tenant scoped tokens.
