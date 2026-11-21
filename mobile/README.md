# Application native TAKATAK (iOS + Android)

Vraie application native en **React Native avec Expo** (SDK 57). Une seule base de code donne l'app iPhone et l'app
Android. Elle remplacera la version PWABuilder des magasins comme mise à jour.

- Identifiant : `ca.takatak.app` (le même que la version des magasins). Version `2.0.0`, code Android `100`.
- Couleurs et logo officiels (BRAND.md) : bleu électrique sur marine, logo tiré de `public/icons`, jamais redessiné.

## Ce que fait l'app (première vague, décision du propriétaire du 2026-11-21)

| Écran | Contenu |
|---|---|
| Accueil | Salutation, entreprise active, portée, engagement, visites du site, demandes reçues (30 jours), note moyenne, connexions, pages les plus visitées, derniers avis |
| Alertes | Avis de l'entreprise (approbations, demandes, factures, erreurs), tout marquer comme lu |
| Outils | Tous les services ; les outils spécialisés (réseaux sociaux, publicité, SEO, Food Hub, hébergement…) s'ouvrent dans le tableau de bord sécurisé en attendant leur version native |
| Factures | Factures TAKATAK, payer ou télécharger le PDF sur la page Stripe |
| Demandes reçues (vague 2) | Prospects du site et des campagnes, filtres par étape, appeler ou écrire d'un toucher |
| Sites et domaines (vague 2) | Domaines, DNS, sécurité HTTPS, renouvellements (ce qui demande attention en premier), hébergement |
| Équipe (vague 2) | Membres et rôles, invitations en attente (inviter et changer un rôle restent sur le site) |
| Entreprises | Changer d'entreprise (seulement celles dont le compte est membre actif) |
| Compte | Verrouillage Face ID / empreinte, aide, confidentialité, conditions, déconnexion, suppression des données |

Les vagues suivantes rendent natifs, un groupe à la fois, les outils qui s'ouvrent encore sur le Web.

## Connexion

Même compte que takatak.ca. L'app demande le code par courriel avec `POST /api/auth/email-code`. Le code est ensuite
vérifié par `POST /api/mobile/v1/auth/verify`, qui crée ou charge le profil exactement comme le site.

Les jetons restent dans le coffre sécurisé du téléphone (Keychain / Keystore) et sont envoyés en
`Authorization: Bearer`. Ils sont rafraîchis par `POST /api/mobile/v1/auth/refresh`. Chaque appel est vérifié auprès
de Supabase Auth. L'entreprise est choisie avec les mêmes règles que le site (`resolveTenantAccessBundle`) : l'en-tête
`x-takatak-workspace` n'est qu'une préférence. Les témoins du navigateur ne sont pas touchés.

Points d'entrée : `src/app/api/mobile/v1/` (me, home, notifications, notifications/read, invoices, leads, web, team). Tests :
`npm run qa:mobile-api`.

## Construire (gratuit, sur GitHub)

`.github/workflows/mobile.yml` exécute :

1. la vérification des types, les tests et le paquet JavaScript ;
2. le build Android : `TAKATAK-native-test.apk` à installer pour essayer, et `TAKATAK-native-unsigned-for-play.aab` ;
3. le build pour le simulateur d'iPhone.

Les fichiers Android du flux sont signés avec la clé de test publique, pas pour Google Play.

### Version 2 pour Google Play et Amazon (signée sur le PC du propriétaire)

Le flux publie aussi `takatak-store-kit` : le `.aab` et le `.apk` à signer, `apksigner.jar` (outil officiel
d'Android), `SIGNER.bat`, `SIGNER.ps1` et `LISEZ-MOI.txt` (sources dans `store-kit/`). Le propriétaire décompresse le
ZIP, y copie sa clé, puis double-clique sur `SIGNER.bat`. Il obtient `TAKATAK-v2-google-play.aab` et
`TAKATAK-v2-amazon.apk`. La clé et son mot de passe ne quittent jamais le PC : ils ne vont ni sur GitHub ni sur Drive.

- La clé est le fichier `.keystore` du dossier (ou celui que la fenêtre demande). L'alias et les mots de passe sont
  lus dans `signing-key-info.txt` à côté, s'il existe, sinon demandés.
- Sans clé, le script propose d'en créer une : seulement si l'app n'est pas encore sur Google Play.
- Java 17 (gratuit, Temurin) est requis ; s'il manque, la page de téléchargement s'ouvre.
- Le flux vérifie les commandes de signature avec une clé jetable, sur Linux et sur Windows (`store-kit-windows`).

Apple vient en dernier : il faut le compte Apple Developer (décision du propriétaire).

## Développer

```sh
cd mobile && npm ci
npx tsc --noEmit && npm test
EXPO_PUBLIC_DEMO=1 npx expo start   # aperçu avec des données fictives
python3 scripts/make-icons.py       # icônes à partir du logo officiel
```

`ios/` et `android/` sont générés (`npx expo prebuild`) et ne sont pas versionnés.

## Accès des réviseurs des boutiques (Google Play, Amazon, Apple)

Les boutiques demandent une connexion qui fonctionne. Elle est **désactivée par défaut**. Pour l'activer, le propriétaire ajoute deux variables dans Coolify (application takatak-v1), puis le site se redéploie :

- `TAKATAK_MOBILE_REVIEW_EMAIL` : un courriel de démonstration choisi par le propriétaire ;
- `TAKATAK_MOBILE_REVIEW_CODE` : un code de 6 chiffres choisi par le propriétaire.

Il tape les deux mêmes valeurs dans la console de la boutique (« Sign in details »). Ces valeurs ne vont jamais dans le dépôt ni dans une conversation. Avec ce courriel, l'application n'envoie aucun courriel : le réviseur tape le code et voit seulement les données fictives intégrées à l'application. Ce compte ne passe ni par Supabase ni par la base de données, et son jeton est refusé par toutes les vraies routes `/api/mobile/v1`. Pour couper l'accès, il suffit de retirer une des deux variables.
