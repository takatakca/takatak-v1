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
| "Créer un logo" chip | TAK-TAK links to the real page `/marketplace/gigs/logo-design` (200) | `qa:concierge` + browser run | Works |
| "Finaliser ma commande" | `/commander` order funnel → `/register?plan=…&promo=…` | Existing funnel tests (`qa:order-funnel`) | Works |

## What the owner must have in production (Coolify)

- `WEBSITE_LEADS_ENABLED=true` and `WEBSITE_LEADS_CLIENT_ID=<TAKATAK agency workspace id>`. Without them every
  homepage request is refused ("Je n'ai pas pu l'envoyer…") and nothing reaches the inbox.
- `NEXT_PUBLIC_APP_URL=https://takatak.ca`: the intake only accepts requests from the site's own address.
- For the TAK-TAK trial: one economy engine key (Groq, Gemini, DeepSeek or OpenAI) saved in AI provider keys.

## One-minute live test (owner)

1. On takatak.ca, click "Créer un site web" under TAK-TAK, then "Préparer ma demande", fill in your own name and
   email, "Oui, envoyer". You should see "Envoyé. Votre référence : XXXXXXXX".
2. Open `/dashboard/leads/inbox`: the request is there, source "takatak.ca website".
3. If step 1 says "Je n'ai pas pu l'envoyer", one of the three settings above is missing.

The cloud session cannot reach takatak.ca (network policy), so this live check is the owner's.
