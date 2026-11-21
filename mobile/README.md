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

Points d'entrée : `src/app/api/mobile/v1/` (me, home, notifications, notifications/read, invoices). Tests :
`npm run qa:mobile-api`.

## Construire (gratuit, sur GitHub)

`.github/workflows/mobile.yml` exécute :

1. la vérification des types, les tests et le paquet JavaScript ;
2. le build Android : `TAKATAK-native-test.apk` à installer pour essayer, et `TAKATAK-native-unsigned-for-play.aab` ;
3. le build pour le simulateur d'iPhone.

Les fichiers Android du flux sont signés avec la clé de test publique, pas pour Google Play.

Pour Google Play, la clé de téléversement reste sur le PC du propriétaire (ZIP PWABuilder). Elle ne va jamais sur
GitHub ni sur Drive. La commande de signature est :

```sh
jarsigner -keystore signing.keystore -signedjar TAKATAK-2.0.0.aab TAKATAK-native-unsigned-for-play.aab my-key-alias
```

Apple vient en dernier : il faut le compte Apple Developer (décision du propriétaire).

## Développer

```sh
cd mobile && npm ci
npx tsc --noEmit && npm test
EXPO_PUBLIC_DEMO=1 npx expo start   # aperçu avec des données fictives
python3 scripts/make-icons.py       # icônes à partir du logo officiel
```

`ios/` et `android/` sont générés (`npx expo prebuild`) et ne sont pas versionnés.
