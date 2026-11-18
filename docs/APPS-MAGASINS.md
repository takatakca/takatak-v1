# TAKATAK dans les magasins d'applications (« apps partout »)

Demande du propriétaire, 18 novembre 2026 : takatak.ca au même standard que BesoinAvocat (PR 83 à 85 de `takatakca/BESOINAVOCAT.CA`) : une app installable sur tous les écrans, puis des paquets pour les magasins Android, Windows, Apple et télés. Ce standard doit servir de modèle à chaque marque.

## Principe

Une seule app : **le site takatak.ca lui-même**, ouvert en plein écran avec l'icône TAKATAK. On ne réécrit rien. Chaque mise à jour du site est aussitôt dans toutes les apps.

- **Données :** rien de privé n'est gardé sur l'appareil. Le service worker ne garde que la page hors connexion et les icônes. Les pages, `/api/`, `/dashboard` et `/auth` passent toujours par le réseau.
- **Identifiant d'app commun aux magasins :** `ca.takatak.app`.
- **Coût :** aucun outil payant. PWABuilder est gratuit. Seuls Google (25 $ US une fois) et Apple (99 $ US par an) font payer l'inscription ; le propriétaire décide s'il s'inscrit.

## 1. Ce qui est prêt dans le code

| Élément | Où | Rôle |
|---|---|---|
| Manifeste | `src/lib/pwa/manifest.ts` → `/manifest.webmanifest` | Nom TAKATAK, couleurs bleu marine (BRAND.md), icônes, raccourcis (Tableau de bord, Services, Offres, Contact), captures d'écran |
| Icônes | `public/icons/` (192, 512, 512 « maskable », Apple 180, favicon 32) et `src/app/icon.png`, `apple-icon.png` | Remplacent l'ancien logo or « TK » (retiré par BRAND.md) |
| Captures d'écran | `public/screenshots/` (téléphone 1080 × 2400, ordinateur 1440 × 900) | Exigées par les fiches des magasins et par l'installation enrichie de Chrome |
| Service worker | `public/takatak-push-sw.js` | Un seul worker pour l'app et les alertes d'offres (même adresse, même portée : les abonnements aux alertes ne sont pas perdus) |
| Page hors connexion | `public/offline.html` | Bilingue, aux couleurs TAKATAK |
| Liaison Android | `/.well-known/assetlinks.json` | Ouvre l'app Google Play sans barre d'adresse. Répond 404 tant que Coolify n'a pas `TAKATAK_ANDROID_CERT_SHA256` |
| Mode télé | `src/lib/pwa/tv-mode.ts` | Sur une télé (ou avec `?tv=1`) : flèches, OK et Retour de la télécommande (Tizen 10009, webOS 461), cadre de sélection bien visible. Condition pour Google TV, Fire TV, Samsung TV, LG webOS et Xbox |
| Sécurité (CSP) | `next.config.ts` | `manifest-src 'self'; worker-src 'self' blob:` : le manifeste et le worker ne viennent que de takatak.ca |
| Images des magasins | [`docs/store-assets/`](store-assets/README.md) | Icônes, bannières, affiches Microsoft, bannières télé, captures téléphone, tablette, ordinateur et télé (pages publiques seulement) |
| Vérification | `npm run qa:pwa` (dans la CI) | Manifeste, tailles réelles des icônes, captures et images des magasins, worker sans cache privé, CSP, mode télé, liaison Android |

**Icône provisoire :** `BRAND.md` demande le logo officiel (`knowledgeAI/brand/logo-circle.png`), qui n'est pas encore déposé. L'icône actuelle (T blanc, flèche bleue, cercle lumineux sur bleu marine) suit les couleurs de BRAND.md. Dès que le fichier officiel est là : `npm run pwa:icons -- chemin/vers/logo-circle.png`, puis commit.

**Réglages Coolify (facultatifs, plus tard) :**
- `TAKATAK_ANDROID_CERT_SHA256` : empreinte SHA-256 du certificat, prise dans Play Console › Intégrité de l'application (plusieurs : séparées par des virgules, 4 au plus).
- `TAKATAK_ANDROID_PACKAGE` : facultatif, `ca.takatak.app` par défaut.

## 2. Inscriptions (le propriétaire les fait lui-même)

Inscrire **l'entreprise Groupe TAKATAK**, pas un particulier. Un compte Google Play *personnel* doit faire tester l'app par 12 personnes pendant 14 jours ; un compte *organisation* en est dispensé. Google et Apple demandent un numéro **D-U-N-S** (gratuit, quelques jours) : le demander en premier. Si BesoinAvocat a déjà été inscrit sous Groupe TAKATAK, **les mêmes comptes servent** : rien à repayer.

Le propriétaire tape lui-même ses mots de passe, codes et paiements.

## 3. Construction des paquets (Claude, après redéploiement de takatak.ca)

1. Vérifier en ligne : `https://takatak.ca/manifest.webmanifest` répond, et https://www.pwabuilder.com donne un résultat sans erreur pour `https://takatak.ca`.
2. **Android** (`.aab`) : identifiant `ca.takatak.app`, Play App Signing ; copier l'empreinte dans `TAKATAK_ANDROID_CERT_SHA256`, redéployer.
3. **Windows** (`.msix`) : « Package ID », « Publisher » et « Publisher display name » viennent de Partner Center › Product identity, après réservation du nom « TAKATAK ».
4. **iPhone, iPad, Mac** : projet Xcode PWABuilder, compilé et signé (Mac ou exécuteur macOS gratuit de GitHub Actions pour dépôt public), puis App Store Connect et TestFlight.

## 4. Tous les magasins et tous les écrans

| # | Plateforme | Appareils | Paquet | Inscription | Dépôt | Coût | Faisabilité |
|---|---|---|---|---|---|---|---|
| 1 | Google Play | téléphones, tablettes, Chromebook | `.aab` (PWABuilder) | https://play.google.com/console/signup | https://play.google.com/console | 25 $ US une fois | Oui |
| 2 | Google TV / Android TV | télés Android | même `.aab`, facteur « TV » | même compte | Play Console › Facteurs de forme › TV | inclus | Oui : mode télé prêt (télécommande) |
| 3 | Apple App Store | iPhone, iPad, Mac | projet Xcode (PWABuilder iOS) | https://developer.apple.com/programs/enroll/ | https://appstoreconnect.apple.com | 99 $ US par an | Oui ; voir règle 4.2 ci-dessous |
| 4 | Apple TV | Apple TV | — | — | — | — | Non sans réécriture (pas de navigateur dans tvOS) |
| 5 | Microsoft Store | Windows 10 et 11 | `.msix` (PWABuilder) | https://storedeveloper.microsoft.com | https://partner.microsoft.com/dashboard | gratuit | Oui |
| 6 | Xbox | consoles Xbox | `.msix` | même compte Microsoft | Partner Center | gratuit | À tester après Windows |
| 7 | Amazon Appstore | tablettes Fire, Fire TV | même `.aab` / `.apk` | https://developer.amazon.com/apps-and-games/console | même lien | gratuit | Oui (tablettes) ; Fire TV : mode télé prêt |
| 8 | Samsung Galaxy Store | Samsung | même `.apk` | https://seller.samsungapps.com | même lien | gratuit | Oui |
| 9 | Samsung Smart TV (Tizen) | télés Samsung | app Web `.wgt` | https://seller.samsungapps.com/tv/ | TV Seller Office | gratuit, partenariat à faire approuver | Possible ; mode télé prêt |
| 10 | LG webOS TV | télés LG | app Web `.ipk` | http://seller.lgappstv.com/seller/member/register/memberMain.lge | http://seller.lgappstv.com | gratuit | Possible ; mode télé prêt |
| 11 | Huawei AppGallery | téléphones Huawei | même `.apk` | https://developer.huawei.com/consumer/en/appgallery | AppGallery Connect | gratuit | Oui |
| 12 | Linux | tout PC | bouton « Installer » du navigateur (déjà actif) ; plus tard Snap | https://snapcraft.io/account | https://snapcraft.io | gratuit | Déjà possible |
| 13 | PlayStation | PS4, PS5 | — | — | — | — | Non (Sony réserve aux jeux et grands services) |
| 14 | Roku | télés Roku | — | — | — | — | Non sans réécriture complète |

**Ordre recommandé :** D-U-N-S et inscriptions entreprise (mêmes comptes que BesoinAvocat et MIMT) → Android (lignes 1, 2, 7, 8, 11) et Windows (5, 6) → Apple (3) → télés Samsung et LG (9, 10).

## 5. Points d'attention

- **Apple, règle 4.2 (« pas juste un site Web ») :** mettre en avant le tableau de bord client, TAK-TAK (assistant à la voix), les alertes d'offres (notifications), les appels et la messagerie.
- **Paiements :** les services sont achetés sur le site. Pas de bouton d'achat dans les apps iOS et Android (règles d'achat intégré).
- **Fiches :** confidentialité `https://takatak.ca/privacy-policy`, conditions `https://takatak.ca/terms-of-service`, soutien `https://takatak.ca/contact`, suppression des données `https://takatak.ca/data-deletion`. Un compte d'essai pour les examinateurs est nécessaire.
- **Questionnaires données (Google, Apple) :** répondre honnêtement : compte, coordonnées, données d'entreprise ; chiffrées en transit ; pas de revente.
- **Logo dans l'en-tête du site :** le composant `src/components/brand/takatak-logo.tsx` montre encore l'ancien « TK » or. À remplacer par le logo officiel dès qu'il est déposé (hors de ce lot, pour ne pas toucher au design sans le fichier officiel).

## 6. Textes des fiches

**Nom :** TAKATAK

**Sous-titre (30 caractères au plus) :** FR « Votre entreprise plus forte » · EN « Your business, stronger online »

**Description courte (80 caractères au plus) :**
- FR : « Site Web, hébergement, marketing et IA : tout votre numérique au même endroit. »
- EN : « Website, hosting, marketing and AI: your whole digital business in one place. »

**Description longue, FR :**
> TAKATAK réunit tout le numérique de votre entreprise dans une seule app. Une équipe de Montréal crée et s'occupe de votre site Web, de votre nom de domaine, de votre hébergement, de votre fiche Google, de vos réseaux sociaux et de vos factures, en français et en anglais.
> • Tableau de bord : services, factures, demandes et résultats
> • TAK-TAK, l'assistant qui vous guide vers le bon service, à la voix ou par écrit
> • Alertes des offres du moment
> • Une vraie personne joignable quand vous en avez besoin
> Digital Solutions. Real Results.

**Description longue, EN :**
> TAKATAK brings your whole digital business into one app. A Montréal team builds and looks after your website, domain, hosting, Google listing, social media and invoices, in English and French.
> • Dashboard: services, invoices, requests and results
> • TAK-TAK, the assistant that guides you to the right service, by voice or text
> • Alerts for current deals
> • A real person when you need one
> Digital Solutions. Real Results.

**Catégorie :** Professionnel / Productivité (Business / Productivity).

## 7. Standard « apps partout » pour chaque marque

Liste à reprendre telle quelle dans chaque dépôt de marque :
1. Manifeste (nom, `id`, `start_url`, `scope`, `display: standalone`, couleurs de la marque, icônes 192/512/maskable, raccourcis, captures narrow + wide).
2. Icônes générées d'une seule source (logo officiel de la marque).
3. Service worker : page hors connexion seulement, jamais de données privées en cache ; un seul worker par site (fusionner avec un worker existant, comme les alertes ici).
4. Page hors connexion aux couleurs de la marque.
5. Mode télé (télécommande) et CSP `manifest-src` / `worker-src`.
6. `/.well-known/assetlinks.json` piloté par variable d'environnement (404 sinon).
7. Images de chaque magasin (`docs/store-assets/`) et test automatique dans la CI.
8. Ce document : inscriptions, paquets, tableau des 14 plateformes, textes des fiches FR/EN.
9. Inscriptions faites une seule fois au nom de Groupe TAKATAK, réutilisées par toutes les marques.
