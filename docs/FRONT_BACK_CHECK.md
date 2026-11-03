# Homepage promises → dashboard: what really works (2026-11-03)

Owner's order: everything the homepage offers must work in the dashboard, tested, no mock-ups.
Each line below was run against a real Postgres database (local, and in CI on the ephemeral database).

| Homepage action | What happens on the server | Proof | Status |
|---|---|---|---|
| TAK-TAK bar or one of the 6 chips → "Préparer ma demande" → "Oui, envoyer" | `POST /api/public/website-requests` → one **Lead** in the TAKATAK agency workspace, source "takatak.ca website", plus an audit entry and an in-app notification (no contact details in it) | Browser run: reference `53469AA8` shown, lead in the database and in `/dashboard/leads/inbox`. `npm run qa:website-lead-inbox-db` (CI step) | Works |
| Same request sent twice, bot, no contact | Same reference (no second lead) · nothing stored · refused | `qa:website-lead-inbox-db` | Works |
| Domain search request | Lead with the domain, same inbox | `qa:website-lead-inbox-db` | Works |
| Plan built on the homepage → `/register` → account created | **Was lost** (it stayed in the browser). Now: on the first dashboard visit, `PlanHandoff` sends it once as a Lead (title "Forfait choisi sur takatak.ca · …", category `homepage-plan`, promo code if any), tied to the signed-in account; the client sees the reference | `qa:website-lead-inbox-db` (server path). The banner itself needs a signed-in account (not testable here without Supabase) | Fixed, to check live |
| TAK-TAK live trial (signed-in) | Trial credits granted once ever in the visitor's own ledger; the sign-up is one Lead in the agency inbox (source "TAK bot trial"); owner can switch it off | `npm run qa:takbot-trial-db` (CI step) | Works (needs an economy engine key in production) |
| TAK-TAK answering (signed-in, trial or bought credits) | Credits are debited once from the visitor's own ledger, the answer is saved in the client's file (AI Studio → saved outputs, source `takbot`), a resend is never charged twice, a provider failure is refunded and saves nothing, no credits = refused before any AI call | `npm run qa:takbot-run-db` (CI step; the AI provider is a local stand-in, the rest is the real path) | Works (needs an engine key in production) |
| Newsletter sign-up (homepage, CASL) | One Lead "takatak.ca newsletter" with the exact consent text as proof; only the confirm link sent for it confirms it; unsubscribe archives it at once; only a confirmed address may be emailed; every step in the audit log | `npm run qa:newsletter-db` (CI step) | Works (needs the settings below) |
| "Créer un logo" chip | TAK-TAK links to the real page `/marketplace/gigs/logo-design` (200) | `qa:concierge` + browser run | Works |
| "Parler à une personne" (hero, TAK-TAK drawer, bottom-right button) | With no live-chat tool set, a small "Soutien TAKATAK" panel opens. "Demander une soumission" → `/marketplace/post-project` → Lead in the inbox. "Écrire au soutien" is a `mailto:` link: it opens the visitor's own email app, and nothing reaches the dashboard (some visitors have no email app set up) | Code read (`LiveChatLauncher.tsx`, `chat-provider.ts`); the post-project form uses the same intake | **Owner decision** (see below) |
| Hosting "Commander Portfolio / Bronze / Silver / Gold" (homepage pricing) | Saves the chosen plan in the browser, then `/checkout` (sign-in first). There, hosting is ordered in the Upmind window; when Upmind is not set, a hosting request goes to the inbox (`HostingRequestFallback`). **The chosen plan is never read back**: the visitor lands on an older English page ("Checkout: Get Started With Your Domain & Hosting Journey") and picks the plan again | Code read (`PricingTabs.tsx` writes `hostingPlan`; nothing reads it; `checkout-client.tsx`, `upmind-hosting-plans.tsx`) | **Owner decision** (see below) |
| Marketplace package order (`/checkout` after a package) | Sign-in required; `package_order` priced by the server from the catalog (static prices when the database has none), promo checked server-side → Lead | `qa:website-leads` (pricing), `qa:lead-order-billing-db` (won order → billing queue) | Works |
| Phone section: "Trouvez votre numéro maintenant" (search, hold a number 10 minutes) | Calls MIMT's API (`https://api.mimt.ca`): `GET /v1/public/numbers/search`, `POST/GET/DELETE /v1/public/numbers/holds`, in `takatakca/mimtcaapp` `apps/api/src/routes/numberPicker.ts`; the 10 minutes is the shared `NUMBER_HOLD_MINUTES` on both sides | 20/20 tests of `apps/api/test/numberPicker.test.ts` pass on MIMT `main` `1c33e7e` (run 2026-11-03 08:46 UTC). The live API cannot be reached from the cloud session | Works in code; live check is the owner's |
| "Finaliser ma commande" | `/commander` order funnel → `/register?plan=…&promo=…` | Existing funnel tests (`qa:order-funnel`) | Works |

## What the owner must have in production (Coolify)

- `WEBSITE_LEADS_ENABLED=true` and `WEBSITE_LEADS_CLIENT_ID=<TAKATAK agency workspace id>`. Without them every
  homepage request is refused ("Je n'ai pas pu l'envoyer…") and nothing reaches the inbox.
- `NEXT_PUBLIC_APP_URL=https://takatak.ca`: the intake only accepts requests from the site's own address.
- For the TAK-TAK trial: one economy engine key (Groq, Gemini, DeepSeek or OpenAI) saved in AI provider keys.
- For the newsletter: `NEWSLETTER_TOKEN_SECRET` (32+ characters), `NEWSLETTER_SENDER_ADDRESS` (the postal address
  shown in each email, CASL) and the email sender already used for sign-in codes (SendGrid or Gmail SMTP).

## Owner decision: a real "talk to a person"

The site already supports a live-chat tool. Two options:
1. **No code:** set one public key in Coolify (`NEXT_PUBLIC_CRISP_WEBSITE_ID`, `NEXT_PUBLIC_TIDIO_PUBLIC_KEY`,
   `NEXT_PUBLIC_INTERCOM_APP_ID` or `NEXT_PUBLIC_HUBSPOT_PORTAL_ID`). Every "Parler à une personne" button then opens
   that chat, with the page and request already written in.
2. **Small change (needs your OK, it touches the support panel):** replace the `mailto:` button with a two-line
   message box that sends to the same intake, so the message lands in the Lead Inbox like the others.

## Owner decision: the hosting order page

When a visitor clicks "Commander Silver" on the homepage, `/checkout` should open on Silver, in French, with the
price they saw. Today it opens an older English page with a domain search first, and the plan must be picked again.
Proposal (touches the checkout page, so it needs your OK): read the saved plan, scroll to it and highlight it, and
translate the page (FR first, EN alongside). Upmind stays the billing system; nothing changes in it.

## One-minute live test (owner)

1. On takatak.ca, click "Créer un site web" under TAK-TAK, then "Préparer ma demande", fill in your own name and
   email, "Oui, envoyer". You should see "Envoyé. Votre référence : XXXXXXXX".
2. Open `/dashboard/leads/inbox`: the request is there, source "takatak.ca website".
3. If step 1 says "Je n'ai pas pu l'envoyer", one of the three settings above is missing.

The cloud session cannot reach takatak.ca (network policy), so this live check is the owner's.
