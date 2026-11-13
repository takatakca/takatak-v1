# Publication — 20 octobre 2026

Application en ligne : https://takatak-etiquettes.takatak-ca.chatgpt.site

Accès privé propriétaire ChatGPT, puis connexion au compte d'essai de l'atelier. Aucune installation. Secrets stockés dans l'hébergement, pas dans GitHub. Base D1 persistante, et vérification en ligne `/api/health` : ready.

Site : appgprj_6ad7c0a4f92c8191b7ad6206e9cb499a

L'identifiant du Site est conservé dans le checkout de publication `/workspace/sites/takatak-etiquettes/.openai/hosting.json`. La source applicative est centralisée dans ce dossier de takatak-v1 et synchronisée vers le dépôt technique Sites. Le kit Sites n'était pas installé localement; construction et synchronisation Git explicites ont été utilisées. L'archive contient le Worker compilé et le manifeste/migrations de la même révision poussée.

## Domaine MochaHost à raccorder

`serveur.mielaissa.ca` est enregistré auprès de l'hébergement; DNS/TLS en attente. Aucun accès DNS MochaHost n'est configuré dans l'environnement de travail. Ajouter dans la zone **mielaissa.ca**, sans changer les autres enregistrements ni les serveurs de noms :

| Type | Nom dans la zone | Valeur |
|---|---|---|
| CNAME | serveur | custom-domains.chatgpt.site. |
| TXT | _openai-site-verification.serveur | openai-site-verification=lVhlvTwLYW_zk3aqHwjUHy1k-HBpHvErXbGwmkr5OJU |
| TXT | _cf-custom-hostname.serveur | b6e3583b-c270-4a00-8cab-36a4bd2768f2 |

Les interfaces DNS qui demandent un nom complet doivent recevoir le nom suivi de `.mielaissa.ca`. Vérifier l'absence d'enregistrement A/AAAA/CNAME concurrent à `serveur` avant ajout. Attendre la validation du domaine et le certificat; ne pas annoncer cette adresse comme active avant confirmation.

## Validation

Construction esbuild; tests de connexion correcte/incorrecte, origine, cookie sécurisé, séparation des propriétaires, déconnexion et sauvegarde invalide. Test du formulaire dans DOM simulé : connexion, sauvegarde serveur, rechargement, PDF vectoriel et scan SKU. Pas de test visuel dans un navigateur connecté disponible pour cette publication. Pas de test matériel de l'imprimante/scanner.

Publication indépendante : aucune fusion dans V1 main, aucune migration V1 ou modification Coolify/Contabo. Le raccordement définitif au tableau de bord reste dans PR #218.
