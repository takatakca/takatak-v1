# TAKATAK Review — approbation et publication IA

Signature REVEW · 2026-11-01 · branche `codex/review-ecosystem`

## Avant

Continuer le backend et le dashboard natifs V1. Lire le journal, les instructions et le tableau public existants; aucun service de génération parallèle, nouvelle base ou migration. L'objectif de cette livraison est le parcours réel entre la demande de brouillon et sa publication confirmée. Le site public et les quatre dispositions d'inbox restent dans la même application TAKATAK.

## Pendant — comportement livré

- La cinquième section **Réponses IA** affiche les 50 demandes récentes de l'espace, leurs vrais états, le texte retourné, la source, l'établissement et les crédits déclarés par le worker. Elle expose les erreurs sous une forme générique et ne transmet pas les données privées d'entrée ni les erreurs internes au navigateur. Une panne de lecture s'affiche comme indisponible.
- Les avis Google, QMAPS suivis et commentaires internes peuvent demander un brouillon. Les imports manuels ne reçoivent aucun droit de publication. Une empreinte lie la demande au contenu, à la note, à l'identité de source et à la réponse déjà présente. Une modification exige un nouveau brouillon.
- Les demandes Review v2 passent toujours par une décision humaine. L'approbation requiert les droits natifs `manage_reputation` et `approve_content` et l'offre IA applicable. La décision utilise l'identité de session, l'espace actif et une garde de version; elle fige le texte exact et l'auteur de la décision. Un brouillon incomplet ou obsolète reste rejetable. Pour un commentaire interne, l'approbation termine une revue interne; elle n'envoie rien à un fournisseur.
- Les producteurs v2 utilisent le même verrou court sur la configuration IA de l'espace pour dédupliquer une demande encore active pour le même avis. La capacité reste de 50 demandes en attente par espace. Aucune mise en file, décision ou publication dans cette livraison ne prélève de crédits. Le tarif catalogue de génération est affiché séparément; les crédits déclarés par le worker ne constituent pas une nouvelle preuve du grand livre.
- Le publisher serveur vérifie l'agent activé, les deux fonctionnalités `reputation` et `ai_autopilot`, la cible actuelle et le texte approuvé. Il acquiert un bail unique avant l'appel externe et conserve son résultat dans l'entrée serveur du run. Un rapport final du worker peut changer le résumé de sortie sans effacer cette preuve. Une requête répétée avec un reçu confirmé restitue ce reçu sans republier.
- Un délai dépassé, une réponse perdue ou une erreur de stockage après l'appel source restent **incertains**. Le système bloque la répétition automatique de cette tentative. Actualiser/synchroniser la source et vérifier le texte effectivement présent avant une reprise opérateur; aucun bouton de réinitialisation aveugle du bail n'est ajouté. Une approbation ou le statut `completed` ne vaut jamais publication.
- Google exige HTTP200, le texte exact dans le reçu et un horodatage source valide. Le reçu est borné, les redirections de l'appel de réponse sont refusées et un ancien accusé de réception ne remplace pas une réponse locale plus récente. QMAPS utilise exclusivement le contrat scoped v2 déjà livré. Les anciens runs Google conservent leur seul chemin historique explicitement configuré sans approbation; les nouvelles demandes v2 ne l'empruntent pas.

## Contrat du worker existant

Le worker authentifié utilise les endpoints natifs, sans jeton ni identifiant de client fournis par le navigateur:

1. `POST /api/ai/agents/claim` retourne une demande en phase `generate`, son `input` contenant `reviewWorkflowVersion: 2`, `reviewResponseId`, `source`, `reviewContentHash`, et `requireApproval: true`.
2. Le worker génère et rapporte `succeeded: true` avec `output: { reply: "texte exact" }` via `POST /api/ai/agents/runs/<runId>/report`. Un succès de génération passe à `awaiting_approval`, même si l'ancien réglage d'agent permettait l'autopilote.
3. Un opérateur autorisé approuve ce texte dans Review → Réponses IA. Un commentaire interne est terminé sans envoi. Pour Google/QMAPS, la demande passe à `approved`, puis le prochain claim retourne la phase `execute` et l'approbation figée dans `input.reviewApproval`.
4. Le worker appelle `POST /api/ai/reviews/reply` avec `{ runId, comment }`, en reprenant exactement le texte approuvé. Ce handler choisit l'espace et la source depuis le run enregistré. Il retourne une confirmation ou une erreur explicite; les erreurs d'issue incertaine ne doivent pas être renvoyées en boucle.
5. Le rapport d'exécution peut ensuite terminer le run. Le reçu de publication reste enregistré indépendamment du résumé de sortie et du statut du worker. Le dashboard distingue ce reçu du simple achèvement du travail.

Le worker, ses clés et une connexion de fournisseur réelle restent nécessaires. Aucun worker autonome n'a été lancé par cette session; aucune réponse publique ni consommation réelle de crédits n'a été produite pendant les tests.

## Après — preuves de validation

À compléter avec la CI du commit exact après le push. Les tests locaux couvrent 37 cas d'approbation/queue, 18 cas de publication et 16 cas d'accusé Google, en plus des 126 contrôles Review existants et 7 flux QMAPS inter-dépôts. Les stores/providers de ces suites sont synthétiques; elles ne prouvent pas une transaction PostgreSQL de production ni un fournisseur connecté. Le test navigateur du vrai composant emploie des données fictives et des actions serveur simulées. [Capture ordinateur](screenshots/review-approval-desktop-synthetic.png), [capture mobile](screenshots/review-approval-mobile-synthetic.png). La route native répond HTTP200; la cinquième section refuse toute approbation sans espace autorisé. Les fixtures intégrées vérifient décisions, hash, filtres, navigation, conservation des formulaires et zéro débordement à1440/390px; le scan axe du composant peuplé retourne zéro violation WCAG2A/AA/2.1AA. Ce résultat ne vaut pas conformité du produit entier.

La CI génère le vrai client Prisma, vérifie les types de l'application complète, le lint et le build de production. La génération Prisma locale reste bloquée par l'accès au serveur des moteurs; une CI verte du code exact est requise avant de déclarer ces contrôles complets réussis.

Code à relire/fusionner: [comparaison GitHub](https://github.com/takatakca/takatak-v1/compare/main...codex/review-ecosystem). Configuration et ordre de raccordement QMAPS/domaine: [notes de livraison](REVEW_QMAPS_AGENT_RELEASE.md). Aucun merge main, DNS, déploiement, grant MCP ou fournisseur supplémentaire activé par cette livraison.

Notes GitHub versionnées et copie Drive-ready locale; **NON ENVOYÉE sur Google Drive**, car aucun connecteur Drive n'est disponible dans cette session. Aucune session Gmail ni tâche récurrente active. — REVEW
