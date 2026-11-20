# Images des magasins d'applications — TAKATAK

Générées le 2026-11-18 à partir de l'icône de l'app et des couleurs de `BRAND.md` (bleu marine #060D1F, bleu électrique #1F8BFF, cyan #29C3FF).
Les captures montrent uniquement des **pages publiques** de takatak.ca (accueil, services, tarifs, contact) : aucune donnée de client.

Pour les refaire (après un changement de logo ou de design) :
- images : `npm run pwa:icons [logo-circle.png]` puis `node scripts/pwa/make-store-assets.mjs` ;
- captures : lancer le site (`npm run dev -- --port 3000`), puis `node scripts/pwa/store-screenshots.cjs`.

| Magasin | Fichiers |
|---|---|
| Google Play | `google-play-icon-512.png`, `google-play-feature-1024x500.png`, captures `apple-iphone-6.9-*` (téléphone), `android-tablet-10-*` (tablette) |
| Google TV / Android TV | `google-tv-banner-1280x720.png`, `android-tv-banner-320x180.png`, captures `tv-1920x1080-*` |
| Apple App Store | `apple-app-icon-1024.png` (sans transparence), captures `apple-iphone-6.9-*` (1320 × 2868), `apple-ipad-13-*` (2064 × 2752) |
| Microsoft Store | `microsoft-store-logo-300.png`, `microsoft-boxart-1x1-1080.png` / `-2160.png`, `microsoft-poster-2x3-720x1080.png` / `-1440x2160.png`, captures `desktop-1920x1080-*` |
| Xbox | `microsoft-xbox-hero-1920x1080.png`, captures `tv-1920x1080-*` |
| Amazon Appstore / Fire TV | `amazon-icon-114.png`, `amazon-icon-512.png`, `amazon-firetv-banner-1280x720.png`, `amazon-firetv-background-1920x1080.png` |
| Samsung Galaxy Store | `samsung-galaxy-icon-512.png`, `samsung-galaxy-feature-1024x500.png` |
| Samsung TV / LG webOS | `samsung-lg-tv-1920x1080.png`, captures `tv-1920x1080-*` |
| Huawei AppGallery | `huawei-icon-216.png` |

**Mode télé :** sur une télé (Tizen, webOS, Fire TV, Android TV, Xbox…) ou avec `?tv=1`, takatak.ca se pilote aux flèches de la télécommande, OK et Retour (`src/lib/pwa/tv-mode.ts`). `?tv=0` le désactive.

**Icône provisoire :** remplacer par le logo officiel dès qu'il est déposé dans `knowledgeAI/brand/logo-circle.png`, puis refaire les images avec les commandes ci-dessus.
