# Lighthouse, 2026-11-07 (after PRs #264 to #268)

**Where measured:** Lighthouse 12 on a local production server (`next build --webpack`, then `next start`), phone (Moto G
simulated, slow 4G simulated) and desktop, main `94c380af` plus the changes of this PR. The cloud session cannot reach
takatak.ca: the live site changes only after the production deploy switch. Phone performance moves several points from
one run to the next.

## Scores (performance · accessibility · best practices · SEO)

| Page | Phone | Desktop |
|---|---|---|
| `/?lang=fr` (home FR), run 1 / run 2 | 61 / 74 · **100** · 100 · 100 | 98 · **100** · 100 · 100 |
| `/` (home EN) | 52 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/seo` | 87 · **100** · 100 · 100 | 99 · **100** · 100 · 100 |
| `/marketplace` (3 runs) | 69 / 88 / 87 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/marketplace/gigs/logo-design` | 90 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| `/marketplace/post-project` | 92 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |

The first `/marketplace` phone run (69, 710 ms blocking) was a cold start; the next two runs gave 88 and 87 (40 to 50 ms
blocking), in line with the 90 of 2026-11-04. `/marketplace` and `/seo` are now rendered per request (database prices),
like the category and package pages already were.

## Fixed in this PR (accessibility below 100 before)

| Where | Lighthouse audit | Fix |
|---|---|---|
| Support button on every page | label-content-name-mismatch: visible "Parler à une personne", name "Ouvrir le soutien TAKATAK" | name starts with the visible words |
| Home service cards | label-content-name-mismatch: card and "Ajouter à mon forfait" names did not contain their visible text | card named by its visible text (+ hidden "Voir le détail"); add button named by its visible words |
| Home ask bar placeholder (rotating examples) | color-contrast, sampled while fading in | revealed by a clip instead of a fade: never transparent |
| `/seo` "Plan d'action prêt" badge | color-contrast, sampled while fading in | same: slide and clip, no transparency |

Reduced motion still turns these animations off.

## Still not 100 (needs the owner)

Phone performance of the homepage (52 to 74): long page; proposal 4 of the inventory (shorter homepage) is the owner's
decision, as noted on 2026-11-04.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 18:17 UTC

## Other public pages (check-in of 18:43 UTC, main 44f43df1)

| Page | Phone | Desktop |
|---|---|---|
| `/pricing` | 89 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| `/clover` | 86 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/foodhub` | 86 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/takbot` | 86 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/services/websites` | 86 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/services/marketing` | 87 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| `/deals` | 91 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| `/free-tools` | 93 · 100 · 100 · 100 | 100 · 100 · 100 · 100 |
| `/hosting` | 85 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/domain` | 84 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |

Accessibility, best practices and SEO are 100 on every page. Phone performance is in line with 2026-11-04 (no
regression). Its limit is the paint of the text heading (the largest element) on simulated slow 4G: about 0.45 s server
time, then 3 render-blocking stylesheets and the page script; the heading itself is not animated. Inlining the CSS was
tried on 2026-11-04 and made phone scores worse.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 18:53 UTC

## Pages rebuilt today (check-in of 22:43 UTC, main f4c2f62f)

Local production server (`next build --webpack`, `next start`), Lighthouse 12, same method as above.

| Page | Phone | Desktop |
|---|---|---|
| `/services?lang=fr` (index, rebuilt in #273) | 89 · 100 · 100 · 100 | 99 · 100 · 100 · 100 |
| `/services/logo-branding?lang=fr` (rebuilt in #271) | 85 · 100 · 100 · 100 | 96 · 100 · 100 · 100 |
| `/services/mobile-apps?lang=fr` | 86 · 100 · 100 · 100 | 84 · 100 · 100 · 100 |
| `/clover?lang=fr` | 87 · 100 · 100 · 100 | 98 · 100 · 100 · 100 |
| `/foodhub?lang=fr` | 85 · 100 · 100 · 100 | 97 · 100 · 100 · 100 |
| `/commander?lang=fr` | 82 · 100 · 100 · 66 | 98 · 100 · 100 · 66 |

- `/commander` SEO 66 is on purpose: the order page is `noindex, follow`, which Lighthouse counts as "blocked from indexing".
- The first `/services` phone run failed to record a trace (`NO_NAVSTART`); the score above is the second run.

### Found: French visitors get a layout shift on inner pages

Inner pages are rendered by the server in English; the browser switches them to French after the page script loads
(stored choice, browser language, or `?lang=fr` since #273). The whole page then reflows. Measured on
`/services/mobile-apps`, desktop:

| Visit | CLS | Performance |
|---|---|---|
| English (no `lang`) | 0.031 | 100 |
| French (`?lang=fr`) | 0.303 | 84 |

This is not new with #273: every visitor with a French browser has had this switch on inner pages; the earlier
Lighthouse runs did not see it because Lighthouse runs with an English browser and, before #273, ignored `?lang=fr`
on inner pages. The fix is to render the language on the server for inner pages, as the homepage already does
(`?lang=` and the stored choice, e.g. in a cookie). That is the pending "HTML serveur en français des pages internes"
decision (SEO owner); not changed here.

The remaining 0.031 on every page comes from the new-client offer bar that appears above the header after load
(header area, not touched).

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 22:55 UTC
