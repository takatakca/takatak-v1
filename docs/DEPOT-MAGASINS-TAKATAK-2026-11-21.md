# Dépôt de l'app TAKATAK dans les magasins : état et trousse de dépôt

Suite de [`APPS-MAGASINS.md`](APPS-MAGASINS.md). Même recette que BesoinAvocat (`takatakca/BESOINAVOCAT.CA/docs/DEPOT-MAGASINS-2026-11-20.md`). Tous les comptes sont au nom de **Groupe TAKATAK** (Quadro Holdings Ltée, D-U-N-S 203779971).

## État au 21 novembre 2026 (06 h 45 UTC)

| Magasin | État | Reste à faire | Qui |
|---|---|---|---|
| Google Play | App `ca.takatak.app` créée. Fiche fr-CA remplie : textes, icône, bannière, 4 captures téléphone, 4 captures tablette 7 po et 10 po. Confidentialité, catégorie Business et coordonnées (support@takatak.ca, takatak.ca) enregistrées. | Case « Don't label assets » puis Save sur la fiche, déclarations (section 3), dépôt du `.aab`, envoi en examen | Propriétaire (case, déclarations, envoi), Claude (reste) |
| Amazon Appstore | **Envoyé en révision le 2026-11-21 vers 08 h UTC** (statut « Submitted »). Fiches en-US et français, langues anglais et français, classement complet (13 réponses de la section 3, rempli par Claude à la demande expresse du propriétaire), confidentialité, liens de suppression, `TAKATAK.aab` version 1, 12 tablettes Fire, diffusion 100 %. | Attendre la réponse d'Amazon | Amazon |
| Huawei AppGallery | Compte en vérification d'entreprise | Créer l'app, déposer l'`.apk` | Après approbation |
| Microsoft Store | Compte en vérification d'emploi | Réserver « TAKATAK », générer le `.msix` avec PWABuilder, déposer | Après approbation |
| Samsung Galaxy Store | Demande au soutien en attente | Créer l'app, déposer l'`.apk` | Après réponse |
| Apple App Store | Pas d'inscription (99 $ US par an) | En dernier | Propriétaire paie d'abord |

## 1. Paquet Android

- Généré par PWABuilder le 21 novembre 2026 pour `https://takatak.ca`, identifiant `ca.takatak.app`, version 1 (1.0.0.0).
- Le ZIP (`.aab`, `.apk`, clé de signature) est sur le PC du propriétaire. **La clé de signature ne va jamais dans GitHub, Drive ou le clavardage.**
- Le ZIP a été ouvert le 21 novembre : `TAKATAK.aab` et `TAKATAK.apk` sont sur le PC du propriétaire dans `BESOINAVOCAT\APP-ANDROID\`. Empreinte SHA-256 de la clé de dépôt (publique, c'est celle d'`assetlinks.json`) : `ED:9B:BE:01:B5:B1:38:26:C0:79:CE:74:52:F0:AB:F4:F1:D1:2C:A4:78:47:FC:83:FC:80:CD:34:54:4B:69:45`.
- Dossier prêt par magasin sur le PC : `BESOINAVOCAT\TAKATAK-MAGASINS\` (`1-HUAWEI`, `2-SAMSUNG`, `3-MICROSOFT`, `4-APPLE`, `5-AUTRES-ANDROID`), chacun avec le paquet, les images, un `LISEZ-MOI.txt` et, à la racine, `TEXTES-ET-REPONSES.txt` à copier-coller.
- Après le premier dépôt sur Google Play : copier dans Coolify (app takatak.ca) `TAKATAK_ANDROID_CERT_SHA256` = empreinte de la clé de dépôt **et** empreinte de signature de Google (Play Console › Intégrité de l'application), séparées par une virgule, puis redéployer. Sans cela, `/.well-known/assetlinks.json` répond 404 et l'app montre la barre d'adresse.

## 2. Valeurs communes à toutes les fiches

| Champ | Valeur |
|---|---|
| Nom | TAKATAK |
| Identifiant / SKU | `ca.takatak.app` |
| Catégorie | Business (Professionnel) |
| Prix | Gratuit, sans achat intégré |
| Pays | Google Play : Canada pour commencer. Amazon : tous les pays. |
| Site | https://takatak.ca |
| Soutien | support@takatak.ca · https://takatak.ca/contact |
| Confidentialité | https://takatak.ca/privacy-policy |
| Conditions | https://takatak.ca/terms-of-service |
| Suppression du compte et des données | https://takatak.ca/data-deletion |
| Public | 18 ans et plus |
| Textes FR et EN | `APPS-MAGASINS.md` section 6 |
| Images | `docs/store-assets/` (icônes, bannières, captures par magasin) |

Liens vérifiés en ligne le 21 novembre 2026 (réponse 200).

## 3. Réponses aux questionnaires

Tirées de la politique de confidentialité en ligne. À revoir si l'app change.

**Google Play › Contenu de l'application** (déclarations : le propriétaire clique)
- Publicité : **non**.
- Identifiant publicitaire : **non** (le paquet ne contient pas la permission `AD_ID`).
- Accès à l'app : une partie est réservée aux comptes ; fournir un compte d'essai aux examinateurs.
- Classement du contenu : catégorie « Utilitaire, productivité, communication » ; aucune violence, sexualité, langage grossier, drogue ni jeu d'argent ; les utilisateurs peuvent échanger avec le soutien.
- Public cible : 18 ans et plus.
- Sécurité des données : données collectées = nom, courriel, identifiant d'utilisateur, renseignements d'entreprise fournis, identifiants d'appareil (sécurité) ; chiffrées en transit ; suppression possible sur demande ; aucune vente ; aucun partage à des fins publicitaires. Buts : fonctionnement de l'app, gestion du compte, sécurité.
- Application gouvernementale, financière, santé, actualités : **non**.
- Images de la fiche : « Don't label assets » (aucune image produite par IA générative).

**Amazon** (confidentialité remplie ; classement à cliquer par le propriétaire)
- Classement : tout à « None » ; éducatif non ; renseignements personnels oui ; publicité, jeu, localisation non ; communication entre utilisateurs oui.
- Confidentialité : collecte de nom, courriel, identifiant d'utilisateur, autres renseignements d'utilisateur, identifiant d'appareil ; buts « App functionality » et « Fraud Prevention, Security and Compliance » ; rien de transféré à des tiers.

## 4. Astuce de dépôt des images

Les consoles refusent le sélecteur de fichiers piloté à distance. Les images de `docs/store-assets/` sont lues depuis `https://cdn.jsdelivr.net/gh/takatakca/takatak-v1@main/docs/store-assets/…` (dépôt public), redimensionnées au besoin, puis placées dans le champ de fichier de la page. Google Play refuse les captures téléphone plus hautes que 2:1 : elles sont recadrées à 1080 × 2160.

## 5. Magasins en attente : ce qui est prêt

- **Huawei, Samsung :** même `.apk`, mêmes textes et réponses ; icônes `huawei-icon-216.png`, `samsung-galaxy-icon-512.png`, bannière `samsung-galaxy-feature-1024x500.png`, captures téléphone et tablette.
- **Microsoft :** images `microsoft-*.png`, captures `desktop-1920x1080-*.png`. Le `.msix` se génère seulement après la réservation du nom (Partner Center › Product identity donne « Package ID », « Publisher » et « Publisher display name »).
- **Apple :** `apple-app-icon-1024.png`, captures `apple-iphone-6.9-*.png` et `apple-ipad-13-*.png`. Voir la règle 4.2 dans `APPS-MAGASINS.md` section 5.

## Mise à jour du 2026-11-26

- Google Play : app native 2.0.0 (code de version 100) signée et téléversée, brouillon de production enregistré, Canada ciblé. Reste : « Sign in details » (accès examinateur fourni par le développeur), « Target audience » (18 ans et plus), enregistrement de la sécurité des données, déclaration sur les images faites par IA dans la fiche, puis envoi en révision avec l'accord du propriétaire.
- Amazon : l'ancien paquet est en révision ; `TAKATAK-v2-amazon.apk` signé est prêt pour la version suivante.
- Fichiers signés : dossier `TAKATAK-KIT-V2` sur le PC du propriétaire. La clé de signature reste sur le PC.

## Google Play « Sign in details » : texte prêt (2026-11-27)

État vérifié le 2026-11-27 04:25 UTC : 3 déclarations restent ouvertes (accès, public cible, sécurité des données), toutes bloquées par la première. Fiche enregistrée, paquet 2.0.0 en brouillon, Canada ciblé.

À entrer par le propriétaire (les deux valeurs viennent de son développeur, les mêmes que `TAKATAK_MOBILE_REVIEW_EMAIL` et `TAKATAK_MOBILE_REVIEW_CODE`) :
- Instruction name : `Reviewer test account`
- Username : le courriel de test
- Password : le code de test
- Any other information : `Open the app, tap "Se connecter", enter the email and the code above. The client dashboard opens. No second factor is required. The account contains sample data only.`

Ensuite Claude termine : public cible 18 ans et plus, enregistrement de la sécurité des données, puis envoi en révision avec l'accord du propriétaire.
