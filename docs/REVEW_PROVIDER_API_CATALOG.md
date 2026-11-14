# REVEW — catalogue d'intégration et suivi

2026-11-01 · signature REVEW

Avant: relire les instructions, le tableau d'agents et les flux TAKATAK existants. La branche Review intègre maintenant main49b6797 (44 nouveaux commits) avant validation. Même identité, permissions, abonnements et crédits; aucun backend client séparé.

Pendant: développer le flux QMAPS lecture paginée → stockage TAKATAK → réponse propriétaire confirmée, plus accès MCP en lecture pour agents; quatre dispositions du dashboard et façade /reviews prévue pour review.takatak.ca. Aucun accès fournisseur ni DNS déclaré actif sans preuve.

## Deux recherches distinctes

Plateformes à comparer: Birdeye, Podium, Reputation, Yext, ReviewTrackers, GatherUp, SOCi, Uberall, Grade.us, Reviewshake, Reviewflowz, EmbedMyReviews. Écosystème canadien: InputKit (Québec), NiceJob, Vendasta, Whitespark (Canada). Liste de candidats, pas inventaire exhaustif ni preuve d'API/conditions commerciales. Birdeye/Google/YouTube restent bloqués par le réseau; pas de prétention d'avoir visionné leurs tableaux de bord.

## Les API, pas les seules pages Web

| Source / système | Preuve ou état | Fonction à intégrer |
| --- | --- | --- |
| Google Business Profile | Service OAuth TAKATAK existant | Lire et répondre dans les droits du compte autorisé |
| QMAPS | Code développé dans les deux dépôts, en validation | Lecture entreprise/espace paginée, contrôle explicite de visibilité, réponse v2 confirmée; récepteur signé V1 présent, pas de producteur QMAPS constaté |
| Facebook | [SDK officiel Page ratings](https://github.com/facebook/facebook-python-business-sdk/blob/efd8423a2e595ea8d4c04eb824ce113f2f1d68cd/facebook_business/adobjects/page.py) | GET Page ratings → recommandations; permissions Page requises; publication de réponse non établie ici |
| Instagram / réseaux sociaux | [SDK commentaires](https://github.com/facebook/facebook-python-business-sdk/blob/efd8423a2e595ea8d4c04eb824ce113f2f1d68cd/facebook_business/adobjects/igmedia.py), [réponses](https://github.com/facebook/facebook-python-business-sdk/blob/efd8423a2e595ea8d4c04eb824ce113f2f1d68cd/facebook_business/adobjects/igcomment.py) | Commentaires/réponses via module Social autorisé; pas de faux avis étoilés |
| Trustpilot | [SDK officiel](https://github.com/trustpilot/node-trustpilot/tree/0bb51093b3aa25e964260f28717451b2fd42b017) | Lecture OAuth /v1/private/business-units/{id}/reviews; droits produit à vérifier; aucune écriture de réponse prouvée par ce SDK |
| Yelp | [Client officiel](https://github.com/Yelp/yelp-ios/blob/ec53f2f25396f94f952e102c1e4315e56ff11303/Classes/Client/YLPClient%2BReviews.m) | GET /v3/businesses/{id}/reviews, Bearer API key; couverture complète et réponse propriétaire non établies |
| Yext | OpenAPI officiel référencé dans REVEW_REVIEW_OPERATIONS.md | Agrégation par entité, pagination, événements selon éditeurs; contrat requis |
| Vendasta | Spécifications officielles référencées dans REVEW_REVIEW_OPERATIONS.md | Lecture Reputation, demandes Customer Voice; accès Trusted Tester/produit/scopes, divergences documentaires à confirmer |
| Setmore | Contrat officiel non vérifié dans les sources accessibles | Candidat événements de rendez-vous → demande d'avis consentie; ne pas appeler cela une API de lecture d'avis |
| Capterra | Contrat de lecture/réponse non établi | Vérifier Gartner Digital Markets / accès partenaire; un scraper ou rapport de clics n'est pas un connecteur d'avis |
| BBB (interprétation de « BBC ») | [Exemple officiel IABBB](https://github.com/IABBB/examples/blob/2335dd6d0c4f6c3aa07e5a4aaacee4ca358a6e1c/complaint-sentiment.py) concerne une DB interne, pas une API publique d'avis | Vérifier accès partenaire; distinguer plaintes, avis et accréditation |
| Yellow Pages / Pages Jaunes Canada | Aucun contrat actuel officiel de lecture/réponse d'avis établi | Les anciens YellowAPI de recherche d'entreprises ne prouvent pas l'accès aux avis |
| Tripadvisor, Booking, App Store, Google Play, FLEXS | Capacités distinctes déjà répertoriées dans le code | Activation seulement avec contrat et compte autorisé; pas de conversion inventée des échelles de notes |

Un agent/MCP utilise les mêmes services et permissions que l'API; il ne crée pas de nouveaux droits chez un éditeur. L'interface MCP développée ici est explicitement en lecture seule. Les réponses publiques restent des actions humaines/flux approuvés existants. Aucun montant Premium/Pro ou coût d'action inventé; la facturation reste canonique dans TAKATAK.

Après: compléter avec résultats exacts des tests, SHA/CI des deux dépôts et instructions de déploiement. GitHub conservé avec source; copie Google Drive préparée localement, NON ENVOYÉE: aucun outil Drive disponible.
