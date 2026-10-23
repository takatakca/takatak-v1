# TAKATAK sur Clover — l'app n° 3 / TAKATAK on Clover — app #3

Recherche, aspects juridiques et plan, 2026-10-23. **Recherche seulement : aucun code, aucune variable d'environnement,
aucun déploiement.** Ce n'est pas un avis juridique.

Research, legal and plan, 2026-10-23. **Research only: no code, no env, no deploy.** Not legal advice.

---

## Français

### L'app en une phrase

Un restaurant Clover installe **TAKATAK** depuis le Clover App Market; TAKATAK lit son menu, ses heures et ses
coordonnées dans Clover et les publie, **à sa demande et avec son approbation**, sur **ses propres** comptes Google
(fiche d'établissement, menu, photos, publications, bouton « Commander »), Facebook et Instagram, puis Pinterest et
d'autres. L'IA rédige les brouillons, en français d'abord. Clover facture (essai de 14 jours, puis abonnement mensuel).

### Pourquoi c'est légal et faisable

- **Clover le permet** pour une app Web qui travaille pour le commerçant qui l'a installée, avec son consentement, et
  facturée par Clover. Google offre déjà une app semblable sur le Clover App Market (« Local Inventory by Google »).
- **Google le permet** si TAKATAK est « gestionnaire » de la fiche (jamais propriétaire), avec l'accès API accordé et le
  consentement écrit du restaurant.
- **Meta le permet** si TAKATAK est vérifiée comme « Tech Provider » et passe l'App Review des permissions de
  publication.
- **Le droit québécois** demande surtout : un responsable de la protection des renseignements personnels, une
  évaluation (EFVP) avant de construire et avant d'envoyer des données hors Québec, des consentements clairs, et le
  français d'abord.
- **Le code existe en partie** : connexions Google, Facebook, Instagram et Pinterest, connexion et espaces clients,
  approbations, IA et journal d'audit sont dans takatak-v1; la connexion Clover, la facturation Clover et la séparation
  des apps sont déjà éprouvées dans Food Hub. Ce qui manque : la publication elle-même (rien n'est encore publié par
  API), le stockage du menu et des heures, les consentements et la facturation Clover dans takatak-v1.

### Les risques principaux

1. **Facturation** : un client venu de Clover ne peut rien payer par Stripe sur takatak.ca pour cette app (bloquant).
2. **La « plateforme maîtresse »** : les données Clover servent seulement ce commerçant, dans cette app; jamais dans
   QMAPS, un répertoire ou une place de marché TAKATAK; pas de système de « plugins ».
3. **Accès externes** : l'accès API Google Business Profile n'est pas encore accordé; Meta doit vérifier l'entreprise et
   approuver la publication Instagram. Pas de soumission Clover avant qu'au moins un canal marche vraiment.
4. **Publication sans approbation** : refus probable chez Clover et Google. Approbation par défaut.
5. **Le slogan « le premier backend IA »** : impossible à prouver (des concurrents existent). À remplacer.
6. **Données hors Québec** : la base takatak-v1 est en Irlande. EFVP, ententes écrites, ou déménagement au Canada.
7. **Délais** : Clover, Google et Meta n'ont pas de délai garanti.

### Vos décisions (détails dans [OWNER_DECISIONS.md](OWNER_DECISIONS.md))

| # | Décision | Recommandé |
|---|---|---|
| D1 | Nom | « TAKATAK Présence » |
| D2 | Nouvelle app ou brouillon « on2go » | Nouvelle app Web; brouillon intact |
| D3 | Où tourne l'app | takatak-v1 (takatak.ca), code Clover de Food Hub copié |
| D4 | Adresse | `takatak.ca/clover/...` |
| D5 | Prix | Essai 14 jours, puis 50 $ CA/mois, + 15 $ par marque de plus |
| D6 | Canaux d'abord | Google + Facebook, puis Instagram |
| D7 | Slogan | « Votre resto, partout où on vous cherche. » |
| D8 | Responsable des renseignements personnels | Matthieu, avec une adresse de rôle |
| D9 | Entité légale | Celle du compte développeur Clover (à confirmer) |
| D10 | Région des données | EFVP maintenant; données Clover au Canada avant la soumission |
| D11–D19 | Publication auto, images IA, limite « entreprises des autres », clients Stripe, moment de soumission, marque de commerce, pilotes, avocat, question sur les apps existantes | Voir le fichier |

### Prochaines étapes

1. Vous répondez à D1–D10 (dans la pull request).
2. Vous engagez un avocat du Québec pour les 16 questions de [LEGAL_QUEBEC_CANADA.md](LEGAL_QUEBEC_CANADA.md).
3. Vous lancez la vérification d'entreprise Meta et la demande d'accès API Google (documents à vous).
4. Vous envoyez les questions à Clover (liste dans [RESEARCH_CLOVER.md](RESEARCH_CLOVER.md)).
5. Ensuite : construction de la phase P1 ([ROADMAP.md](ROADMAP.md)) dans des branches séparées, que vous fusionnez.

---

## English

### The app in one sentence

A Clover restaurant installs **TAKATAK** from the Clover App Market; TAKATAK reads its menu, hours and business info from
Clover and publishes them, **at its direction and with its approval**, to **its own** Google (Business Profile, menu,
photos, posts, "Order" button), Facebook and Instagram accounts, then Pinterest and others. AI drafts the content, French
first. Clover bills (14-day trial, then a monthly subscription).

### Why it is legal and feasible

- **Clover allows it** for a web app that works for the merchant who installed it, with consent, billed by Clover. Google
  already has a similar app on the Clover App Market ("Local Inventory by Google").
- **Google allows it** if TAKATAK is the profile's manager (never owner), with API access granted and the restaurant's
  written consent.
- **Meta allows it** once TAKATAK is verified as a Tech Provider and passes App Review for publishing permissions.
- **Québec law** mainly asks for: a person in charge of personal information, a privacy impact assessment before
  building and before sending data outside Québec, clear consents, and French first.
- **Part of the code exists:** Google, Facebook, Instagram and Pinterest logins, workspaces, approvals, AI and audit log in
  takatak-v1; Clover login, Clover billing and app separation are proven in Food Hub. Missing: publishing itself (nothing
  is published by API yet), menu and hours storage, consents and Clover billing in takatak-v1.

### Top risks

1. **Billing:** a Clover-sourced merchant pays nothing through Stripe on takatak.ca for this app (blocker).
2. **"Master platform":** Clover data serves only that merchant, inside this app; never QMAPS, a TAKATAK directory or
   marketplace; no "plugin" system.
3. **Outside approvals:** Google Business Profile API access is not granted yet; Meta must verify the business and approve
   Instagram publishing. No Clover submission before one channel really works.
4. **Publishing without approval:** likely rejection by Clover and Google. Approval by default.
5. **"The first AI backend":** cannot be proven (competitors exist). Replace it.
6. **Data outside Québec:** takatak-v1's database is in Ireland. PIA, written agreements, or move to Canada.
7. **Delays:** Clover, Google and Meta publish no deadlines.

### Decisions

See the table above and [OWNER_DECISIONS.md](OWNER_DECISIONS.md) (FR + EN, one recommended option each).

## Files / Fichiers

| File | What |
|---|---|
| [RESEARCH_CLOVER.md](RESEARCH_CLOVER.md) | Clover terms, policies, OAuth, permissions, webhooks, billing, listing, review — with sources |
| [RESEARCH_GOOGLE.md](RESEARCH_GOOGLE.md) | Google Business Profile: API access, agency rules, menus, hours, posts, reviews, limits |
| [RESEARCH_META_AND_CHANNELS.md](RESEARCH_META_AND_CHANNELS.md) | Facebook, Instagram, Threads, Meta Platform Terms, Pinterest, TikTok, Apple/Bing/Yelp; channel matrix |
| [LEGAL_QUEBEC_CANADA.md](LEGAL_QUEBEC_CANADA.md) | Law 25, PIPEDA, Charter of the French language, Civil Code, consumer law, Competition Act, CASL, food advertising; questions for the lawyer |
| [MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md) | Competitors, safe and unsafe claims, draft Clover listing copy |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How app #3 plugs into takatak-v1 and stays separate from Food Hub; data flow; consent; tokens; tenancy; audit; diagram |
| [ROADMAP.md](ROADMAP.md) | P0 legal prerequisites, P1 MVP, P2 channels, P3 AI content; acceptance checks; Clover submission checklist |
| [OWNER_DECISIONS.md](OWNER_DECISIONS.md) | 19 numbered decisions, FR + EN, with a recommended option |

Sources were read on 2026-10-23. **FACT** marks what a source says; **INFERENCE** marks our reading.
