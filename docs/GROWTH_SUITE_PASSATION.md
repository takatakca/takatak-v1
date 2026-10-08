# Growth Suite : passation (ce qui est fait, ce qui reste)

Branche : `claude/festive-newton-5i9rv7`. `main` n'est pas touché. Rien n'est déployé et aucune migration n'est appliquée en staging ni en production.

## 0. URGENT : connexion sur staging.takatak.ca (diagnostic du 7 octobre)

**`takatak.ca` (production) fonctionne** : le code par courriel a été envoyé avec succès pendant le test. Les erreurs des captures viennent de **`staging.takatak.ca`**. Aucun code de cette branche n'y est déployé.

**1. « Email OTP is not configured »** : le fichier `.env` du serveur staging (`$TAKATAK_STAGING_APP_ROOT/.env`) n'a pas de `EMAIL_USER` / `EMAIL_PASSWORD`.
- Les ajouter, avec les mêmes valeurs que la production. `EMAIL_PASSWORD` est un mot de passe d'application Gmail de 16 caractères.
- Redémarrer l'application staging.

**2. « Unable to send the TAKATAK SMS code »** : Supabase staging (projet `utuvzrqvivqyziibobvu`) répond `otp_disabled — Signups not allowed for otp`.
- **Cause :** le numéro n'a pas d'identité dans la base de **staging**, qui est séparée de la production. La connexion ne crée jamais de compte.
- **Correctif :** créer l'identité sur staging (« Create your identity »), ou ajouter le téléphone à l'utilisateur dans Supabase → Authentication → Users.
- **À vérifier aussi :** les réglages du projet indiquent le fournisseur **Phone désactivé** (`phone: false`). Dans Supabase → Authentication → Sign In / Providers → **Phone**, l'activer avec Twilio : Account SID, Auth Token, Message Service SID ou Verify SID.
- **Avant de mettre le nouvel écran en production :** vérifier le même réglage sur le projet de production `pcjfahhlozsseqqevimi`.
- **Côté code :** le commit `e618334` affiche maintenant la vraie raison au lieu de « Unable to send… ». Il s'applique seul sur `main` (`git cherry-pick e618334`).

**3. Le CI de `main` échoue depuis le commit « connected socials » (5d3d33a)** : `package-lock.json` n'a pas été mis à jour pour `@atproto/oauth-client-node`.
- `npm ci` s'arrête, donc la mise en production staging ne part plus (« skipped »).
- **Correctif :** commit `5f3a0db`, qui ne touche que le lockfile. Il s'applique seul sur `main` (`git cherry-pick 5f3a0db`).
- Le module Social n'est pas modifié.

## Accès à me donner (pour que je fasse les réglages moi-même)

**Ne colle jamais un jeton ou un mot de passe dans la conversation.** Ajoute-les comme variables d'environnement dans l'environnement cloud de la session : menu de l'environnement dans la barre de titre → **Edit** → *Network secrets* (ou variables d'environnement). Une **nouvelle session** les prend en compte.

| Variable | Où l'obtenir | Ce que je ferai avec |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens | `npm run ops:supabase-phone-auth -- --project utuvzrqvivqyziibobvu --apply` (staging), puis la même chose pour la production `pcjfahhlozsseqqevimi` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | Twilio Console | `npm run ops:twilio-check` (lecture seule), puis réglage du SMS dans Supabase |
| `STRIPE_SECRET_KEY` (ou une clé restreinte avec « Webhook Endpoints: write ») | Stripe → Developers → API keys | `npm run ops:stripe-growth-webhooks -- --origin https://takatak.ca --apply --secrets-file <fichier>` |

Tous ces scripts sont en **lecture seule par défaut**. Ils ne changent rien sans `--apply` et n'affichent jamais un secret.

**À tout moment, sans aucun accès :**

```
npm run ops:readiness -- --origin https://staging.takatak.ca
```

Ça vérifie la santé du site, la connexion par courriel (sans envoyer de courriel), la connexion SMS et la Growth Suite. Résultat du 7 octobre :
- **staging** : 2 problèmes bloquants (courriel non configuré, fournisseur Phone désactivé) ;
- **production** : rien de bloquant.

**Ce que seul ton dev peut faire (accès au serveur) :** ajouter `EMAIL_USER` / `EMAIL_PASSWORD` dans le `.env` du serveur staging, puis redémarrer.

**À noter pour ton dev :** le commit « connected socials » ajoute aussi environ 14 migrations sociales qui ne sont pas dans `APPROVED_DEPLOY_MIGRATIONS` de staging. Même avec le lockfile corrigé, la mise en production staging s'arrêtera là tant qu'il ne les aura pas approuvées. C'est son code ; je n'y touche pas.

## 1. Ce qui est terminé et vérifié

- **Phases 1 à 9 :**
  - hub de connecteurs, audit SEO, réputation (style Birdeye) ;
  - crédits IA, analytics sans cookies, audiences de reciblage, chat web ;
  - envoi SMS/WhatsApp, file d'agents IA avec approbation, autopilote ;
  - vitrine d'avis, Concierge de chat, Core Web Vitals ;
  - GA4 / Search Console, rapport mensuel, Google Business Profile ;
  - abonnements aux forfaits et droits d'accès.
- **Sécurité :**
  - les données Google ne sont liées qu'à un site dont le client a prouvé être propriétaire (DNS TXT ou balise meta) ;
  - l'audit SEO se connecte uniquement à l'adresse IP vérifiée (pas de DNS rebinding).
- **Revue de code complète :** 10 problèmes trouvés. 9 étaient de vrais bugs et sont corrigés avec tests. Le 10ᵉ (sortie `null` d'un agent) ne plantait pas en pratique ; le changement est gardé par prudence.
- **Retour en arrière :** voir [GROWTH_SUITE_ROLLBACK.md](GROWTH_SUITE_ROLLBACK.md).
  - un commit par phase ;
  - script SQL de retour testé : le schéma redevient identique à `main`.
- **CI GitHub complet sur la branche :** vert. Il couvre le typecheck, le lint, les RLS en direct sur Supabase, l'isolation entre clients, les tests Growth sur base de données, le build et l'artefact.

## 2. Ce que TOI (propriétaire) dois faire

1. **Approuver la mise en ligne.** Demande-moi d'ouvrir la Pull Request, ou ouvre-la toi-même depuis la branche. Ton dev la révise.
2. **Valider les prix (brouillons, en CAD) :**
   - forfaits mensuels : `src/lib/growth/plans.ts` ;
   - packs de crédits IA (15 $ / 59 $ / 149 $ / 399 $) : `src/lib/growth/ai-engine.ts`.
3. **Créer ou obtenir les comptes externes** (à donner au dev, jamais par courriel en clair) :
   - **Google Cloud :**
     - un compte de service (GA4 + Search Console) ;
     - une clé API PageSpeed ;
     - un client OAuth pour Google Business Profile.
     - ⚠️ **L'API Google Business Profile demande une approbation de Google** (formulaire d'accès). Fais la demande tôt : ça peut prendre des jours.
   - **Stripe :** accès au compte pour créer les deux webhooks (voir §3).
   - **Twilio (SMS) :** numéro ou Messaging Service, avec l'enregistrement canadien requis pour les SMS commerciaux.
   - **WhatsApp Cloud API (Meta) :**
     - numéro d'entreprise ;
     - **modèle de message approuvé par Meta**, avec 3 variables : `{{1}}` = nom, `{{2}}` = entreprise, `{{3}}` = lien.
   - **Ta passerelle IA (tes 13 IA) :**
     - son URL ;
     - un jeton secret d'au moins 32 caractères ;
     - elle doit suivre le contrat décrit dans `docs/TAKATAK_GROWTH_SUITE.md` (section *AI Gateway contract*).
4. **Décider de la Phase 10** (indépendance des clients, droits sur les leads, transfert) en lisant [proposals/CLIENT_INDEPENDENCE_PROPOSAL.md](proposals/CLIENT_INDEPENDENCE_PROPOSAL.md). Elle contient 4 questions contractuelles auxquelles toi seul peux répondre.
5. **Rendre `takatakca/knowledgeAI` privé** (ou créer un dépôt privé compagnon) avant d'y mettre des contrats ou des données de clients.

## 3. Ce que TON DEV doit faire

### a) Révision et fusion

- Réviser la PR, phase par phase (un commit par phase).
- Le CI se lance automatiquement sur la PR.

### b) Migrations (staging d'abord, une à la fois)

Les 9 migrations Growth ne sont **pas** dans `APPROVED_DEPLOY_MIGRATIONS`. Les reconcilers ne les appliqueront pas tant qu'elles n'y sont pas ajoutées :

```
20261009010000_growth_reputation_and_ai_credits
20261009020000_growth_analytics_and_conversations
20261009030000_growth_agents_and_delivery
20261009040000_growth_agent_schedules
20261009050000_growth_review_showcase
20261009060000_growth_google_data_sources
20261009070000_growth_google_business_profile
20261009080000_growth_plan_subscriptions
20261009090000_growth_site_domain_verification
```

1. Faire une sauvegarde de la base.
2. Les ajouter dans `scripts/reconcile-staging-migrations.mjs`, puis déployer en staging.
3. Lancer `npm run qa:growth-backend` contre une base jetable.
4. Si tout va bien en staging, faire la même chose dans `scripts/reconcile-production-migrations.mjs`.

En cas de problème, suivre [GROWTH_SUITE_ROLLBACK.md](GROWTH_SUITE_ROLLBACK.md).

### c) Variables d'environnement (par environnement)

| Variable | Rôle |
|---|---|
| `TAKATAK_AI_GATEWAY_URL`, `TAKATAK_AI_GATEWAY_TOKEN` | passerelle IA (jeton d'au moins 32 caractères) |
| `CRON_SECRET` | protège les routes cron |
| `ANALYTICS_HASH_SECRET` | au moins 32 caractères aléatoires (identifiants visiteurs) |
| `GROWTH_TOKEN_ENCRYPTION_KEY_V1` | 32 octets en base64, ou 64 caractères hexadécimaux (chiffre le jeton Google Business) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | GA4 + Search Console. Activer *Analytics Data API*, *Analytics Admin API* et *Search Console API* |
| `PAGESPEED_API_KEY` | Core Web Vitals |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`, `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`, `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`, `GOOGLE_BUSINESS_PROFILE_ENABLED=true` | URI de redirection : `https://<domaine>/api/integrations/google-business/callback` |
| `STRIPE_AI_CREDITS_WEBHOOK_SECRET`, `AI_CREDITS_CHECKOUT_ENABLED=true` | achat de crédits |
| `STRIPE_GROWTH_WEBHOOK_SECRET`, `GROWTH_BILLING_ENABLED=true` | forfaits mensuels |
| `GROWTH_ENTITLEMENTS_ENFORCED` | laisser vide pendant le pilote, `true` quand les forfaits sont vendus |
| `TWILIO_MESSAGING_SERVICE_SID` ou `TWILIO_SMS_FROM`, `GROWTH_SMS_ENABLED=true` | SMS (réutilise `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`) |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_REVIEW_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_GRAPH_VERSION` (format `v21.0`, jamais devinée), `GROWTH_WHATSAPP_ENABLED=true` | WhatsApp |
| `TRUSTED_PROXY_HOPS` (ou `CLIENT_IP_HEADER`) | voir l'étape e) |

Une fonction dont les variables sont absentes affiche « non configuré » : rien ne plante.

### d) Webhooks Stripe et crons

- **Webhook** `https://<domaine>/api/billing/ai-credits/webhook` : événement `checkout.session.completed`.
- **Webhook** `https://<domaine>/api/billing/growth/webhook` : événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` et `invoice.paid`.
- **Cron toutes les 15 minutes :** `/api/cron/growth-agents`
- **Cron toutes les heures :** `/api/cron/growth-reviews-sync`
- Les deux crons utilisent l'en-tête `Authorization: Bearer $CRON_SECRET`. Sur MochaHost, ce sont des crons cPanel qui appellent ces URLs avec `curl`.

### e) Vérification IP (anti-spam) à faire sur chaque serveur

Je n'ai pas pu voir d'ici quel `X-Forwarded-For` l'application reçoit sur MochaHost/Passenger.

- Avec **un seul** proxy devant l'app (Cloudflare seul, Vercel ou Coolify) : `TRUSTED_PROXY_HOPS=1`, c'est la valeur par défaut.
- Avec **deux** proxys (ex. Cloudflare devant Coolify/Traefik) : `TRUSTED_PROXY_HOPS=2`.
- Ou bien `CLIENT_IP_HEADER=cf-connecting-ip` si Cloudflare est toujours devant.

### f) Tests en staging (avec un vrai compte)

1. Ajouter un site web et le vérifier (TXT ou balise meta), puis lier GA4 et Search Console.
2. Créer une page d'avis et envoyer une demande par lien, SMS et WhatsApp.
3. Installer les scripts `takatak-analytics.js`, `takatak-chat.js` et `takatak-reviews.js` sur un site de test. Envoyer un message, puis répondre depuis la boîte de réception.
4. Connecter Google Business Profile, lancer « Sync now », puis publier une réponse.
5. En mode test Stripe : acheter un pack de crédits, puis souscrire un forfait. Vérifier les crédits inclus.
6. Lancer un agent IA avec ta passerelle et le faire passer par approbation → exécution.

## 4. Ce qui n'est PAS fait (volontairement)

- **Phase 10 (indépendance des clients) :** en attente de ta décision et de la révision du dev.
- **Fournisseurs payants non branchés** (le tableau de bord les affiche honnêtement « non configuré ») :
  - Semrush, Ahrefs, DataForSEO, BrightLocal ;
  - Google Ads, Meta Ads, TikTok Ads, Microsoft Ads ;
  - Yelp, Trustpilot.
  - Chacun demande un compte et une clé API. Il sera branché quand tu les auras.
- **Module Social :** non touché, comme demandé.
