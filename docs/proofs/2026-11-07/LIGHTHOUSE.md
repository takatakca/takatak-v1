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
