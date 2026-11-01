# REVEW — QMAPS, agents et site Review

Signature REVEW · 2026-11-01

## Avant / pendant

Lire les instructions et l'actualité des deux dépôts. Réconcilier main49b6797 dans la branche Review avant la nouvelle CI (44 commits récents, aucun schéma/migration ajouté par Review). L'utilisateur indique assurer le déploiement main dans son créneau; cette branche reste la livraison à valider.

Développé dans QMAPS et TAKATAK, et non simulé par une image:

- QMAPS `takatak-list-reviews`: POST v1 avec clientId/businessId, pages de25 côté V1, limite100 côté source, curseur createdAt+id conservant les microsecondes. Seuls avis visibles/trusted et non masqués; aucune identité privée.
- QMAPS `takatak-reply-review-v2`: version1 + clientId/businessId/reviewId/body. Vérifie le lien et la cible; retourne texte/horodatage effectivement persistés. V1 exige HTTP200 et tous les échos. Le nouveau nom empêche d'écrire via l'ancien handler global encore déployé; aucun fallback. L'ancien handler est durci aussi. Le lien entreprise refuse le transfert entre clients.
- V1: lire la page source, revérifier les droits/relations en transaction, upsert des avis avec identité stable commune aux événements signés, conserver brouillon/réponse locale plus récente, auditer les comptes. Pas d'archivage déduit d'une page partielle. Le récepteur signé existe dans V1, mais aucun producteur de ces événements n’a été trouvé dans QMAPS. Le nouveau contrôle explicite `takatak-review-visibility` confirme la visibilité de jusqu’à100 identifiants déjà suivis; seuls les retraits confirmés par cette source sont archivés, avec garde de version locale et curseur par lots.
- Dashboard: bouton de synchronisation/chargement des pages anciennes par entreprise, résultat réel, quatre dispositions conservant données/filtres/actions uniques.
- MCP: `/api/reputation/mcp`, POST stateless JSON-RPC (protocoles2025-03-26/2025-06-18), outils de lecture et résumé bornés. Aucun envoi/publication automatique via cette interface. Jeton dédié lié à un profil/espace, permissions actuelles vérifiées, expiration et limites. Pas de secret global donnant accès à tous les clients.
- Site public `/reviews`: français/anglais, même shell TAKATAK, aperçu interactif explicitement fictif, liens vers le compte/IA/offres canoniques. `review.takatak.ca/` est routé vers cette page par règle host exacte; les liens d'auth/dashboard restent sur takatak.ca. Aucun nouveau compte ni partage élargi des cookies.

## Configuration et ordre de raccordement

1. Revoir/merger la branche QMAPS `revew/review-api-handoff`; source contrat épinglé `9a7403336a6e6aa4244c126630fe0460668ade8d`.
2. Déployer les fonctions Supabase `takatak-list-reviews`, `takatak-reply-review-v2`, `takatak-review-visibility`, ancien reply durci et link-business. Elles utilisent le secret serveur existant `QMAPS_TAKATAK_INTEGRATION_SECRET` (au moins32 caractères) et les variables Supabase serveur. Aucun secret dans le navigateur.
3. TAKATAK utilise `QMAPS_FUNCTIONS_BASE_URL` HTTPS et `QMAPS_INTEGRATION_SECRET` correspondant. Lier chaque entreprise à un seul client via Admin → QMAPS. Dans Review → Connections, lancer la lecture puis vérifier les données. Sans fonctions v2 déployées, les actions échouent explicitement sans repli vers une publication non scoped.
4. MCP facultatif: configurer `TAKATAK_REVIEW_AGENT_GRANTS` comme JSON contenant `{tokenSha256,clientId,profileId,expiresAt}`. Utiliser le SHA256 minuscule d'un jeton aléatoire long (jeton au moins32caractères), UUIDs réels et expiration UTC ISO avec millisecondes. Retirer l'entrée révoque l'accès; la suppression/permission du membre est aussi recontrôlée. Ne jamais mettre les jetons/valeurs privées dans GitHub ou le chat. Aucun grant activé dans cette session.
5. Déployer le code V1 après CI exacte et les contrôles main/production existants. Pour `review.takatak.ca`, ajouter le DNS et le domaine HTTPS à l'application Coolify existante. Les règles de code ne créent ni DNS ni certificat. Vérifier d'abord public root, redirections de compte, `/api/health/ready`, SHA déployé et échange QMAPS autorisé.

## Ce que les tests prouvent

V1 exécute les tests du client et de synchronisation sur des fixtures de DB, plus un test de contrat important: le vrai client V1 appelle en mémoire les vrais handlers/auth QMAPS épinglés, lit25+1 avis, refuse un autre espace, écrit une réponse confirmée puis la relit. Stockage fictif; aucune opération Supabase ou avis public réel. La CI récupère exactement le SHA QMAPS ci-dessus, pas une tête mouvante.

QMAPS source9a74033: [CI442tests/typecheck/lint/build verte](https://github.com/takatakca/qmaps/actions/runs/41299114132). Nouvelle CI V1 à compléter après le push. Les tests locaux et captures ne remplacent pas une recette authentifiée en production.

Accès réel constaté: Git natif fonctionne; API GitHub/GraphQL, takatak.ca et Coolify sont refusés403 par le réseau. Aucun jeton Coolify/SSH/DB/Supabase/QMAPS configuré localement; les secrets GitHub distants ne sont pas observables ici. Les derniers jobs Coolify main examinés sont skipped. Ni un merge ni une CI verte ne prouvent la mise en ligne.

Liste fournisseurs/API séparée: `REVEW_PROVIDER_API_CATALOG.md`. Copie Drive prête localement, NON ENVOYÉE faute de connecteur Drive.

## Après — validation intermédiaire et contrôle des retraits

V1 source590bb4c avec main49b6797 intégré: [CI complète verte en3m01s](https://github.com/takatakca/takatak-v1/actions/runs/41298527682), incluant104 contrôles unitaires/service/MCP/QMAPS et5 flux inter-dépôts réels en mémoire, Prisma/typecheck/lint/build. Site public natif HTTP200, canonicalReview, redirection de compte307 et absence de débordement1440/390px vérifiés; quatre layouts testés avec CSS natif, choix persistant et un seul formulaire de réponse. Les polices Google bloquées localement utilisent le fallback de développement; la CI de production les compile normalement.

Un audit a ensuite confirmé l’absence d’émetteur d’événements QMAPS dans ce dépôt. La livraison finale ajoute donc un endpoint de visibilité sans contenu, une vérification bornée des identifiants suivis et l’archivage uniquement sur preuve source, jamais sur l’absence dans une page. Les tests et pins sont mis à jour pourQMAPS9a74033; nouvelle CI à vérifier. Aucun DNS, grantMCP, secret ou fonction Edge activé par cette session. — REVEW

La vérification des retraits est une action explicite distincte du chargement de pages. Elle contrôle au plus100 identifiants suivis, avance par curseur enregistré et archive seulement les confirmations `visible:false` complètes de QMAPS. Toute réponse partielle, mauvais espace ou panne est refusée; la version locale `updatedAt` protège les changements concurrents. Aucun contenu d’avis masqué n’est renvoyé par le contrôle source.22 tests dédiés de visibilité et7 flux inter-dépôts passent localement. — REVEW

## Après — livraison finale vérifiée

- Code V1 `a0e9e9a`: [CI complète verte](https://github.com/takatakca/takatak-v1/actions/runs/41299614794),4m36s;126 contrôles et7 flux de contrat inter-dépôts, génération Prisma, types complets, lint, build de production. main49b6797 est déjà réconcilié dans cette branche.
- Code QMAPS `9a7403336a6e6aa4244c126630fe0460668ade8d`: [CI442tests/types/lint/build verte](https://github.com/takatakca/qmaps/actions/runs/41299114132).
- [Comparer/fusionner V1](https://github.com/takatakca/takatak-v1/compare/main...codex/review-ecosystem); [comparer/fusionner QMAPS](https://github.com/takatakca/qmaps/compare/main...revew/review-api-handoff). Aucun PR créé par API et aucune fusion main effectuée dans cette session.
- Interface publique native `/reviews` HTTP200, host `review.takatak.ca` root rewrite200, dashboard et inscription/callback redirigés307 vers le compte canonique. Capture [ordinateur](screenshots/review-public-native-desktop.png), [mobile](screenshots/review-public-native-mobile.png). Les exemples publics sont explicitement fictifs; polices de secours locales pendant le test réseau restreint.
- Quatre dispositions réelles testées avec CSS natif, une réponse sélectionnée, filtres et préférences conservés, viewport mobile contenu. Axe sur les quatre dispositions peuplées de données fictives: zéro violation WCAG2A/AA/2.1AA après correction du contraste d’une note de brouillon. Cela ne vaut pas conformité globale.

Avant trafic réel: déployer séparément `takatak-list-reviews`, `takatak-reply-review-v2`, `takatak-review-visibility`, ancien `takatak-reply-review` durci et `takatak-link-business`; configurer/vérifier les secrets serveur correspondants et une entreprise autorisée; raccorder DNS+HTTPS Review à l’application; vérifier SHA et santé de production; puis lire un avis réel et tester une réponse expressément autorisée. MCP en lecture seulement, à activer avec grants expirants réels si souhaité. Aucun agent autonome, boîte Gmail ou connecteur fournisseur supplémentaire n’a été activé ici. Les autres APIs sont classées dans le catalogue; ce ne sont pas des activations effectuées.

Code livré, pas une affirmation de site déjà en ligne. Notes GitHub et copie locale Drive-ready mises à jour; Drive NON ENVOYÉ faute d’outil. — REVEW
