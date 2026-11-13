# takatak.ca audit, top to bottom (2026-11-08)

Asked by the owner: click every link, nothing dead, no surprise jump to another site, every page complete.
Run on a local production build of `main` (takatak.ca itself is not reachable from the cloud session).

## How it was checked

| Pass | What | Result |
|---|---|---|
| Source scan | Every literal internal link in the public site code, matched against the app's routes | 1 dead link: menu "Partenaire / pigiste" → `/dashboard/freelancer` (no such page) |
| Server crawl | Every page reachable from `/`, `/?lang=fr`, `/?lang=en` and the sitemap, every `<a href>` followed, status of each target | 101 internal URLs, 0 errors |
| Browser render | 96 pages rendered in French after the page scripts run (links that only appear after loading included) | 166 link targets, 0 errors, 0 script errors |
| Button pass | Every visible button on 20 pages clicked on a fresh load (dialog, menu, selection, scroll, page change or request counted as an effect) | 87 buttons; 1 dead (empty Marketplace search, fixed); 5 flagged were tabs already selected (`/services/websites` "Design", `/takbot` "Clavarder", `/domain` "Recherche", `/hosting` "Votre forfait", `/services/voip` "Parcours d'appel"): correct |
| Homepage | 175 buttons, checked the way a visitor uses them | Service cards: flip, "Ajouter à mon forfait", "Voir le détail" (pop-up, Escape closes it in 0.5–1.2 s), "Retour à la photo" all work; carousel arrows and pause work; plan bar "Commander" opens the order sheet; 44 of 47 other buttons clicked (the 3 others are the plan bar sliding in, a test timing artefact); 0 page errors |
| Message box | Contact page and support panel | Empty → "Écrivez quelques mots…"; no contact → "Ajoutez un courriel ou un numéro…"; intake off (local 503 `not_enabled`) → message ready in an email; intake on (200) → "Message reçu" + reference |
| Accessibility | axe-core WCAG A/AA, desktop 1366 and phone 390 | `/contact`, `/about`, `/freelancers`, `/pricing`, and the open support panel: no violation |

## Found and fixed in this PR

| Where | Problem | Fix |
|---|---|---|
| Menu (☰) "Partenaire / pigiste" | Went to `/dashboard/freelancer`: 404 | Goes to the new `/freelancers` page (same label, same place) |
| Footer "À propos de TAKATAK" | Went to the homepage: there was no About page | New `/about` page: who GROUPE TAKATAK is, the services in brand order, every product with its real status, how we work |
| Footer "Soutien" | Went to the dashboard, so a visitor landed on the sign-in screen | Goes to the new public `/contact` page, which still links clients to their support space |
| Footer, Marketplace "Devenir pigiste" | Opened an email to support (the code said "until a freelancer sign-up page exists") | New `/freelancers` page: how it works, the skills TAKATAK works with, and an application form |
| "Parler à une personne" (every page) | Without a chat provider, the panel only offered "Écrire au soutien" (opens the visitor's email app) | The panel now holds a real message box: the message reaches the TAKATAK leads inbox. If the intake is off, the same message is ready in an email |
| No contact page | Nowhere to write to TAKATAK without an email app | `/contact` with the message box (subject, message, name, business, email or phone), support email, Montréal, links to start a project, client support and pricing; `?topic=billing` preselects a subject |
| Marketplace, English | "Escrow protection", "TAKATAK escrow", "held in escrow", "Get paid automatically on approval": no escrow account and no automatic payout exist in the code or database (TK-019 in `docs/DEV-TODO.md`) | Same promise as the French page: "Protected payment", "TAKATAK holds the payment", "Get paid once the client approves" |
| Footer "Entreprise" | No contact link | "Nous joindre / Contact" added |
| Marketplace search | "Rechercher" with nothing typed did nothing | Opens the full Marketplace search (every service) |
| Contact messages (review) | A second, different message within 15 minutes would have been collapsed into the first (same title) | The title quotes the start of the message; only a repeated send of the same message is collapsed (`qa:website-leads`) |
| `/checkout` order | The order was filed as English even from the French page | The visitor's language is sent with the order |
| Sitemap | — | `/about`, `/contact`, `/freelancers` listed, with canonical URLs (checked by `qa:website-seo`) |

Messages from the box are recorded as project requests with the category `contact-question`, `contact-support`,
`contact-billing`, `contact-partner` or `contact-other`, so the team can sort them in `/dashboard/leads`.
`qa:website-leads` now checks that every subject passes the server's validation.

## Checked and left as is

- **QMAPS, FLEXS, MIMT** open their own sites in a new tab, with an arrow icon. That is the site's rule
  (`src/lib/website/product-destinations.ts`: a control naming the product goes to the product's site; a control naming
  the TAKATAK service goes to the service page). The header QMAPS / FLEXS buttons are untouched (owner's order).
- `/reviews` links to `takatak.ca/dashboard/...` with full addresses: the page is built for `review.takatak.ca` (its
  canonical), where full addresses are needed.
- `/transfert` (legacy host migration) and `/ecosystem` (no brand confirmed yet, not indexed) are not in the menus on
  purpose.
- Opening `takatak.ca` with no `?lang=` shows English first (SEO setup: English default, `/?lang=fr` for French). Moving
  between pages keeps the visitor's language. Server-side French by default is in the owner's pending decisions.

## Needs the owner (cannot be done from code)

| Item | Why it matters | What to do |
|---|---|---|
| Lead intake in production | Without `WEBSITE_LEADS_ENABLED=true` and `WEBSITE_LEADS_CLIENT_ID`, every form (contact, project, hosting, support panel) falls back to an email | Coolify, takatak.ca app (`docs/DEV-TODO.md` 1.4) |
| Official logo files | The header and footer still show the retired gold "TK" mark (`BRAND.md` says replace it everywhere). The official files are not in `knowledgeAI/brand/` nor in Drive | Upload `logo-circle.png`, `logo-wordmark.png`, `banner.png` to `knowledgeAI/brand/` |
| Production deploy switch | `main` is verified on staging, production stays "skipped" | `COOLIFY_TAKATAK_AUTODEPLOY_ENABLED` and the 2 Coolify secrets |
| French legal pages | `/terms`, `/privacy`, `/privacy-policy`, `/terms-of-service`, `/data-deletion` are English only | Owner's consent to write the French text |
| Support hours | The support panel says "En semaine, 9 h à 18 h (HE)" | Confirm or give the real hours |
| "Facturation" labelled "Disponible maintenant" | `/services/billing` promises online card payments paid to the client's account; the feature behind it (Stripe Connect, `docs/CLIENT_INVOICING_STRIPE_CONNECT.md`) is off unless `CLIENT_INVOICING_ENABLED` is set, which cannot be seen from here | Confirm it is on in production, or the label should become "Accès anticipé" |

Screenshots: `about-fr-desktop.png`, `contact-fr-desktop.png`, `freelancers-en-desktop.png`,
`support-panel-fr-phone.png`, `contact-sent-fr.png` (intake on), `contact-intake-off-fr.png` (intake off).

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-08 06:28 UTC

## Follow-up (PR #279)

| Where | Problem | Fix |
|---|---|---|
| `/contact`, `/freelancers`, `/transfert` | The "10 % de rabais" invite slid over the form | Added to the form pages where it stays off |
| Support panel | Showed "Page : … · Langue : …" (meant for the team) | Still sent to the team; the visitor only sees their own request |
| Support panel | Closing it froze the page ~0.5 s (site-wide loading overlay) | The launcher is out of that overlay |

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-08 06:50 UTC
