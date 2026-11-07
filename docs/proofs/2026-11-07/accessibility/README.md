# Accessibility sweep (axe-core, WCAG 2 A and AA), 2026-11-07

Run against a local dev server (`next dev`), French (`localStorage takatak.lang=fr`), desktop 1366×900 and
phone 390×844, after scrolling each page so lazy sections render.

Pages: `/`, `/?lang=fr`, `/deals`, `/free-tools`, `/blog`, `/pricing`, `/services`, `/seo`, `/domain`, `/hosting`,
`/clover`, `/foodhub`, `/takbot`, `/marketplace`, `/marketplace/search?q=logo`, `/marketplace/post-project`,
`/marketplace/category/branding`, `/marketplace/gigs/logo-design`, `/services/websites`, `/services/marketing`,
`/services/local-listings`, `/monitoring`, `/transfert`, `/infolettre`, `/privacy-manager`, `/ecosystem`.

## Fixed in this change

| Page | Rule | Before | Fix |
|---|---|---|---|
| `/` (scroll scenes) | color-contrast | white on emerald-500, 2.4–2.7:1 | emerald-700 (5.5:1) |
| `/` (scroll scenes) | color-contrast | #1E6BFF on #EEF3FA, 4.09:1 | #1557D6 (5.6:1) |
| `/clover` (mini-screen) | color-contrast | slate-500 on slate-100, 4.34:1 | slate-600 |
| `/marketplace/post-project` | color-contrast | slate-500 on primary/5, 4.43:1 | slate-600 |
| `/privacy-manager` | link-in-text-block | link told apart by colour only | always underlined |

After the fix, every page above reports no violation, except elements caught while they fade in (`/foodhub` order
tickets, `/seo` rows on one desktop run): at full opacity their colours pass.

## Honesty

The demo scenes showed made-up star ratings on fictional businesses ("★★★★★ 4,9", "4,8", "4,7"). They are removed
(owner rule: no invented ratings). The "New Google review" notification mock keeps its stars: it shows how an incoming
review appears, not a score claimed for anyone.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07
