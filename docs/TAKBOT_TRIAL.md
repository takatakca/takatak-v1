# TAK bot trial on the homepage

*Essai de TAK bot sur l'accueil. Résumé en français plus bas.*

The homepage TAK bot chapter now opens on the **live bot** ("Essayer maintenant"). The recordings of the real app stay
one click away ("Voir l'app").

## What the visitor sees

1. **Signed out:** three steps (sign in with Google, a client file is created, trial credits arrive), example prompts,
   a locked composer, **Continuer avec Google** and **Ou avec mon courriel**. The consent line says an account and a
   client file are created with their name and email, that answers are kept there, and that no promotional email is
   sent without consent (newsletter and device alerts keep their own opt-in). A prompt typed before signing in is kept
   in the browser tab and restored after the round trip.
2. **Back from sign-in** (`/?essai=takbot`): the page scrolls to the chapter, the trial is claimed once, and the visitor
   sees "Bienvenue, {first name}. 50 crédits sont dans votre compte."
3. **Asking:** Chat (1 credit), Write (2), Research (2). Every run goes through `POST /api/takbot/run`: credits are
   debited first, refunded if the engine fails. Each answer is saved in the client's file
   (`/dashboard/ai-studio/saved`, origin `ai_generated`, metadata `source: takbot`).
4. **Trial used up:** "Vos crédits d'essai sont utilisés…" with a link to the packs. Buying any pack (or an admin grant)
   unlocks the premium routing (Claude, GPT, Perplexity…), with no code change.
5. **Trial closed** (no economy engine connected, or switched off): an honest "L'essai gratuit ouvre très bientôt" and
   links to the app recording and `/takbot`. Nothing breaks.

The homepage concierge ("Qu'est-ce qu'on fait pour votre entreprise ?") gets a **Demander à TAK bot (IA)** button under
each answer: it closes the panel and puts the question in the live bot.

## How it works

| Piece | File |
| --- | --- |
| Trial rules (credits, economy engine order, routing) | `src/lib/takbot/trial.ts` |
| Claim once, status, premium check, saved answers | `src/lib/takbot/server.ts` |
| CRM card in the agency workspace (`takatak.ca TAK bot trial`) | `src/lib/takbot/trial-lead.ts` |
| `POST /api/takbot/trial` (same origin, signed-in workspace, soft limit 4 new trials per network per day) | `src/app/api/takbot/trial/route.ts` |
| `GET /api/takbot/catalog` now returns `trial` and `session.firstName` | `src/app/api/takbot/catalog/route.ts` |
| The panel | `src/components/website/funnel/TakbotTryPanel.tsx` |
| Words (FR / EN) | `src/lib/takbot/trial-copy.ts` |
| Tests | `scripts/takbot-trial-tests.ts` (`npm run qa:takbot`) |

- **Account and client file:** sign-in is the existing Supabase Auth flow (`/auth/callback`), which creates the profile
  and the visitor's personal workspace. No new auth, no new table.
- **Trial credits:** one ledger grant per workspace, key `grant:takbot-trial:<workspace id>`. The ledger refuses a
  second one, so a retry or a second tab never doubles it.
- **Economy engine:** the first connected of Groq, Gemini, DeepSeek, OpenAI (their default models: Llama 3.3 70B,
  Gemini 2.5 Flash, DeepSeek Chat, GPT-5 mini). Premium engines are never used for a trial.
- **Premium:** as soon as the workspace has a purchase or a grant other than the trial, the normal TAK bot routing
  applies (best engine per mode, or the one picked on `/takbot`).
- **CRM:** a new trial creates one card per email in `/dashboard/leads` (source **takatak.ca TAK bot trial**), when
  `WEBSITE_LEADS_ENABLED` and `WEBSITE_LEADS_CLIENT_ID` are set. Name and email come from the profile row, never from
  the browser. The card says `marketingConsent: false`.

## Owner steps (once)

1. **Supabase → Authentication → Providers → Google:** turn it on with a Google OAuth client (Google Cloud console,
   type "Web application", redirect URI from the Supabase page). Add `https://takatak.ca/auth/callback` to the
   Supabase redirect allow list. Until then, the Google button says Google sign-in is not on yet and the email link
   works.
2. **Dashboard → Admin › AI provider keys:** add one economy key (Groq is the cheapest), then **Test the key**.
3. Optional, in Coolify: `TAKBOT_TRIAL_CREDITS` (default 50), `TAKBOT_TRIAL_ENGINE` / `TAKBOT_TRIAL_MODEL` to pin the
   engine, `TAKBOT_TRIAL_ENABLED=false` to close the trial.

---

## En bref (français)

- L'accueil montre le **vrai TAK bot**. Avant de l'utiliser : **connexion Google** (ou courriel). Ça crée le compte
  TAKATAK et la **fiche client** du visiteur, puis met **50 crédits d'essai** dans son compte, une seule fois.
- L'essai roule sur un **moteur économique** (Groq, Gemini, DeepSeek ou OpenAI mini). Dès qu'un forfait est acheté,
  les **moteurs premium** s'ouvrent.
- Chaque réponse est **gardée dans la fiche** du client (AI Studio › Saved). Chaque nouvel essai crée une **fiche dans
  le CRM** TAKATAK (`/dashboard/leads`, source « takatak.ca TAK bot trial »), sans consentement marketing.
- À faire par le propriétaire : activer **Google** dans Supabase, brancher une **clé économique** (Groq) dans Admin ›
  AI provider keys. Réglages facultatifs : `TAKBOT_TRIAL_CREDITS`, `TAKBOT_TRIAL_ENGINE`, `TAKBOT_TRIAL_MODEL`,
  `TAKBOT_TRIAL_ENABLED`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-01
