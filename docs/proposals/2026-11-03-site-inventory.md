# takatak.ca homepage inventory: proposals only (2026-11-03)

The owner asked: "scope out the whole front website… to make it even more premium and more user-friendly". The owner
also said: "don't touch anything else" without his OK. So this is a list of proposals, with screenshots. **No code was
changed.** The owner picks what to do. The header nav, the header search and QMAPS are never touched.

Screens: local server on `main` after #240, French, desktop 1440 px and phone 390 px. Files are in
`docs/proofs/2026-11-03/inventory/`.

## The 8 proposals, most useful first

| # | What I see | Proposal | Size |
|---|---|---|---|
| 1 | **The same 10 % offer appears in 4 places at once.** The top banner, a pop-up card (after 20 s or on scroll), a "FIRST10" chip after the card is closed, and TAK-TAK's answer. On desktop the card covers the hero text (`a-offer-popup-over-hero.jpg`); on a phone it covers a third of the screen (`g-mobile-offer-sheet.jpg`). This is the "too many things happening" feeling. | Keep the top banner and TAK-TAK's mention. Show the card once, only after the visitor scrolls past the services, never over the hero, and never as a sheet on phones (the banner is enough there). | Small (`SignupPromoModal.tsx`, `promotions/`) |
| 2 | **Three things float at the bottom of every screen.** The "FIRST10" chip on the left, the "Votre forfait en 30 secondes / Mon forfait" bar in the middle, and "Parler à TAKATAK" on the right. They cover content, for example the newsletter title (`d-bottom-bar-crowded.jpg`). | One bar only. It shows after a service is added, and it holds "Mon forfait" and "Parler à une personne". Hide the chip. | Medium (`StickyPlanDock.tsx`, `LiveChatLauncher.tsx`) |
| 3 | **The giant outline words band** ("Téléphonie d'affaires • et publicité • Médias soc…") takes a full screen and says nothing new (`c-giant-marquee.jpg`). | Remove it, or make it a thin band one line high. | Small (`KineticMarquee.tsx`) |
| 4 | **The page is very long**: about 18,000 px on desktop and 30,000 px on a phone (about 36 phone screens). | Keep a short teaser of the AI team, the devices and the phone offer on the homepage, each with "Voir plus", and move the details to their own pages (`/takbot`, a phone page). Premium sites are shorter. | Medium |
| 5 | **The "live" band right under the hero** ("75 connexions", "Ce que ça fait, en direct") has preview cards that look empty: blank stars, a blank map (`b-live-band-under-hero.jpg`). TAK-TAK now carries the top of the page. | Remove the band, or replace it with three sharp real screenshots. | Small (`LiveBand.tsx`) |
| 6 | **The robot appears 4 times**: hero, TAK-TAK section, AI team, AIOS. | Keep TAK-TAK the robot in the hero and in the TAK-TAK section only, and use a small icon elsewhere. One character, one place it lives. | Small |
| 7 | **The real dashboard screenshots** in "Tout votre commerce, sur l'ordinateur et le cellulaire" show English rows saying "Not connected" (`e-dashboard-shots-english.jpg`). Real, but not premium. | Re-shoot them from a French demo workspace with filled-in data, clearly labelled "Démonstration". | Medium (new captures) |
| 8 | **"Bientôt" on two big blocks**: "L'essai gratuit ouvre très bientôt" (TAK-TAK) and "Les inscriptions ouvrent très bientôt" (newsletter, `f-newsletter-not-open.jpg`). This is honest, because the production settings are not on. | Owner: turn on the settings in `docs/FRONT_BACK_CHECK.md` and both blocks work. No code needed. | Owner setting |

## Wording to align (small)
- The floating button says "Parler à TAKATAK", while the hero and TAK-TAK say "Parler à une personne". Proposal: use
  "Parler à une personne" everywhere.
- The live-chat decision (Crisp/Tidio key, or a message box to the inbox) is in `docs/FRONT_BACK_CHECK.md`.

## How to answer
Reply with the numbers you want, for example "1, 2, 3, 6". Each will be its own small commit, with screenshots before
and after, on a new PR.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-03 06:49 UTC
