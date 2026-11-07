# Local fonts and reproducible builds

The website, OAuth consent and dashboard layouts retain their existing font families. They now use `next/font/local` with genuine WOFF2 assets from exact-version Fontsource npm packages. A production build no longer needs Google Fonts CSS or font hosts. Next.js still emits optimized same-origin font assets and generated CSS.

| Family | Locked package | Styles |
| --- | --- | --- |
| Geist | `@fontsource-variable/geist@5.3.0` | Variable 100–900 normal |
| Geist Mono | `@fontsource-variable/geist-mono@5.3.0` | Variable 100–900 normal |
| Inter | `@fontsource-variable/inter@5.3.0` | Variable 100–900 normal |
| Montserrat | `@fontsource-variable/montserrat@5.3.0` | Variable 100–900 normal |
| Instrument Serif | `@fontsource/instrument-serif@5.3.0` | 400 normal and italic |

The public website keeps `--font-website-body`, `--font-website-display` and `--font-serif`; the root keeps `--font-geist-sans` and `--font-geist-mono`. OAuth still uses Montserrat at its existing 400/600/800 weights within the variable range. Geist and the below-hero serif remain unpreloaded, preserving the recent phone first-paint work. Instrument Serif retains its Times New Roman fallback. The Latin subset matches the prior Google-loader subset and supports the bilingual French/English site.

The dependency lockfile records npm integrity for the packages. Original SIL Open Font License text is served under `/fonts/licenses/`, including in packaged deployments that copy `public/`. Font binary contents are not modified.

## Verification

Validation passed on `feature/cloud-local-fonts`, based on latest main `b853bb6`: full production webpack build/TypeScript,105 static pages, standalone typecheck, required-source/module-load checks,17 access checks, authentication/identity suites,11 website SEO checks and theme check. Lint reports zero errors/12 pre-existing warnings; changed modules and the optional verifier are clean.

Actual built-app proof passed six exact font HTTP responses, five license responses and three Chromium page states with no external font requests/page errors. See [captured proof and reproducible verifier](proofs/2026-11-04/local-fonts/README.md). This change does not edit authentication logic, master API contracts, the Prisma schema or migrations. Production deployment and live database/provider behavior are separate acceptance steps.

Normal setup remains `npm ci --ignore-scripts=false` followed by `npm run db:generate`; Prisma setup has its own verified engine/network requirements. This change removes the Google-font build dependency only. In the isolated cloud proof, genuine schema-specific Prisma6.19.3 types are generated through the official exact-version npm/WASM APIs because the normal engine host is blocked. That type-generation proof does not certify database runtime.

— signé : Codex build continuation @ Codex cloud · 2026-11-04
