# Homepage revamp below the top (2026-11-07)

## Owner order

The owner's order of 2026-11-07: revamp the homepage below the top, section by section, sharp and clean, layered, with
images and icons, the Clover suite fixed near the bottom. The top (header and hero) is not touched.

Every section was screenshot on desktop (1440) and phone (390) in French, read, fixed, and screenshot again.

## Fixed, section by section

| Section | Seen on the screenshots | Fix |
|---|---|---|
| Services gallery | inactive cards flat, labels hard to read on photos | inactive cards slightly dimmed and smaller, darker top scrim, label shadow |
| Plan builder | service rows used cropped photos | colour category icons, ring on the chosen ones |
| AI team | status badge pushed the name; on phone the rows ran past the right edge | name and badge on one row; grids get shrinkable columns |
| Devices | narrow "Soutien" tile, reviews screenshot cut | tiles full width, screenshot anchored top left |
| Telephony | option cards cut their detail with "..."; on phone the "Démonstration" tag sat on the last cards | details wrap to two lines, cards kept inside the stage, tag above the phone on small screens |
| Our products | Academy screenshot cut mid-word; SEO screenshot unreadable on phone; Food Hub "Démonstration" tag hidden behind the kiosk | screenshots anchored top left; tag above the scene |
| Clover suite | tiny mini screens, labels cut ("Payé · tiroir o..."), no app identity | each app gets a colour app icon, bigger mini screens, shorter end labels, soft accent glow per card; video button outlined |
| TAK-TAK packs | "Meilleur prix au crédit" squeezed "Agency" on phone | badge wraps under the name |
| Newsletter | the inbox emptied itself every cycle (one email out of three); on phone the emails ran past the edge | all three emails always shown, the highlight moves; reduced motion respected; shrinkable column |
| Final call to action | review header hidden with reduced motion; on phone the AI button covered "Réponse publiée" | finished state shown without animation; taller panel on phone |
| Bottom bars | the new-client card and the plan dock overlapped | the dock waits while the card is open (it folds after 15 s) |

## Checks (local dev server, French; English spot check on the Clover suite)

- `tsc --noEmit`, ESLint on the changed files, `qa:website-theme`: pass.
- All 12 sections below the hero screenshot on desktop (1440) and phone (390): no horizontal overflow, no page error.
- Clover suite on phone, French and English: every mini-screen label fits (no "...").

Screenshots: `clover-suite-desktop-fr.png`, `clover-suite-phone-fr-en.png`, `phone-team-phone-newsletter-final-fr.png`, `final-cta-desktop-fr.png`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-07 19:53 UTC
