# KLEAN — Inventaire connecteurs et mise en action — 2026-10-29

**Agent :** KLEAN — pour les clients TAKATAK
**Agence :** TAKATAK — takatak.ca
**Date de l'inventaire :** 2026-10-29, missions 17:26–17:39 EDT
**Signé :** KLEAN, note client TAKATAK
**Dépôts :** Google Drive, dossier « 00 — Opérations TAKATAK » (ce fichier) ; GitHub takatakca/takatak-v1 via PR seulement (voir §9) ; fichier central Drive ID 1vTzXrkvfhmE-zp2iquvQByRE6LXETaWJ mis à jour en place avec un résumé et le lien vers ce rapport.
**Aucun mot de passe, code, jeton ou secret dans ce rapport.**

## Résumé en une page — ce que l'utilisateur a dit, et ce qui est vérifié

L'utilisateur dit, le 2026-10-29 17:26 EDT : il a plein de connecteurs connectés que les agents ne prennent pas en compte, ne connaissent pas, ne voient pas ; il veut tout connecté dans la conversation tout le temps, que Google donne des tâches, des résultats, toute la gang sur une liste, écrite dans Google Drive et dans GitHub, signée comme note client, et mise en action ; et les autres agents doivent, pour faire la même chose, connecter tous ces connecteurs-là sur leur compte Muse pour suivre le processus TAKATAK.

Ce qui est vérifié par cet inventaire, en lecture/statut seulement (aucune création, aucun envoi, aucun paiement, aucun merge/déploiement de site client dans cette mission — le coordinateur de déploiement lancé à 17:14 EDT mène les déploiements, non dupliqué ici) :

- **46 connecteurs distincts inventoriés, un par un** : 15 Google/productivité + 29 commerce/social/dev + GitHub + Vercel.
- **36 connectés avec preuve de statut** (commande status retournant connected/authenticated), **3 non connectés / à reconnecter** (Zoom, Spotify, Shopify), **7 non vérifiables par une commande status ou sans données** (voir §3).
- **L'écart principal n'est pas la connexion, c'est l'usage : au moins 31 connecteurs connectés ne sont jamais utilisés dans le travail TAKATAK documenté.** KLEAN travaille jusqu'ici via Gmail, Google Drive (et Docs via Drive) et GitHub. Vercel est connecté et vérifié, mais pas encore utilisé pour un déploiement vérifié.
- **Google Tasks et Google Calendar sont connectés, mais ne donnent aujourd'hui aucune tâche ni aucun rendez-vous TAKATAK visible** : 0 tâche ouverte TAKATAK, 0 événement à venir TAKATAK (voir §5).
- **Aucun fichier GitHub vérifié n'ordonne d'autoriser, dans la conversation, les connecteurs d'agent de type Gmail, Google Calendar, Google Tasks, Slack, Notion, Todoist, Calendly ou Zapier.** Les « connecteurs » trouvés dans GitHub sont des connecteurs produit, des règles de notes d'agents, et des mentions d'outils (voir §1). Si de telles instructions existent ailleurs, elles ne figurent pas, sous cette forme, dans les fichiers d'instructions GitHub relus.
- **Google Drive contient 335 éléments dans « 00 — Opérations TAKATAK »**, dont le fichier maître, le fichier central, des notes de déploiement du 2026-10-29 et un fichier principal d'hébergement MochaHost → Coolify (voir §2).

## 1. Peigne fin GitHub — instructions trouvées, source par source

Mission lecture seule, 12 dépôts nommés + recherches par code sur l'organisation (61 dépôts listés, fichiers d'instructions seulement, pas de relecture ligne par ligne du code source). Fichier de l'équipe : github-connectors-instructions-2026-10-29.md.

### 1.1 Résultat principal

- Recherche takatak-v1 : « Google Tasks » = 0 résultat ; « connecteur » = 1 seul fichier (docs/GROWTH_SUITE_PASSATION.md).
- Recherche organisation entière : « Todoist » = 0 résultat ; « Calendly » = 0 résultat.
- Aucune instruction Slack, Notion ou Zapier trouvée dans les fichiers d'instructions des dépôts nommés.

### 1.2 Les trois catégories à ne pas confondre

1. **Connecteurs produit** (fonctionnalité livrée au client final, pas des connecteurs de conversation) :
   - BESOINAVOCAT.CA (docs/INTEGRATIONS.md, docs/PROJECT_STATUS.md, docs/TASK_QUEUE.md lots BA-035/BA-036, docs/AGENT_HANDOFF.md point 0 « Connecteurs (29 oct., D-027) ») : chaque avocat relie ses propres comptes Zoom, Outlook et Google Agenda avec actions sur les rendez-vous ; DocuSign et Clio Canada en connexion seulement. Code fait et testé avec des fournisseurs simulés ; **aucun compte réel n'est encore raccordé** ; suite attend le propriétaire et Mike (clé, comptes développeur, variables Coolify, vérification avec un vrai compte, une étape à la fois). Ne pas annoncer un connecteur actif avant cette vérification.
   - takatak-v1 Growth Suite (docs/GROWTH_SUITE_PASSATION.md) : hub de connecteurs, GA4 / Search Console, rapport mensuel, Google Business Profile ; comptes externes à créer par le propriétaire (compte de service Google Cloud, client OAuth Google Business Profile, approbation Google pour l'API Business Profile, qui peut prendre des jours) ; crons produit toutes les 15 minutes (/api/cron/growth-agents) et toutes les heures (/api/cron/growth-reviews-sync).
   - takatak-v1 AHMV (docs/AHMV_PARENT_PREMIUM_BACKEND_CONTRACT.md, section « Google Calendar ») : contrat d'API produit, explicitement non activé en production tant que secrets, configuration et portes de sortie ne passent pas.
2. **Règles de notes et de coordination d'agents** (les seules instructions « à faire par les agents » qui reviennent partout) :
   - takatak-v1 AGENTS.md, section « Work log rule (every agent: Claude, Codex, Cursor, people) » : lire le haut de WORKLOG.md et les PR ouvertes avant de commencer ; revendiquer une ligne « active » ; mettre à jour sa ligne avant de s'arrêter (done, PR #n, blocked: reason) ; jamais de travail non journalisé.
   - takatak-v1 docs/KLEAN-STATUS.md et docs/KLEAN-REPORT-PHASE2-2026-10-28.md : fichier de suivi mis à jour dans Drive ET dans GitHub après chaque étape importante ; vérification courriel toutes les 5 minutes, lecture seulement, sans réponse automatique ; aucun message automatique toutes les 5 minutes à un autre agent ; aucun envoi sans texte exact approuvé ; Google Drive seulement, jamais OneDrive.
   - BESOINAVOCAT.CA AGENTS.md et docs/JOURNAL-AGENTS.md : lire dans l'ordre README, PROJECT_STATUS, TASK_QUEUE, AGENT_HANDOFF, DEPLOYMENT, DECISIONS, RELEVE ; chaque agent laisse une trace avant / pendant / après sur GitHub et Google Drive ; entrées journal DÉBUT / ÉTAPE / FIN / ALERTE / REPRISE, ajout seul, une copie Drive par entrée ; aucun secret dans le journal, ni sur GitHub ni sur Drive ; mettre à jour les cinq documents de statut.
   - Règles identiques de journal de travail dans les AGENTS.md de Alkao.ca, co-work, revers-canada-hope, promohavanaca, on2goca, mimtcaapp et isexy.
3. **Mentions d'outils** (à ne pas prendre pour des connecteurs à autoriser) : « connecteur GitHub » (outil de lecture GitHub utilisé par KLEAN, cité dans Alkao, co-work, mimtcaapp) ; « connecteur Opera » (navigateur, signalé non connecté dans on2goca docs/AGENT_HANDOFF.md) ; « Stripe connector » (compte Stripe atteint par un autre agent, signalé comme inadéquat / autre compte ALKAO.CA dans Alkao et promohavanaca).

### 1.3 Horaires et rapports trouvés (rythmes, pas des connecteurs de conversation)

- Vérification courriel toutes les 5 minutes (takatak-v1, KLEAN).
- Crons Growth Suite toutes les 15 minutes et toutes les heures (takatak-v1, produit).
- Sauvegarde nocturne (takatak-v1 DEV-TODO) ; ré-audits SEO hebdomadaires proposés ; rapport mensuel Growth Suite.
- Cron isexy quotidien à 04:13 UTC, non confirmé, secret ISEXY_CRON_SECRET non vérifié.
- Tâche planifiée revers-canada toutes les 30 minutes, bloquée, en attente d'un jeton de production vérifié.
- Cron Alkao chaque minute (MochaHost) ; purge EMPLOIDIRECT toutes les 24 heures ; filtre « Ouvert maintenant » on2go toutes les minutes sur page ouverte (produit).
- Rapports récurrents demandés aux agents : fichier de suivi KLEAN (Drive + GitHub, après chaque étape importante), cinq documents de statut BesoinAvocat, notes de relève avant chaque fin de session (promohavanaca, LOCACTIF, EMPLOIDIRECT).

### 1.4 Autres instructions GitHub notables, par dépôt

- takatak-v1 README.md : toutes les données du tableau de bord sont des données de démonstration/fondation ; Metricool, Upmind, TryHolo, QMAPS, FLEXS, Supabase et Stripe ne sont PAS connectés ; ne jamais annoncer « connected » sans un vrai appel API documenté et réussi. Moteur de rapports (Phase 10) : export PDF, livraison courriel, liens publics, workers planifiés, sync analytics et résumés IA, tous NON actifs.
- takatak-v1 docs/TASK_QUEUE.md : le coordinateur revoit et merge la PR #182, aucun push direct non-coordinateur sur main ni déploiement de production ; activer le compte de service Google et vérifier Search Console ; planifier les imports avec quotas et approbations une fois V1 auth/go-live stable.
- takatak-v1 docs/DEV-TODO.md : TK-021 Google Search Console OAuth (le propriétaire crée l'application OAuth Google Cloud) — instruction produit, pas une autorisation de connecteur de conversation.
- droneair : livraison Gmail produit (Google Workspace/Gmail API, variables dans l'environnement de déploiement, jamais dans le dépôt) ; porte de production : configurer les secrets OAuth Google Workspace/Gmail et faire un vrai envoi depuis info@drone-air.ca — non vérifié à ce stade, aucun courriel réel envoyé ou vérifié.
- promohavanaca AGENTS.md : « Pour être relancé automatiquement, utiliser un orchestrateur externe autorisé : ce document ne peut pas redémarrer un agent » — seule instruction de relance automatique trouvée, sans connecteur nommé.
- LOCACTIF.CA docs/WORDPRESS_RECOVERY.md : ne pas importer réservations, commandes, abonnements, données personnelles ni ressources d'authentification au moyen de ce connecteur ; TAKATAK doit rester l'autorité d'identité quand ses contrats API seront connus.
- revers-canada-hope docs/OWNER_ACTIONS.md : renvoie au fichier principal Drive « 00 — Opérations TAKATAK » pour la migration MochaHost → Coolify ; dépôt public, aucune valeur de secret, seulement noms de clés, paramètres et étapes.
- Fichiers ignorés, non suivis : 2 éléments dans cette mission GitHub (dont docs/COPIE-GOOGLE-DRIVE-2026-10-26.md dans BESOINAVOCAT.CA et une entrée dans docs/KLEAN-STATUS.md) — conformément à la règle, ils ne sont ni cités ni résumés ici, seule cette mention figure.
- Limite : ce peigne fin ne prouve pas une absence absolue dans les 61 dépôts ; il prouve une recherche ciblée sur les fichiers d'instructions des 12 dépôts nommés + recherches par code sur les termes clés. Les références Drive citées dans GitHub n'ont pas été ouvertes dans cette mission GitHub seulement.

## 2. Peigne fin Google Drive — instructions et tâches

Mission lecture seule, dossier « 00 — Opérations TAKATAK » (ID 11B5CeNU_lZgO2VFA_fzejoLJNkSZdnv-), 335 éléments listés en 7 pages de 50 (329 fichiers + 6 dossiers). Fichier de l'équipe : drive-instructions-2026-10-29.md (607 lignes, inventaire complet des 335 éléments).

### 2.1 Fichier maître des clients TAKATAK

- Titre : « KLEAN — Fichier maître des clients TAKATAK.md », ID 1L9dYxNSy3vFgJqniV3j_HdyTuqz4hC4x, modifié 2026-10-27 05:53 EDT.
- Sections : Périmètre KLEAN ; Clients KLEAN — 29 domaines actifs ; Domaines actifs MochaHost NON inclus pour l'instant (13 domaines, sans confirmation) ; Règles de travail.
- Périmètre : KLEAN = clients/entreprises TAKATAK, SEO, visibilité, marketing ; pas d'opérations restaurants (agent Lévesque) ; travail partagé vers Drive et GitHub ; TAKATAK-V1 reste le système de référence.
- Échéances notables : locactif.ca 2026-12-14 (à réconcilier, voir §2.2), isexy.ca 2027-01-26, eyeclean.net 2027-02-01, r2nette.ca 2027-02-10, globesecure.ca 2027-02-11, qmaps.ca 2027-02-24, mimt.ca 2028-02-21, co-work.ca 2034-03-02, les autres en 2027.
- Règles : travail signé KLEAN, signalement au boss en cas de doute de frontière, aucun mot de passe dans un document/chat/commit (coffre seulement), aucun paiement/achat/suppression irréversible sans confirmation claire de Matt.

### 2.2 Fichier central de suivi — « où on en est »

- Titre : « KLEAN — Notes de suivi — où on en est.md », ID 1vTzXrkvfhmE-zp2iquvQByRE6LXETaWJ, créé 2026-10-27 06:36 EDT, modifié 2026-10-29 17:28 EDT au moment du peigne fin.
- Règle de centralisation (instruction utilisateur 16:14 EDT) : tout centraliser dans ce central Drive + GitHub takatak-v1 docs/KLEAN-STATUS.md via PR seulement (règle propriétaire 2026-10-10) ; notes AVANT / PENDANT / APRÈS en tout temps ; signature KLEAN ; date, heure et point d'arrêt exact à chaque interruption.
- Passe « Reprise travaux clients » : relecture du central, reprise des points en attente, agents en parallèle sur projets distincts, vérification indépendante, corrections en branche + PR ; rythme passé d'horaire à toutes les 10 minutes dès 2026-10-29 17:02 EDT.
- Prochaines étapes, dans l'ordre, selon le central : (1) réponse à Matt sur courriel récent — BLOQUÉE (contrôle de sécurité non passé ; l'utilisateur doit donner lui-même destinataire et texte exact) ; (2) confirmer les noms de dépôts des 3 clients non trouvés et des 3 incertains avant toute création ; (3) vérifier locactif.ca en navigateur normal ; (4) mettre à jour le suivi après chaque étape, Drive ET GitHub ; (5) Cuba Connection par résumés seulement (Drive) et design système seulement (GitHub).
- En attente / bloqué : décision isexy (social amitié/conversation vs retour rencontre) ; tracker Cuba Connection : 13 contacts sur 13 à compléter (origine, activité, statut, résumés seulement).
- Reprise à faire (limite levée) : notes GitHub de vague pour promohavanaca, on2goca, mimtcaapp, droneair, takatak-v1 ; checklist co-work ; implémentation locactif ; revues PR (takatak-v1 #227/#229, logs CI promohavanaca, mimtcaapp #83/3581232/#77, droneair CI + issue #2, on2goca checks + PR #6 + HEAD main) ; central GitHub via PR.
- Décisions propriétaire en attente : revers-canada (séquence PR #6 vs #7) ; droneair (#7 seule, fermer #5 comme remplacée) ; on2goca (merge PR #13 par le propriétaire seulement, après checks) ; emploidirect (périmètre identité takatak-v1 #201 à confirmer par écrit) ; promohavanaca (lire les logs des 2 échecs CI du 2026-10-29 avant tout fix) ; alkao (fermer PR #53 ou la déplacer vers promohavanaca ; suite issue #84 par le propriétaire seulement) ; co-work (déblocage Actions/runners propriétaire, puis 3/3 CI verts avant déploiement preview).
- Objectif déploiement (17:13 EDT) : rattacher chaque dépôt à son client, déployer, tout mettre en ligne avec auto-déploiement ; priorité aux 4 sites en Apache 403 (locactif.ca, ramassedebris.ca, flexs.ca, emploidirect.ca). Conflit noté dans le central lui-même : corps de passe 17:01 EDT interdisant merge/déploiement par KLEAN vs autorisation 17:14 EDT pour les sites clients (takatak-v1 restant PR-only) — tranché ensuite par la mise à jour des instructions de passe du 2026-10-29 17:21 EDT en faveur de l'autorisation 17:14 EDT, mais aucun merge/déploiement exécuté aux passes 17:12 et 17:22 EDT selon le central au moment du peigne fin.
- Échéances / rythmes du central : jeton GitHub expirant vers 2026-11-04 (régénération par le titulaire) ; renouvellement locactif à réconcilier : 2026-11-03 (docs dépôt) vs 2026-12-14 (MochaHost) ; vérification de renouvellement 2026-12-01 encore prévue ; vérification courriel toutes les 5 minutes, lecture seulement, en cours.

### 2.3 Autres fichiers d'instructions / mandats / checklists (titre, ID, date, thèmes — sans contenu opérationnel détaillé reproduit)

L'équipe Drive a déclaré que deux résultats d'outils pendant sa lecture ont été signalés comme n'ayant pas passé un contrôle de sécurité ; elle n'a donc pas reproduit le contenu opérationnel détaillé (étapes pas à pas, valeurs de vérification, commandes, formules, textes de messages) de ces fichiers. Son rapport local donne, pour chaque fichier, titre, ID Drive, date de modification et thèmes/sections. L'agent principal doit ouvrir directement les fichiers concernés avant toute décision. Rien de ce qui suit n'est une consigne à exécuter : c'est un relevé de sources.

- Instructions permanentes — LesGroupes (ID 1AcPocVHgeWxD4mHo8DE7wf-ESv9OSzqW, 2026-10-27 05:33 EDT) : périmètre autres entreprises ; protocole courriel coordination toutes les 30 minutes ; règles permanentes de Matt ; images Canva. Hors KLEAN, coordination inter-agents.
- Instructions permanentes — Lévesque (ID 1cfuj73vqLOP_vIGUVd8fKFm6tcNpQJQc, 2026-10-27 05:33 EDT) : périmètre restaurants, 18 marques ; coordination anti-doublon ; standard de finition commerciale ; images Canva + IA gratuits (dont 5 images Clover manquantes) ; protocole 30 minutes. Périmètre restaurants, hors KLEAN.
- Instructions Claude Code — Projets TAKATAK (ID 1L0ZH5GbB69qctkBuThCnr1636Y0yOnKC, 2026-10-26 02:26 EDT) : règles générales ; projets Fidélité Reward (priorité), POS caisse, borne, Food Hub, ST4FF, MEV.QUEBEC, 4CCOUNTING, REW4RD ; ce que Claude Code ne fait PAS.
- Activation générale — consignes agents et robots (ID 1kGOh1TMrMVlljAupfK7ydyLOTvtiZ_zE, 2026-10-28 18:35 EDT) : standard fonctionnel ; consignes par agent (Lévesque, LesGroupes, SOCIO/Pierre + dev) ; texte « START HERE » robots/ChatGPT ; preuves attendues le 2026-10-28 — document daté, à revalider avant reprise.
- COMMENCE ICI — images et vidéos (ID 1hNZ2Gu4xgi7IBcBVRhdayhMXz9IOCr0q, 2026-10-28 18:36 EDT) : chaîne de production (pack, Runway, ElevenLabs, Twelve Labs, Jockey, dépôt, registre) ; prochaines vidéos par compagnie ; standard LUXE + FONCTIONNEL, photos de plats toujours réelles, aucun prix à l'image, aucun secret dans les fichiers.
- BesoinAvocat — Reprise et instructions — 2026-10-26 (ID 1jJxjVbk-mPzN9RHO0KfO-1rIH7ZbsR6k, 2026-10-28 06:02 EDT) ; BesoinAvocat — Direction (ID 1Ykbxxja0Flm3BWVsdfg6kiAOByULsviN, 2026-10-28 04:16 EDT) et Direction v2 (ID 10tF4WCHvZ_erQY-wX0657wGKUwb1gKk_, 2026-10-28 04:16 EDT) ; ARRÊT VITRINE (ID 1qKiwYE2WKHVZvyiCJpyHCmERPGqdyZy-, 2026-10-28 04:12 EDT) : refonte « plateforme IA » du 2026-10-27 refusée, propriétaire reprend la vitrine, aucun agent ne modifie les zones listées sans instruction écrite du propriétaire.
- Boîte courriel TAKATAK — arborescence, instructions et sections comptables (ID 1QbcGRKvIL5lybqtuPruRyc2oeBLGd8ig, 2026-10-26 20:06 EDT) : règles de classement permanentes ; tâche restante notée : ~19 746 messages restant à classer (surtout « Updates » et « Primary »), prochaine passe : analyse des expéditeurs dominants, puis étiquettes restantes.
- Écrans de commande / ON2GO — 2026-10-29 (périmètre Food Hub / restaurants, côté Lévesque, pas KLEAN — à arbitrer avant toute action KLEAN) : notes « PRÊT À DÉPLOYER CE SOIR », « fusionne aussi la #109 avant de déployer », et document « 54 écrans + espace client ON2GO (Mon compte) » (2026-10-29 16:40 EDT).
- Déploiement 5/10 (ID 1bnGgCWMgJdHXOkAAfp284H_XX3X2Jqep, 2026-10-29 17:19 EDT ; promohavanaca + on2goca), 7/10 (ID 1USzHKVwPQ0lk5i3yP3aM9k4Eg0d37K95, 2026-10-29 17:17 EDT ; cubafood, ahmverdun, ocarinaspa), 8/10 (ID 11S21N6x1wnAlK52znBb2NnqnyBikzHWg, 2026-10-29 17:17 EDT ; globesecure, isexy, r2f), 9/10 (ID 1dnTJFgdWp6q-q_sO_k4mGxxfbi8KAoa7, 2026-10-29 17:25 EDT ; qmaps, rentauto, mielaissa, taxichambly) : cartes de déploiement par repo, checklists propriétaire panneau, reprise à la levée du 429, auto-déploiement code/config vs panneau.
- Hosting MAIN FILE — MochaHost → Coolify (Google Doc, ID 1wTC-CFM38Phq6BNLvF6vE2OE7pQjsxBNxtQ8_ET3DAE, 2026-10-29 04:26 EDT, lu en extrait) : migration vers deux serveurs Coolify avec auto-déploiement GitHub ; règle : seul le DNS de chaque site pointe vers Coolify, courriel/FTP/webmail/cPanel restant chez MochaHost ; étiquettes OWNER (comptes, clés, paiements, approbations, merges, WHM), CLAUDE (agent, en attente d'un item OWNER), DONE ; tableau par site (hébergement, auto-déploiement, zone DNS, courriel, état, items ouverts) ; items OWNER numérotés, renvoi vers docs/OWNER_ACTIONS.md par dépôt. Aucune valeur de secret reproduite (le fichier lui-même n'en écrit pas, noms de clés seulement).
- Finition PPP — mandat et checklist de clôture (ID 1WEL0gmYcOxFEvgTL-r6d59jA2EyL56tz, 2026-10-28 02:27 EDT, périmètre restaurants) ; Support TAKATAK — spec et Infrastructure Support (2026-10-27) ; File de complétion (échéances 27–28 octobre, dépassées, revalidation nécessaire) ; Arriéré — 20 prochains items actionnables ; Notes au prochain agent ; Blocages et décisions ; À FAIRE PAR MATT — la liste exacte ; TÂCHES MATT — Bols promo et arrêt marketing Uber-DoorDash (périmètre restaurants) ; NORME — Architecture Drive TAKATAK (un seul MAIN, chaque client autonome et vendable).
- Fichier ignoré, non suivi : 1 élément dans le peigne fin Drive — conformément à la règle, il n'est ni cité ni résumé, et sa ligne d'inventaire dans le rapport local est remplacée par « fichier ignoré, non suivi » (son ID n'apparaît nulle part dans le rapport).
- Registre d'accès non ouvert : « 2026-10-26 13:04 — Registre maître des accès — tous les comptes » (ID 11NRip0L3zwxAd2a00yaYFU60FMlhL4ed, modifié 2026-10-28 14:03 EDT) — métadonnées seules, contenu volontairement non consulté.
- Sous-dossiers (6, contenu non listé) : Photos DoorDash PLAINES — Po Poulet NDG ; EMPLOIDIRECT.CA — Développement et relève ; Calendrier janvier 2027 — réécrit ; TAKATAK-MUSE — pack GitHub (local) ; Bluesky ; Comptes IA — TAKATAK.
- Aucun calendrier Google Agenda distinct trouvé dans ce dossier (aucun fichier d'agenda ; les rythmes sont ceux écrits dans les notes elles-mêmes).
- Arbitrages relevés, non tranchés par l'équipe Drive : (a) interdiction merge/déploiement (passe 17:01 EDT) vs autorisation déploiement 17:14 EDT ; (b) autorisations connecteurs 17:23 EDT (une par une, jamais groupées) vs demande 17:26 EDT (tout autoriser, liste unique) ; (c) renouvellement locactif 2026-11-03 vs 2026-12-14 ; (d) périmètre KLEAN clients vs périmètre restaurants pour Food Hub / écrans / PPP / DoorDash / Uber Eats.

## 3. Inventaire complet des connecteurs — toute la gang, un par un

Méthode : pour chaque connecteur, doc lue dans /opt/hatch/connectors/<nom>/CONNECTOR.md, puis commande status exécutée comme la doc l'indique, le 2026-10-29 après-midi EDT. GitHub et Vercel non re-testés en rafale : repris tels quels de la vérification de l'agent principal du 2026-10-29 17:23 EDT (connectés/authentifiés). « Usage KLEAN » = usage vérifié dans le travail client TAKATAK documenté ; un usage non documenté ailleurs n'est pas affirmé. Statut vérifié prouve la connexion, pas le contenu (aucune boîte, agenda, liste ou projet n'a été lu dans les missions statut seulement, sauf l'inventaire Tasks/Calendar du §5).

### 3.1 Déjà utilisés par KLEAN dans le travail client

| Connecteur | Statut vérifié | Ce qu'il peut faire | Usage KLEAN |
|---|---|---|---|
| Gmail | Connecté | Rechercher, lire, trier et envoyer des courriels | Oui — vérification courriel takatak.ca@gmail.com toutes les 5 minutes, tri des promotions, réponses de coordination |
| Google Drive | Connecté | Trouver, téléverser, télécharger, organiser et partager des fichiers Drive | Oui — notes de suivi dans « 00 — Opérations TAKATAK », fichier central, tracker Cuba Connection |
| Google Docs | Connecté | Lire, créer et modifier des documents Google Docs | Oui, indirectement via Drive — les notes de suivi KLEAN déposées dans Drive sont des documents Google Docs ; aucune création directe via la commande Docs n'est vérifiée |
| GitHub | Connecté / authentifié (17:23 EDT, takatakca via GitHub MCP) | Repos, fichiers, issues, PR, branches, merges, pushes | Oui — audits, notes, PR, revues, déploiements clients (coordinateur 17:14 EDT) |
| Vercel | Connecté / authentifié (17:23 EDT) | Projets, déploiements, logs, domaines, DNS, variables, protection | Vérifié connecté, mais pas encore utilisé pour un déploiement vérifié ; ses autorisations sont celles de la capture de l'utilisateur (toutes sur « Allow » sur les lignes visibles) |

### 3.2 Connectés mais jamais utilisés par KLEAN — Google et productivité (12)

| Connecteur | Statut vérifié | Ce qu'il peut faire | Écart |
|---|---|---|---|
| Google Calendar | Connecté | Lire et gérer les agendas Google (événements, disponibilités, invitations) | Connecté mais jamais utilisé par KLEAN |
| Google Sheets | Connecté | Lire et modifier des feuilles de calcul (cellules, formules, onglets) | Connecté mais jamais utilisé par KLEAN |
| Google Slides | Connecté | Lire et modifier des présentations | Connecté mais jamais utilisé par KLEAN |
| Google Forms | Connecté | Créer/modifier des formulaires et lire leurs réponses | Connecté mais jamais utilisé par KLEAN |
| Google Contacts | Connecté | Rechercher et gérer les contacts Google | Connecté mais jamais utilisé par KLEAN (les contacts connus — Matt, Lévesque — viennent de la mémoire/contexte, pas d'une lecture vérifiée via ce connecteur) |
| Google Tasks | Connecté | Gérer les listes de tâches Google (échéances, complétion) | Connecté mais jamais utilisé par KLEAN (la reprise passe par un cron, pas par Google Tasks) |
| Notion | Connecté (serveur Notion MCP 1.2.0) | Pages, notes et bases de données Notion | Connecté mais jamais utilisé par KLEAN (le travail partagé passe par Drive et GitHub) |
| Todoist | Connecté (serveur Todoist MCP 13.8.0) | Tâches et projets Todoist (sections, étiquettes, rappels, filtres) | Connecté mais jamais utilisé par KLEAN |
| Calendly | Connecté | Liens de réservation, types d'événements, réunions réservées | Connecté mais jamais utilisé par KLEAN |
| Asana | Connecté (serveur Asana MCP) | Projets, tâches, portefeuilles et équipes | Connecté mais jamais utilisé par KLEAN |
| Linear | Connecté (serveur Linear MCP 1.0.2, lecture) | Enjeux logiciels, projets et cycles | Connecté mais jamais utilisé par KLEAN |
| Zapier | Connecté (serveur Zapier MCP 1.0.0) | Actions automatisées vers les applications connectées, y compris celles sans connecteur propre | Connecté mais jamais utilisé par KLEAN |

### 3.3 Connectés mais jamais utilisés par KLEAN — commerce, social et dev (19, dont 2 disponibles par conception)

| Connecteur | Statut vérifié | Ce qu'il peut faire | Écart |
|---|---|---|---|
| Slack | Connecté | Chat de travail via le serveur MCP officiel de Slack | Connecté mais jamais utilisé ; aucune coordination TAKATAK ne passe par Slack à ce jour |
| Figma | Connecté | Designs et systèmes de design, ressources, modifications revues | Connecté mais jamais utilisé ; pertinent pour les maquettes clients |
| Lovable | Connecté | Lire, créer, modifier et déployer des projets Lovable | Connecté mais jamais utilisé ; hors du flux TAKATAK actuel (GitHub/Coolify) |
| Replit | Connecté | Trouver, créer, mettre à jour et publier des apps Replit | Connecté mais jamais utilisé ; même remarque que Lovable |
| Canva | Connecté | Designs, images, ressources, exports, modèles et kits de marque | Connecté mais jamais utilisé ; le plus directement utile pour le marketing/visibilité TAKATAK |
| Stripe | Connecté | Paiements de l'entreprise (clients, produits, paiements, factures, abonnements) | Connecté mais jamais utilisé ; KLEAN ne fait aucun paiement sans approbation et aucun encaissement client documenté |
| Evernote | Connecté | Notes, carnets, Spaces, étiquettes, tâches, pièces jointes | Connecté mais jamais utilisé ; les notes sont centralisées dans Google Drive par règle utilisateur |
| Granola | Connecté (binaire granola-cli, pas granola) | Notes, résumés et transcriptions de réunions passées (lecture seule) | Connecté mais jamais utilisé ; les suivis TAKATAK passent par Drive/GitHub |
| Gumroad | Connecté (identifiants stockés — cela prouve des identifiants stockés, pas que Gumroad répond ; le premier vrai appel l'établirait) | Vendre des produits numériques et abonnements pour créateurs | Connecté mais jamais utilisé ; aucun produit client TAKATAK documenté dessus |
| Runway | Connecté (même réserve que Gumroad) | Générer et modifier vidéo, images et audio, exécuter des workflows sauvegardés | Connecté mais jamais utilisé pour les visuels clients à ce jour |
| Meta Business Manager (meta_ads) | Connecté | Publicité Facebook/Instagram (comptes, campagnes, budgets, résultats) et politique publicitaire Meta | Connecté mais jamais utilisé ; directement pertinent pour la visibilité/marketing TAKATAK, aucune campagne KLEAN documentée |
| Messenger | Connecté (vérification de la doc, pas de status classique) | Lire, rechercher et envoyer des messages Messenger personnels | Connecté mais jamais utilisé dans le travail client vérifié ; envoi en son nom toujours soumis à approbation du texte exact |
| Instagram | Connecté (2 comptes professionnels liés : festiiice.ca, cubaresort) | Profils, publications, commentaires, stories, flux, insights ; publier/planifier | Connecté mais jamais utilisé ; comptes liés, dont un nom lié à un client (cubaresort), aucune action KLEAN documentée dessus |
| Instagram Messages | Connecté (les 2 mêmes comptes, connected: true) | Messages privés Instagram et demandes en attente | Connecté mais jamais utilisé ; aucun message KLEAN documenté |
| Threads | Connecté (2 comptes liés : festiiice.ca, cubaresort) | Profils, publications, réponses, flux, activité, insights ; publier | Connecté mais jamais utilisé ; aucune publication KLEAN documentée |
| Facebook | Connecté (compte lié, nom et ID non reproduits ici) | Profils, timelines, publications, groupes, événements ; publier/commenter, gérer les Pages | Connecté mais jamais utilisé ; pertinent pour la visibilité clients, inutilisé |
| Tailscale | Connecté (serveur controlplane.tailscale.com, appareils muse* visibles, adresses non reproduites) | Joindre ce VM au réseau privé de l'utilisateur (tailnet), client sortant seulement | Connecté mais jamais utilisé ; aucun service client TAKATAK atteint via ce chemin à ce jour |
| FlightAware | Disponible (service géré Muse, aucun compte à connecter) | Horaires, statut en direct, positions, trajectoires, activité aéroports | Pas un écart : disponible par conception ; hors périmètre client TAKATAK (sauf suivi de vol ponctuel) |
| Google Health Connect | Données synchronisées (daily-metrics 1107 enregistrements, 2026-10-20 au 2026-10-29 ; sleep et workout à 0) | Données santé synchronisées depuis un téléphone Android | Pas un écart de connexion : synchronisation Android active ; hors périmètre TAKATAK (données personnelles, pas client) |

### 3.4 Non connectés / à reconnecter (3)

| Connecteur | Statut vérifié | Action si l'utilisateur le veut |
|---|---|---|
| Zoom | À reconnecter — erreur oauth.refresh-token, reauthorization_required (2 essais) | Réautorisation requise avant tout usage ; lien de connexion exact dans le rapport de l'équipe commerce/social/dev |
| Spotify | Non connecté | Connexion seulement si voulue ; hors périmètre client TAKATAK (musique personnelle) ; lien exact dans le rapport de l'équipe |
| Shopify | Non connecté (serveur MCP accessible, outils listés quand même) | Connexion seulement si un client TAKATAK a une boutique à gérer ; lien exact dans le rapport de l'équipe |

### 3.5 Non vérifiables par une commande status, ou sans données (7)

| Connecteur | Statut | Remarque |
|---|---|---|
| Threads Messages | Non vérifiable par status, doc lue | Connexion séparée de Threads ; la doc précise que connect-url retourne un lien même si déjà connecté, donc le lien seul ne prouve rien ; disponibilité à confirmer à l'usage, pas par un lien |
| Ticketmaster | Non vérifiable par status, doc lue | La doc dit « needs no user setup » et ne définit aucune commande status ; ce n'est pas un compte à connecter ; recherche d'événements seulement, achat dans le navigateur ; hors périmètre TAKATAK |
| Places | Non vérifiable par status, doc lue | « no account to connect » ; détails enrichis par ID de lieu seulement ; potentiellement utile pour les fiches d'établissements clients, inutilisé |
| Shop Pay | Non vérifiable par status, doc lue | Vérification via les outils wallet, hors périmètre statut seul et non exécutée ici ; KLEAN ne fait aucun achat/paiement de toute façon |
| Shopify UCP | Non vérifiable par status, doc lue | « needs no merchant sign-in » ; commandes sur panier/commande, pas sur une connexion ; achat hors périmètre KLEAN |
| Meta Catalog | Non vérifiable par status, doc lue | « needs no sign-in » ; accès régi par une autorisation utilisateur ; recherche produits, hors travail client TAKATAK |
| Apple Health | Statut non vérifiable comme connexion active | Commande status retournée, mais 0 enregistrement dans toutes les catégories ; aucune donnée synchronisée ; iPhone non confirmé comme appareil apparié ; hors périmètre TAKATAK |

### 3.6 Comptes

- Total inventorié : 46 (15 + 29 + GitHub + Vercel).
- Connectés avec preuve de statut : 36 (15 Google/productivité + 19 commerce/social/dev + GitHub + Vercel — en comptant FlightAware et Google Health Connect comme disponibles/synchronisés dans les 19).
- Non connectés / à reconnecter : 3 (Zoom, Spotify, Shopify).
- Non vérifiables par status ou sans données : 7.
- Jamais utilisés dans le travail TAKATAK documenté : au moins 31 connecteurs connectés (12 Google/productivité + 19 commerce/social/dev), Vercel en plus pour un déploiement vérifié.

## 4. Métriques et rapports disponibles — seulement ceux vérifiés, pas d'invention

Cet inventaire était en statut/lecture seulement. Les chiffres ci-dessous sont les seuls vérifiés ; les autres métriques ne sont PAS rapportées comme des nombres, parce qu'elles n'ont pas été lues.

- Google Drive : 335 éléments dans « 00 — Opérations TAKATAK » (329 fichiers + 6 dossiers), listés en 7 pages de 50 jusqu'à épuisement des jetons.
- Google Tasks : 3 listes, 2 tâches ouvertes, 1 tâche terminée visible — aucune tâche ouverte TAKATAK (voir §5).
- Google Calendar : 3 calendriers consultés (principal, Family, Holidays in Cuba), fenêtre 2026-10-29 au 2026-12-31 — 0 événement à venir TAKATAK (voir §5).
- GitHub : états vérifiés dans les vagues précédentes et dans cet inventaire (mains, PR ouvertes, CI) — non re-vérifiés ici en rafale à cause du 429 récurrent ; les PR vérifiées par le coordinateur d'implémentation 17:02–17:11 EDT restent : alkao #103 et #104, locactif #1, co-work #8, revers-canada #8 et #9, emploidirect #5 et #6, toutes ouvertes et non mergées à ce moment-là.
- Vercel : projets et déploiements lisibles via list_projects / list_deployments, mais non lus dans cette mission statut seulement — aucun chiffre de déploiement n'est donc affirmé ici.
- Gumroad (ventes, versements), Stripe (paiements, factures), Meta Business Manager (campagnes, résultats), Canva/Figma (designs), Notion/Todoist/Asana/Linear (projets/tâches) : métriques disponibles via leurs connecteurs d'après leurs docs, mais NON lues dans cette mission — aucun nombre n'est inventé. Les lire est l'étape suivante du plan d'action (§6), pas un fait de cet inventaire.
- Métriques produit dans GitHub (Growth Suite GA4/Search Console, SEO, rapports) : fondation seulement, données de démonstration, aucune connexion réelle vérifiée dans takatak-v1 README.md — ne pas les présenter comme des métriques réelles.

## 5. Google Tasks / Calendar — pour que Google « donne des tâches »

Inventaire lecture seule, 2026-10-29 17:28–17:31 EDT, comptes connectés, aucune création, modification ou invitation, aucune approbation requise rencontrée. Fichier de l'équipe : google-tasks-calendar-2026-10-29.md.

### 5.1 Listes Google Tasks

| Liste | Tâches ouvertes | Tâches terminées visibles | Dernière mise à jour de la liste |
|---|---|---|---|
| My Tasks (liste par défaut) | 2 | 1 | 2026-08-07 |
| Fieldy | 0 | 0 | 2025-08-04 |
| Fieldy (deuxième liste du même nom) | 0 | 0 | 2026-08-06 |
| Total | 2 | 1 | — |

### 5.2 Tâches ouvertes — pertinentes au travail TAKATAK : aucune

Les 2 seules tâches ouvertes, toutes deux dans « My Tasks », ne concernent pas le travail TAKATAK :
- « Pay bill from Fig Financial » — échéance : 2026-08-07 (échue)
- « Pay bill from Google Play » — échéance : 2025-09-07 (échue)

Contexte seulement (tâche terminée, pas ouverte) : « Pay bill from Mochahost », terminée le 2026-08-06 (échéance 2025-08-07), dans « My Tasks » — concerne l'hébergement, mais close, pas une tâche TAKATAK ouverte.

Conséquence : à ce jour, Google Tasks ne contient aucune tâche de travail TAKATAK visible. Il n'existe pas de liste dédiée TAKATAK, et aucune tâche ouverte ne porte sur un client, un déploiement, le SEO ou la visibilité. Pour que Google « donne des tâches » de façon visible, il faudra créer une liste / des tâches TAKATAK — ce qui sort du périmètre lecture seule de cette mission et n'a donc pas été fait.

### 5.3 Événements Calendar à venir — pertinents au travail TAKATAK : aucun

- Calendriers consultés : principal (takatak.ca@gmail.com), Family, Holidays in Cuba.
- Fenêtre principale : 2026-10-29 au 2026-11-19 (53 événements) et, pour vérification élargie, 2026-10-29 au 2026-12-31 (principal : 11 événements ; Family : 190 événements ; Holidays in Cuba : 2 événements).
- Recherche par mots-clés : TAKATAK, client, SEO, déploiement, GitHub, noms de clients, Cuba, domaine, renouvellement, Matt, Lévesque — aucun résultat pertinent au travail TAKATAK.
- Les événements trouvés sont uniquement personnels / calendaires généraux (rappels de paiement récurrents, événements récurrents personnels, jours fériés, dont le passage à l'heure d'hiver le 2026-11-01 et Noël le 2026-12-25). Leurs titres détaillés ne sont pas reproduits ici, car ils ne relèvent pas du travail TAKATAK.
- Accès complet aux 3 calendriers, pas de limite ; aucun élément « approbation requise, non effectuée ».

Recommandation de l'équipe (à valider par le parent / l'utilisateur, hors périmètre lecture seule) : créer, avec approbation de l'utilisateur, une liste Google Tasks dédiée TAKATAK et y inscrire les points en attente connus (déploiements clients, vérifications de renouvellement), ainsi que des événements Calendar pour les échéances datées (renouvellement locactif à réconcilier, expiration du jeton GitHub vers 2026-11-04, vérification de renouvellement 2026-12-01).

## 6. Plan d'action — quoi connecter/autoriser en premier, quoi utiliser dès maintenant

Ordre proposé, sans créer, payer ou envoyer quoi que ce soit dans cette mission — la mise en action elle-même relève des passes suivantes et du coordinateur de déploiement 17:14 EDT, non dupliqué ici :

1. **Déjà en action, à garder en premier :** Gmail, Google Drive, GitHub, Vercel (vérifiés connectés). Leur prompt d'autorisation apparaît quand un outil l'exige ; l'utilisateur met « autoriser en tout temps » à ce moment-là, un connecteur à la fois, jamais groupés (plan 17:23 EDT), sauf si l'utilisateur confirme explicitement le passage au « tout autoriser » du 17:26 EDT — arbitrage à trancher par l'utilisateur, relevé par les équipes Drive et GitHub.
2. **Activer pour le suivi TAKATAK, dès maintenant, en lecture puis en écriture avec approbation :** Google Tasks (créer une liste TAKATAK dédiée, y inscrire déploiements, renouvellements, revues PR), Google Calendar (échéances : renouvellement locactif, jeton GitHub 2026-11-04, vérification 2026-12-01, jalons de déploiement), Google Sheets (suivi clients, un tableau par client ou un tableau maître, sans écraser le fichier maître Drive), Google Contacts (annuaire clients, à vérifier via le connecteur au lieu de la seule mémoire).
3. **Activer pour la visibilité / marketing clients :** Canva (visuels), Figma (maquettes), Meta Business Manager + Facebook/Instagram/Threads (publication et publicité, avec approbation du texte exact avant tout envoi/publication), Runway (vidéos/images, en lien avec la chaîne COMMENCE ICI), Granola (comptes-rendus de réunions, lecture seule).
4. **Activer pour la gestion de projet, au choix de l'utilisateur (ne pas activer les quatre en même temps sans décision) :** Todoist OU Asana OU Linear OU Notion — un seul outil de suivi de projet en plus de Google Tasks, pour éviter quatre listes parallèles. Calendly ensuite, si des rendez-vous clients doivent être proposés. Zapier seulement si une automatisation précise est définie (source, déclencheur, destination), pas en général.
5. **Reconnecter / connecter seulement si besoin réel :** Zoom (réautorisation requise, utile pour les réunions et, côté produit BesoinAvocat, pour les rendez-vous avocats) ; Shopify seulement si un client TAKATAK a une boutique ; Spotify : non recommandé pour le travail client (hors périmètre).
6. **Ne pas utiliser pour le travail client sans décision distincte :** Stripe (aucun paiement, abonnement ou encaissement sans approbation explicite) ; Messenger / Instagram Messages / Threads Messages (aucun envoi en son nom sans texte exact approuvé) ; Gumroad (aucun produit client documenté, à définir avant toute publication) ; Lovable / Replit (hors du flux GitHub/Coolify actuel, à définir avant toute construction) ; Slack (aucune coordination TAKATAK n'y passe aujourd'hui, à définir avant tout déplacement de la coordination) ; données santé (Apple Health / Google Health Connect, personnelles, Hors périmètre TAKATAK).
7. **Produit, pas conversation — ne pas confondre :** les connecteurs BesoinAvocat (Zoom, Outlook, Google Agenda, DocuSign, Clio) et Growth Suite (GA4, Search Console, Google Business Profile) sont des fonctionnalités pour les clients finaux ; leur activation exige comptes développeur, variables Coolify et vérification avec un vrai compte, une étape à la fois, par le propriétaire (et Mike pour BesoinAvocat) — ce n'est pas l'autorisation des connecteurs de conversation de KLEAN.
8. **Prochaines lectures de métriques, dans cet ordre, avec approbation :** déploiements Vercel et PR/CI GitHub (déjà suivis), puis ventes/versements Gumroad (si un produit est défini), campagnes Meta Business Manager, tâches Google Tasks nouvellement créées, événements Calendar, et feuilles Sheets de suivi — chiffres à rapporter seulement après lecture réelle, jamais inventés.

## 7. Arbitrages à trancher par l'utilisateur / l'agent principal (relevés, non tranchés ici)

- (a) Autorisations : plan 17:23 EDT (une par une, jamais groupées) vs demande 17:26 EDT (tout autoriser, liste unique). Ce rapport fournit la liste unique demandée, mais l'ordre d'autorisation reste à confirmer.
- (b) Merge/déploiement : interdiction passe 17:01 EDT vs autorisation déploiement client 17:14 EDT — tranché ensuite par la mise à jour des instructions de passe du 2026-10-29 17:21 EDT en faveur de l'autorisation 17:14 EDT, takatak-v1 restant PR-only ; aucun merge/déploiement exécuté dans cette mission-ci.
- (c) Renouvellement locactif : 2026-11-03 (docs dépôt) vs 2026-12-14 (MochaHost).
- (d) Périmètre KLEAN clients vs périmètre restaurants pour Food Hub / écrans / PPP / DoorDash / Uber Eats — les fichiers restaurants sont relevés mais hors KLEAN, à arbitrer avant toute action KLEAN dessus.
- (e) Outil de suivi de projet unique à choisir (Todoist / Asana / Linear / Notion) — voir §6 point 4.
- (f) Création d'une liste Google Tasks dédiée TAKATAK et d'événements Calendar — recommandée, mais non créée dans cette mission lecture seule ; décision de l'utilisateur requise.

## 8. Note aux autres agents — dans ce rapport, pas d'envoi à un autre agent

> Si vous voulez faire la même chose, connectez tous ces connecteurs-là sur votre compte Muse pour pouvoir suivre le processus TAKATAK.

Liste à connecter, un par un, dans l'ordre du travail : Gmail, Google Drive, Google Docs, Google Sheets, Google Slides, Google Forms, Google Contacts, Google Tasks, Google Calendar, GitHub, Vercel, Notion, Todoist, Calendly, Asana, Linear, Zapier, Slack, Figma, Lovable, Replit, Canva, Stripe, Evernote, Granola, Gumroad, Runway, Meta Business Manager, Messenger, Instagram, Instagram Messages, Threads, Facebook, Tailscale, FlightAware, Google Health Connect, Zoom (réautorisation), Shopify (si boutique client), Spotify (hors périmètre client, optionnel), Threads Messages, Ticketmaster, Places, Shop Pay, Shopify UCP, Meta Catalog, Apple Health (données seulement, Hors périmètre client).

Pour chaque connecteur : vérifiez son statut par sa commande status, mettez « autoriser en tout temps » quand le prompt apparaît dans la conversation, un connecteur à la fois, et n'affirmez un usage que si vous l'avez réellement utilisé dans le travail TAKATAK. Travaillez dans Google Drive seulement, jamais OneDrive. Laissez une trace avant / pendant / après, signée, dans Google Drive et dans GitHub. Ne copiez jamais un mot de passe, un code ou un secret. Ne faites aucun paiement et n'envoyez aucun message au nom de l'utilisateur sans texte exact approuvé. Le tableau de bord takatak-v1 se met à jour via PR seulement.

## 9. Traçabilité et dépôts

- Rapports d'équipes vérifiés par le coordinateur (fichiers locaux, existence et contenu vérifiés) :
  - github-connectors-instructions-2026-10-29.md (51 301 octets)
  - drive-instructions-2026-10-29.md (94 610 octets, 607 lignes, inventaire des 335 éléments)
  - connectors-google-productivity-2026-10-29.md (8 396 octets)
  - connectors-commerce-social-dev-2026-10-29.md (16 268 octets)
  - google-tasks-calendar-2026-10-29.md (4 641 octets)
- Ce rapport : déposé dans Google Drive, dossier « 00 — Opérations TAKATAK », signé KLEAN, ID Drive 1uH2HwZzpxSJHrelSepdRhPWd_l51GLQs, ET dans GitHub takatakca/takatak-v1 via PR seulement (numéro PR à compléter ci-dessous après création, jamais de push direct sur main).
- Fichier central Drive ID 1vTzXrkvfhmE-zp2iquvQByRE6LXETaWJ : mis à jour en place avec un résumé de ce rapport et son lien Drive.
- Aucun merge/déploiement de site client dans cette mission ; aucun envoi à un autre agent ; la note aux autres agents est dans ce rapport seulement (§8).
- Limites : inventaire statut/lecture seulement ; statuts vérifiés le 2026-10-29 après-midi EDT, susceptibles de changer à la prochaine reconnexion ; les références Drive citées dans GitHub n'ont pas été ouvertes dans la mission GitHub seulement ; les fichiers de code source n'ont pas été relus ligne par ligne ; les métriques non lues ne sont pas chiffrées ici.

— Signé : KLEAN, note client TAKATAK, 2026-10-29.
