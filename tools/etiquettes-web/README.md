# TakaTak Étiquettes

Application Web française autonome : produit, code-barres, sauvegarde en ligne, PDF et essai de lecture. Source centralisée dans takatak-v1, service indépendant de la production V1.

L'accès privé Sites/ChatGPT est conservé, avec un compte d'essai supplémentaire. Les modèles sont isolés par identité Sites. Démonstration sans données sensibles. Aucun compte maître V1, migration V1 ou domaine de production existant n'est modifié.

## Construction

`npm ci && npm run build && npm test`. Créer `.openai/hosting.json` avec project_id, d1=DB et r2=null. L'archive hébergée contient `dist/server/index.js`, `dist/.openai/hosting.json` et `dist/.openai/drizzle/`.

Secrets : DEMO_USERNAME, DEMO_SALT, DEMO_PASSWORD_HASH (PBKDF2 SHA256, 100000 itérations, 32 octets hex). Sessions huit heures, cookies Secure/HttpOnly/SameSite, contrôle d'origine, limitation des tentatives et protection des sauvegardes concurrentes.

Le moteur d'étiquettes est copié depuis src/lib/inventory au même commit; reporter les modifications puis republier explicitement. Les contrôles enregistrent des vérifications déclarées, sans certification légale ni référencement automatique chez les détaillants. Confirmer recette, poids, dimensions et mentions avant vente.

Domaine demandé : serveur.mielaissa.ca, actif seulement après validation DNS/TLS. Les identifiants d'essai ne sont pas versionnés.
