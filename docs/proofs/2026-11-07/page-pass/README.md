# Page-by-page visual pass (2026-11-07, after PR #270)

Same method as the homepage: every section screenshot on desktop (1440) and phone (390) in French, read, fixed, and
screenshot again. Header, top menus, header search and QMAPS are not touched.

| Page | Seen on the screenshots | Fix |
|---|---|---|
| `/clover` | Big app screens cut their labels ("Payé · tiroir o...") and cropped their content; on phone the hero squeezed nine unreadable mini screens into three columns; "Au centre : TAKATAK Food Hub" linked to `/#suite` (no such section) and wrapped badly | Screens laid out at 148 px before being enlarged (same size on the page); phone hero shows the nine app icons; the link goes to `/foodhub` and reads as one sentence |
| `/foodhub` | Clover suite cards without app identity; FAQ list centred under a left-aligned heading; one kitchen-ticket line under WCAG AA while it faded in | App icons on the cards; FAQ aligned; the new ticket is revealed by a clip, never by transparency |
| `/takbot` | "Ce qu'un crédit permet" list in English on the French page | French names, shared with the homepage studio (`takbotActionLabel`) |
| `/services/*` (8 pages on `ServiceProductPage`: logo, apps, leads, automation, AI tools, data admin, menus and flyers, marketplace) | Plain white pages next to a navy site; prices written the English way ("$149 CAD", "$1,499"); package names in English | Rebuilt in the navy premium design (glass cards, an icon per step, same FAQ as the other pages); prices, units and suffixes in the visitor's language ("1 499 $", "et plus", "/prospect"); package names from the tier translations `/pricing` already uses |
| `/services/*` (10 category pages) and `/seo` | FAQ list centred under a left-aligned heading; gallery captions misaligned when the description runs on two lines | FAQ aligned; captions aligned on their first line |
| `/pricing` | Nothing to fix (an element capture looked shifted; the visitor view is aligned) | — |

## Checks

- `tsc --noEmit`, ESLint on the changed files, `qa:takbot`, `qa:website-theme`, `qa:website-seo`: pass.
- axe-core WCAG A/AA, desktop and phone: `/clover`, `/foodhub` (4 runs), `/takbot`, `/services/websites`,
  `/services/logo-branding`, `/services/mobile-apps`, `/`: no violation.
- Every page captured: no horizontal overflow, no page error.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 20:36 UTC

## Follow-up (PR #273)

| Page | Seen | Fix |
|---|---|---|
| `/services` index | Plain white page; prices written the English way ("$19.99", "$1,999") | Navy design, an icon per service, prices in the visitor's language |
| `/domain` | Mockups said "yourbrand" in French | "votremarque" |
| `/hosting` | Plan mockup said "80 GB SSD" in French | "80 Go SSD" |
| `/deals` | Single offer card alone in a two-column grid | Centred |

Screenshots: `services-index-fr.png`, `domain-deals-hosting-fr.png`. axe-core on `/services`, desktop and phone: no violation.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 20:55 UTC
