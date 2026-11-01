# Runway : pack de production vidéo GROUPE TAKATAK

*Scripts, plans Runway et règles, marque par marque et section par section, en 5, 8, 13, 15 et 30 secondes,
plus des vidéos YouTube de 3 minutes. Données machine : `docs/media/runway-pack.json` (même contenu que ce
document, généré à partir des mêmes données : un élément par vidéo, champs `brand`, `section`, `durationSec`,
`aspect`, `placement`, `prompt`, `textFr`, `textEn`, `cta`, `needs`, plus `shots`, les plans Runway au format
du kit ; le dernier élément, `_signature`, n'est pas une vidéo). Architecture de revenus : `docs/marketing/MONETIZATION_ARCHITECTURE.md`.*

## En bref

- **Un seul système de montage :** chaque vidéo se construit avec des **blocs de 5 secondes** générés par
  Runway (ambiance), des **captures d'écran réelles** de nos produits (la preuve) et une **carte de fin bleue**.
  On génère 2 plans Runway par section (A = accroche, B = résultat), en 16:9 et en 9:16, et on en tire les
  5 durées. C'est le même format que le kit existant (`scripts/media/runway-shots.json`, `gen4_turbo`, 5 s).
- **Runway ne dessine jamais une interface.** Tout ce qui est écran (taper « www », toucher « Publier »,
  l'avis Google qui arrive, l'appel que MIMT dirige, la fiche qu'on modifie) vient d'un enregistrement réel
  sur un compte de démonstration. Runway sert à l'ambiance et aux mouvements de caméra.
- **12 sections** (sites web, domaines et hébergement, réseaux sociaux, fiches locales, avis, MIMT, TAK bot,
  facturation, QMAPS, FLEXS, SEO TAKATAK, Academy) × 5 durées = 60 scripts, **9 vidéos YouTube de 3 min**,
  et le complément du pack Clover (déclinaisons courtes des 12 films, bleu au lieu de l'or).
- **Règles qui ne bougent pas :** aucun faux témoignage, aucune personne de banque d'images présentée comme
  client ou employé, aucun prix hors du code, musique sous licence, étiquette IA sur YouTube, Meta et TikTok,
  et chaque plateforme de livraison ne parle que d'elle-même.
- **À régler avant de tourner (propriétaire) :** déposer les fichiers officiels du logo dans
  `knowledgeAI/brand/` (le dossier ne contient encore que le README) ; choisir la source des visages (voir
  § 3.2 : la licence Unsplash gratuite ne couvre pas l'usage publicitaire de personnes reconnaissables) ;
  fournir les enregistrements d'écran (`docs/media/RAW_MATERIAL_REQUEST.md`).

## 0. Ce qui existe déjà (on s'en sert, on ne le refait pas)

| Fichier | Contenu |
| --- | --- |
| `docs/media/VIDEO_PLAN.md` | Les 8 boucles de 5 s du site, la commande `npm run media:videos` |
| `docs/media/FICHES_VIDEO.md` | Les clips de 7 s par service (FR/EN), la chaîne d'outils (Runway, ElevenLabs, Suno, Twelve Labs, Revid) |
| `docs/media/YOUTUBE_PLAN.md`, `youtube-uploads.json` | Organisation de la chaîne, SEO, 18 mises en ligne prêtes |
| `docs/media/RAW_MATERIAL_REQUEST.md` | Les enregistrements d'écran demandés à chaque agent produit |
| `scripts/media/runway-shots.json`, `runway-generate.mjs` | Le kit Runway : `gen4_turbo`, image vers vidéo, 5 s, `1280:720` / `720:1280` (`--vertical`) |
| `public/media/product/` | Vraies captures déjà prêtes : `dashboard.mp4`, `takbot-fr.mp4`, `takbot-en.mp4`, `shot-reviews.webp`, `shot-seo.webp`, `shot-academy.webp` |
| `foodhubca/docs/2026-10-28 18-23 — Pack vidéos Marketplace Clover — scripts storyboards prompts Runway.md` | 12 films Clover (scripts, storyboards, prompts, voix FR/EN). Complément au § 6 ci-dessous |
| `foodhubca/docs/CLOVER_MARKETPLACE_LAUNCH.md` § 6 | Script de la vidéo fonctionnelle Clover (environ 3 min, capture réelle) |

## 1. Formats par placement (vérifiés le 2026-11-01)

| Placement | Durées | Format | Son et texte | Règles clés | Source |
| --- | --- | --- | --- | --- | --- |
| Boucles du site takatak.ca | 5–6 s | 16:9, `1280:720` (kit), MP4 H.264 | muet, **aucun texte incrusté**, boucle sans saut | Le site les joue seulement à l'écran, jamais avec « mouvement réduit » ; la photo sert d'image fixe | interne : `VIDEO_PLAN.md`, `runway-shots.json` |
| Scènes de défilement de l'accueil | 5–8 s | 16:9 (plus 9:16 si la scène est plein écran sur mobile) | muet ; le texte reste en HTML | Même règle que les boucles | interne |
| Reels Instagram et Facebook | 8, 13, 15, 30 s (Reels jusqu'à 3 min) | 9:16, 1080×1920 | voix + sous-titres FR incrustés, version EN séparée | Zone sûre des pubs Meta : laisser libres 14 % en haut, 35 % en bas et 6 % de chaque côté (chiffres relayés par plusieurs guides ; **à vérifier** dans le Meta Ads Guide) | Instagram : Reels de 3 min annoncés par Adam Mosseri, janv. 2025 ([Social Media Today](https://www.socialmediatoday.com/news/instagram-officially-expands-reels-length-to-3-minutes/737766/)) ; zones sûres : [Billo](https://billo.app/blog/meta-ads-safe-zones), [AdNabu](https://blog.adnabu.com/meta-ads/meta-safe-zones/) |
| YouTube Shorts | 8–30 s (jusqu'à 3 min) | 9:16 ou carré | musique : la plupart des chansons limitées à 90 s dans un Short de 3 min (certaines à 60 ou 30 s) | Shorts jusqu'à 3 min depuis le 15 oct. 2024, seulement en carré ou vertical ; un 16:9 n'est jamais un Short | [YouTube Help 15424877](https://support.google.com/youtube/answer/15424877?hl=en), [YouTube Blog](https://blog.youtube/news-and-events/tall-updates-coming-to-shorts/) |
| TikTok | 8–30 s ; **1 min et plus** pour Creator Rewards | 9:16, 1080×1920 | comptes d'affaires : musique de la Commercial Music Library seulement | Seules les vidéos d'au moins 1 min comptent pour Creator Rewards | [Conditions Creator Rewards](https://www.tiktok.com/legal/page/global/creator-rewards-program-us/en), [CML](https://ads.tiktok.com/help/article/commercial-music-library) |
| Zone sûre commune 9:16 | toutes | garder texte et visages dans le centre d'environ 900×1400 px d'un cadre 1080×1920 | — | Aucune plateforme ne publie de valeurs en pixels pour le contenu organique : vérifier dans l'aperçu de chaque app avant de publier | [Adaptlypost 2026](https://adaptlypost.com/blog/social-media-safe-zones-2026-complete-guide) (guide tiers) |
| YouTube vidéo longue | 3 min (+ versions 8–12 min) | 16:9, 1920×1080 | voix + sous-titres FR/EN (fichiers SRT) | Les pubs en milieu de vidéo (mid-roll) n'existent qu'à **8 min et plus** : une vidéo de 3 min n'a que des pubs avant/après | [YouTube Help 6175006](https://support.google.com/youtube/answer/6175006?hl=en) |
| Facebook vidéo longue | 3 min et plus | 16:9 ou 1:1 | sous-titres | Aide annonceurs Meta : les vidéos hôtes doivent durer 3 min ou plus pour recevoir des pubs in-stream ; la 1re pause possible est à 1 min. Les règles côté créateur changent (programme Content Monetization sur invitation) : **à vérifier** dans le Professional Dashboard | [Meta, spécifications in-stream](https://www.facebook.com/business/help/1199881793491951), [Meta, oct. 2024](https://about.fb.com/news/2024/10/monetize-content-facebooks-new-streamlined-program/) |
| Google Business Profile (fiche Google) | **30 s max** | 720p ou plus, **75 Mo max** | — | Contenu lié à l'entreprise qui « représente la réalité », sans modification importante ni usage excessif de l'IA : **tournage réel seulement**, pas de plan Runway | [GBP Help 6103862](https://support.google.com/business/answer/6103862?hl=en), [6123536](https://support.google.com/business/answer/6123536?hl=en), [7213077](https://support.google.com/business/answer/7213077?hl=en) |
| Clover App Market | films 30–45 s ; vidéo fonctionnelle ~3 min | 1920×1080 (+ 1080×1080) | — | La vidéo fonctionnelle montre toute l'intégration, en capture réelle, sur YouTube ou Vimeo non répertoriée | `foodhubca/docs/CLOVER_MARKETPLACE_LAUNCH.md` § 6, pack Clover § 2 |

**Export de montage :** 9:16 en 1080×1920 et 16:9 en 1920×1080, 30 i/s, H.264, son AAC. Runway sort du
`1280:720` / `720:1280` dans le kit : on met à l'échelle au montage (une fonction d'agrandissement existe
peut-être chez Runway : **à vérifier**, hors kit).

## 2. Le système de production

### 2.1 Les blocs

| Bloc | Source | Durée | Contenu |
| --- | --- | --- | --- |
| **A** accroche | Runway, image vers vidéo (`gen4_turbo`) | 5 s générées, coupées à 3–5 s | Une personne, un lieu, un mouvement de caméra. Titre ajouté au montage (sauf boucle du site) |
| **P1, P2, P3** preuve | **Enregistrement d'écran réel** (compte de démo) ou animation au montage sur une capture réelle | 3–7 s chacun | Ce que le produit fait vraiment, une action par bloc |
| **B** résultat | Runway, image vers vidéo | 5 s générées, coupées à 2–5 s | Le bénéfice, en image |
| **FIN** carte de fin | Montage | 3 s (5 s si la phrase est longue) | Fond marine `#060D1F`, logo officiel (`knowledgeAI/brand/logo-circle.png`, sans effet ni recoloration), appel à l'action FR au-dessus, EN dessous, adresse du site en cyan `#29C3FF` |

| Durée | Assemblage | Usage principal |
| --- | --- | --- |
| **5 s** | A (5 s) | Boucle du site (16:9, muette, sans texte) ; bumper Stories/Shorts (9:16, titre au montage) |
| **8 s** | A (0–5) + FIN (5–8) | Reels, Shorts, TikTok, Stories ; scène de défilement de l'accueil en 16:9 (sans la carte de fin) |
| **13 s** | A (0–4) + P1 (4–10) + FIN (10–13) | Reels, Shorts, TikTok, publicité Meta |
| **15 s** | A (0–4) + P1 (4–8) + P2 (8–12) + FIN (12–15) | Reels, Shorts, TikTok, publicités Meta et YouTube |
| **30 s** | A (0–4) + P1 (4–11) + P2 (11–18) + P3 (18–23) + B (23–27) + FIN (27–30) | Page de service du site, YouTube, Meta ; version « tournage réel » pour la fiche Google |
| **3 min** | A + chapitres de démonstration réelle + B + écran de fin | YouTube, Facebook (vidéo de 3 min et plus), Academy (§ 5) |

Quand la carte de fin dure 5 s (phrase plus longue, par exemple la fiche locale), les blocs d'avant
raccourcissent d'autant ; les minutages exacts sont dans chaque tableau.

### 2.2 Runway : ce que le kit fait, et rien de plus

- **Modèle et paramètres :** ceux du kit, sans en inventer : `gen4_turbo`, `image_to_video`, `duration: 5`,
  `ratio: 1280:720` (16:9) ou `720:1280` (9:16, option `--vertical`). Le modèle `gen4_turbo` exige une image de
  départ (`promptImage`) : chaque plan part d'une photo.
- **Plus long que 5 s ?** Le journal des changements de Runway indique que `gen4_turbo` accepte maintenant
  de 2 à 10 s ; **à vérifier** dans la référence de l'API avant de changer le kit. On reste à 5 s et on
  assemble au montage.
- **Texte vers vidéo :** Runway le fait avec `gen4.5` sur `POST /v1/text_to_video` (sans image) ; ce n'est
  **pas dans notre kit** et c'est **à vérifier** avant usage. Aucun script ici n'en dépend.
- **Sources Runway :** [modèles](https://docs.dev.runwayml.com/guides/models/), [paramètres](https://docs.dev.runwayml.com/assets/inputs/), [changelog](https://docs.dev.runwayml.com/api-details/api_changelog/) (consultés par recherche le 2026-11-01 ; l'accès direct à ces pages était bloqué dans cette session).
- **Écriture des prompts :** une phrase en anglais, sujet + geste + lumière + mouvement de caméra, puis
  toujours `realistic, no text, no logos` (et `screen not readable` dès qu'un écran est visible).
  Mouvements utilisés : `slow push-in`, `slow pull-back`, `slow lateral move`, `slow arc`, `slight handheld
  drift`, `slow dolly`.
- **Budget :** 12 sections × 2 plans (A, B) × 2 formats = 48 plans de 5 s, soit 240 s de génération. Le
  compte TAKATAK a acheté 1 000 crédits le 2026-10-06 (`FICHES_VIDEO.md`) ; le coût en crédits par seconde
  de `gen4_turbo` est **à vérifier** dans le portail avant de lancer. Règle maison : un seul essai par plan.
- **Lancer :** ajouter les plans voulus à `scripts/media/runway-shots.json` (format `key`, `photo`, `prompt` ;
  les clés et prompts sont dans `runway-pack.json` › `shots`), puis `npm run media:videos -- --run --only
  <clés>` et `--vertical` pour le 9:16.

### 2.3 Voix, musique, sous-titres, contrôle

- **Voix off :** ElevenLabs (profil « takatak ca »), FR québécois posé, EN nord-américain calme. Pour les
  vidéos YouTube de 3 min, une vraie voix (Matt ou l'équipe) vaut mieux : c'est plus authentique et ça
  protège la monétisation (§ 3.4).
- **Musique :** une seule famille sonore (le thème maître du pack Clover, piano feutré ~90 BPM, décliné par
  section). Sources permises au § 3.5.
- **Sous-titres :** toujours. Incrustés en 9:16 (dans la zone sûre), fichier SRT sur YouTube et Facebook.
- **Contrôle qualité avant publication :** Twelve Labs (plan Plus) ou relecture humaine : aucun texte parasite
  généré, aucun logo inventé, aucun prix faux, aucune donnée réelle à l'écran, durée exacte, zone sûre.
- **Nommage :** `<section>-<durée>s-<fr|en>-<9x16|16x9>.mp4`, par exemple `local-15s-fr-9x16.mp4`.
  Dossiers : `public/media/social/` (9:16), `public/media/videos/` (16:9 du site).

## 3. Règles (chaque vidéo, chaque plateforme)

### 3.1 Vérité

- **Aucun faux témoignage.** Un avis, une citation ou un résultat à l'écran vient d'un vrai client, avec son
  accord écrit (`YOUTUBE_PLAN.md`, « Témoignages de 10 secondes »). Un avis montré pour la démonstration porte
  l'étiquette « Avis d'exemple · Sample review », sans nom ni commerce réel.
- **Aucun prix inventé, aucun rabais inventé.** Seulement les prix de `src/lib/website/pricing.ts`,
  `core-categories.ts` (qui lit `src/lib/billing/social/plan-catalog.ts`) et `mimt-plans.ts`, en dollars
  canadiens et « avant taxes ». On revérifie le fichier le jour de l'export. Les packs de crédits IA de
  `src/lib/growth/ai-engine.ts` sont marqués **DRAFT** : jamais à l'écran tant que le paiement n'est pas ouvert.
- **Le statut réel de chaque produit** (code du 2026-11-01) : en ligne = sites web, domaines, hébergement,
  fiches locales, facturation, QMAPS, FLEXS ; accès anticipé = réseaux sociaux, avis, TAK bot, SEO TAKATAK ;
  bientôt = Academy (pas encore d'adresse publique), CH4T ; **prélancement = MIMT** (takatak.ca dit « pas
  encore lancé, liste d'attente ») ; les apps Clover sont des brouillons au portail. Une fonction marquée
  « s'en vient » dans le code (par exemple les brouillons de réponse IA aux avis) porte l'étiquette
  « Bientôt · Coming soon » à l'écran.
- **Aucune promesse non prouvée :** pas de « 1re place sur Google », pas de « +300 % de clients », pas de
  nombre d'utilisateurs ou de pros inventé.

### 3.2 Personnes à l'écran

- **Aucune personne de banque d'images présentée comme client ou employé** (règle de `public/photos/CREDITS.md`).
- **Attention, licence Unsplash :** la licence gratuite permet l'usage commercial, mais elle **n'inclut pas le
  droit d'utiliser l'image d'une personne reconnaissable** ; selon l'usage, il faut sa permission. Un
  usage qui fait la promotion d'un produit demande normalement une décharge de modèle
  ([licence Unsplash](https://unsplash.com/license), [aide Unsplash](https://help.unsplash.com/en/articles/6604664-when-do-i-need-to-get-a-model-release)).
  Nos 5 photos (`public/photos/`) montrent des visages. Elles restent correctes comme ambiance du site, mais
  pour la **publicité payée et les vidéos monétisées**, choisir l'une de ces sources :
  1. photos **Unsplash+** (décharges de modèle et de propriété incluses, selon Unsplash) ;
  2. notre propre tournage avec une **décharge signée** (Matt, l'équipe, un client qui accepte) ;
  3. plans sans visage reconnaissable (mains, dos, silhouettes floues) ;
  4. jamais le visage d'une vraie personne recréé ou modifié par l'IA sans son accord écrit.
- Mineurs : jamais.

### 3.3 Données

- Comptes de démonstration seulement. Aucune donnée réelle de marchand, de client ou d'employé : pas de vrai
  nom de commerce, de commande, de montant, de numéro de téléphone ni de courriel. Numéros fictifs du plan
  nord-américain réservé à la fiction : `514-555-0100` à `514-555-0199`.
- Le marchand Clover **`RNVTBYMCKXEJ1`** (On2GO.ca, dormant) n'apparaît jamais, même en lecture. **Po Poulet
  NDG** n'est jamais filmé ni nommé.
- Paiements filmés en mode test seulement, aucun numéro de carte visible.

### 3.4 IA : étiquettes et monétisation

Nos plans Runway animent des photos réalistes : ce sont des images **réalistes modifiées par l'IA**. On les
déclare partout, même quand la règle laisse une marge.

| Plateforme | Quand | Comment | Source |
| --- | --- | --- | --- |
| YouTube | Contenu réaliste modifié ou synthétique (une vraie personne qui semble faire ce qu'elle n'a pas fait, une scène réaliste générée) | YouTube Studio › Attributs › « Utilisation de l'IA » : **Oui**. L'étiquette apparaît sous le lecteur (vidéo longue) ou en surimpression (Shorts). Depuis mai 2026, YouTube détecte aussi l'IA (métadonnées C2PA, signaux) et étiquette lui-même ; ne pas déclarer peut mener au retrait du contenu ou à une suspension du programme partenaire | [YouTube Help 14328491](https://support.google.com/youtube/answer/14328491?hl=en), [YouTube Blog](https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/) |
| Facebook, Instagram | Vidéo photoréaliste ou audio réaliste créé ou modifié numériquement, y compris par l'IA | Activer l'étiquette « Infos sur l'IA » (*AI info*) au moment de publier ; pénalités possibles si elle manque | [Meta Help](https://www.meta.com/en-gb/help/artificial-intelligence/1783222608822690/) |
| TikTok | Contenu IA ou très retouché qui montre des scènes ou des personnes réalistes | Interrupteur « Contenu généré par l'IA » (ou légende, autocollant) ; TikTok étiquette aussi par C2PA, étiquette alors impossible à retirer. La narration TTS générique n'a pas besoin d'étiquette | [TikTok Support](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content), [Règles de la communauté](https://www.tiktok.com/community-guidelines/en-GB/integrity-authenticity?cgversion=2025H2update) |
| Fiche Google | — | Pas d'IA : tournage réel | [GBP Help 6123536](https://support.google.com/business/answer/6123536?hl=en) |
| Règle maison | Toujours | Description : « Certaines images ont été créées avec l'IA (Runway). Voix : ElevenLabs. » / "Some images were created with AI (Runway). Voice: ElevenLabs." | Ad Standards a ajouté le contenu généré par IA à ses lignes directrices en oct. 2025 ([Gowling WLG](https://gowlingwlg.com/en/insights-resources/articles/2025/updated-influencer-marketing-disclosure-guidelines-in-canada)) |

**Monétisation YouTube et contenu « non authentique » :** depuis le 15 juillet 2025, YouTube appelle
« contenu non authentique » le contenu répétitif ou produit en masse ; il n'est pas monétisable, et la
décision vise toute la chaîne. L'IA est permise si le contenu est original et apporte une vraie valeur
([YouTube Help 1311392](https://support.google.com/youtube/answer/1311392?hl=en)). Pour nous :

- sur YouTube, publier **une** version par sujet (un Short de 15–30 s et une vidéo de 3 min), pas les 5 durées ;
  les 5, 8 et 13 s servent au site, aux Stories et aux publicités ;
- les 3 min reposent sur une vraie démonstration et une vraie explication (voix humaine de préférence) ;
- éviter de mettre en ligne les versions FR et EN quasi identiques côte à côte sur la même chaîne. Le plan
  actuel (`youtube-uploads.json`) prévoit 8 Shorts FR + 8 Shorts EN presque pareils : **risque à surveiller**.
  Préférer une chaîne FR avec titres, descriptions et sous-titres traduits (piste audio EN si YouTube
  l'offre au compte : **à vérifier**), ou une chaîne EN distincte.

### 3.5 Musique sous licence (sûre pour la monétisation)

| Source | Où | Ce qu'on sait | Source |
| --- | --- | --- | --- |
| Bibliothèque audio YouTube | YouTube seulement | Monétisable dans le programme partenaire, pas de réclamation Content ID. Licence standard : sans mention ; licence Creative Commons : créditer l'artiste dans la description. Valide pour plusieurs vidéos YouTube | [YouTube Help 3376882](https://support.google.com/youtube/answer/3376882?hl=en) |
| Meta Sound Collection | Facebook, Instagram | Présentée comme utilisable à des fins commerciales, y compris en publicité : **à vérifier** dans les conditions de Meta | guide tiers ([Fohr](https://www.fohr.co/blog/how-to-find-royalty-free-sounds-music-for-sponsored-posts-on-tiktok)) |
| TikTok Commercial Music Library | TikTok seulement | Environ 1 million de titres pré-autorisés pour l'usage commercial ; les comptes d'affaires ne peuvent pas utiliser la bibliothèque générale ; licence limitée à TikTok | [TikTok Ads Help](https://ads.tiktok.com/help/article/commercial-music-library) |
| Suno (forfait payant Pro ou Premier) | toutes plateformes | Droits d'usage commercial pour les chansons créées pendant un abonnement payant, y compris YouTube monétisé ; les conditions ont changé fin 2025 / 2026 : **à vérifier** sur suno.com et garder la preuve du forfait à la date de création | résumés tiers ([Dynamoi](https://dynamoi.com/learn/ai-music-distribution/suno-commercial-rights-explained), [terms.law](https://terms.law/ai-output-rights/suno/)) |
| Interdit | partout | Chansons du commerce, musique « gratuite » prise sur un site quelconque (Content ID peut la réclamer quand même) | [YouTube Help 15577610](https://support.google.com/youtube/answer/15577610?hl=en) |

Note : YouTube annonce la fin progressive des licences payantes de Creator Music à partir d'août 2026
([YouTube Help 11610609](https://support.google.com/youtube/answer/11610609?hl=en)) : ne pas compter dessus.

### 3.6 Plateformes de livraison, marques de tiers, langue

- **Chaque plateforme de livraison n'entend parler que d'elle-même.** Une vidéo destinée à DoorDash (portail,
  demande de menu, soutien, campagne commune) ne nomme ni ne montre Uber Eats, SkipTheDishes ou Too Good To Go,
  et l'inverse. Nos propres canaux (takatak.ca, notre chaîne YouTube, nos réseaux) peuvent en montrer
  plusieurs. Food Hub, Clover et UrbanPiper peuvent être nommés.
- **Logos de tiers** (Facebook, Instagram, TikTok, Google, Clover, Stripe, moteurs d'IA) : seulement les
  fichiers officiels des centres de marque, sans déformation ; les noms des moteurs d'IA de TAK bot en texte
  seulement. Les chartes de Meta et TikTok limitent certains usages et animations de leurs logos : **à
  vérifier** avant d'animer les icônes.
- **Français d'abord.** Au Québec, une publication commerciale sur les réseaux sociaux doit exister en français,
  ou sa version française doit être accessible dans des conditions au moins équivalentes ; quand deux langues
  sont sur la même image, le français doit être au moins aussi visible (affichage public : nettement
  prédominant, règlement en vigueur depuis le 1er juin 2025) ([Éducaloi](https://educaloi.qc.ca/actualites-juridiques/droits-linguistiques-de-nouvelles-regles-pour-les-entreprises/), [DLA Piper](https://www.dlapiper.com/fr-ca/insights/publications/2025/06/quebecs-language-laws-changed-this-week)). L'application exacte à la vidéo est **à vérifier** dans le guide de l'OQLF sur les médias sociaux.
  Notre règle : une version FR et une version EN séparées ; quand les deux langues partagent une carte de fin,
  le français est au-dessus et au moins aussi grand.
- **Couleurs :** bleu électrique `#1F8BFF` sur marine `#060D1F`, ou le thème clair du site (bleu `#1565D8`
  sur blanc). Vert, ambre et rouge pour les statuts seulement (« Succès, vous êtes en ligne » en vert est un
  statut : permis). Jamais l'or, jamais l'ancien logo « TK ».

## 4. Scripts, marque par marque et section par section

Chaque section donne d'abord ce qui est commun à ses 5 durées (statut, appel à l'action, musique, matériel
réel à fournir, plans Runway, règles propres), puis un tableau par durée. Colonnes : temps, bloc, image,
texte à l'écran FR et EN, voix off FR et EN. La version EN est un montage séparé (même image, texte EN).

### 4.1 TAKATAK — Sites web / Websites

- **Statut (code) :** En ligne (core-categories.ts : availability "live")
- **Lien :** takatak.ca/services/websites · **Appel à l'action :** Créez votre site sur takatak.ca / Build your website at takatak.ca
- **Musique :** Électro-pop douce et optimiste, ~100 BPM ; un petit « clic » sonore au moment du clic.
- **Prix :** Optionnel, carte de fin 30 s : « Sites web à partir de 499 $, avant taxes » (pricing.ts › websites › Starter Website).
- **Matériel réel à fournir :**
  - Capture d'écran : navigateur, « www. » tapé lettre par lettre puis l'adresse d'un site de démo TAKATAK, clic
  - Capture : la page du site de démo qui s'affiche (ordinateur, puis téléphone)
  - Capture : /dashboard/leads/inbox avec une demande de démonstration
  - Animation au montage : bulle verte « Succès, vous êtes en ligne » (vert = statut, permis)
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-website-a` — déjà dans `runway-shots.json` sous la clé `website`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/commerce-cafe.webp` · slow push-in  
    `Slow cinematic push-in on the café owner talking on the phone behind his counter, warm morning light through the window, soft steam rising from a cup, gentle natural movement, shallow depth of field, realistic, no text, no logos.`
  - **B** (`pack-website-b` — déjà dans `runway-shots.json` sous la clé `domains`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/hero-cafe.webp` · slight handheld drift  
    `A woman in a café smiles at her phone and looks up, soft daylight, slight handheld camera drift, background patrons blurred and moving gently, realistic documentary style, no text, no logos.`
- **Règles propres :**
  - Le site montré est un site de démonstration bâti par TAKATAK, jamais un site client sans son accord écrit.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : propriétaire de café au téléphone, travelling avant (5 s, boucle) | Site : aucun · Bumper : Votre commerce mérite un site à sa hauteur. | Site: none · Bumper: Your business deserves a website that matches it. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : propriétaire de café au téléphone, travelling avant | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/services/websites | Créez votre site sur takatak.ca | Build your website at takatak.ca | Commencez sur takatak.ca. | Start at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : propriétaire de café au téléphone, travelling avant | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. |
| 0:04–0:10 | P1 | Capture : « www. » tapé dans la barre d'adresse, puis clic | www.votrecommerce.ca | www.yourbusiness.ca | Vous tapez votre adresse… | You type your address… |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/services/websites | Créez votre site sur takatak.ca | Build your website at takatak.ca | Commencez sur takatak.ca. | Start at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : propriétaire de café au téléphone, travelling avant | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. |
| 0:04–0:08 | P1 | Capture : « www. » tapé dans la barre d'adresse, puis clic | www.votrecommerce.ca | www.yourbusiness.ca | Vous tapez votre adresse… | You type your address… |
| 0:08–0:12 | P2 | Capture : la page apparaît + bulle verte | Succès, vous êtes en ligne | Success, you're online | …et votre site est en ligne. | …and your site is live. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/services/websites | Créez votre site sur takatak.ca | Build your website at takatak.ca | Commencez sur takatak.ca. | Start at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : propriétaire de café au téléphone, travelling avant | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. | Votre commerce mérite un site à sa hauteur. | Your business deserves a website that matches it. |
| 0:04–0:11 | P1 | Capture : « www. » tapé dans la barre d'adresse, puis clic | www.votrecommerce.ca | www.yourbusiness.ca | Vous tapez votre adresse… | You type your address… |
| 0:11–0:18 | P2 | Capture : la page apparaît + bulle verte | Succès, vous êtes en ligne | Success, you're online | …et votre site est en ligne. | …and your site is live. |
| 0:18–0:23 | P3 | Capture : une demande de client arrive dans le tableau de bord | Chaque demande arrive dans votre tableau de bord | Every request lands in your dashboard | Chaque demande de client arrive dans votre tableau de bord. | Every customer request goes straight to your dashboard. |
| 0:23–0:27 | B | Plan B : cliente qui sourit à son téléphone | Conçu, lancé et entretenu par notre équipe. | Designed, launched and looked after by our team. | Design sur mesure, mobile d'abord, bases SEO : notre équipe s'en occupe. | Custom design, mobile first, SEO foundations: our team takes care of it. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/services/websites | Créez votre site sur takatak.ca | Build your website at takatak.ca | Commencez sur takatak.ca. | Start at takatak.ca. |

### 4.2 TAKATAK — Domaines et hébergement / Domains and hosting

- **Statut (code) :** En ligne (domaines et hébergement : availability "live")
- **Lien :** takatak.ca/domain · takatak.ca/hosting · **Appel à l'action :** Trouvez votre domaine sur takatak.ca / Find your domain at takatak.ca
- **Musique :** Pulsation électronique calme, ~95 BPM, sensation de sécurité.
- **Prix :** Optionnel, carte de fin 15 et 30 s : « Domaines à partir de 19,99 $/an · Hébergement à partir de 9,99 $/mois, avant taxes » (pricing.ts › domain.register, hosting › Portfolio).
- **Matériel réel à fournir :**
  - Capture : recherche sur takatak.ca/domain avec un nom fictif, résultats .ca .com .net .org
  - Capture : panier et paiement en mode test
  - Capture : panneau d'hébergement d'un compte de démo (SSL actif, sauvegarde du jour)
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-domains-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/hero-cafe.webp` · slow push-in  
    `Slow push-in on a woman at a café table as she types on her phone and nods, soft daylight, background blurred, screen not readable, realistic, no text, no logos.`
  - **B** (`pack-domains-b` — déjà dans `runway-shots.json` sous la clé `hosting`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow push-in  
    `A professional on a phone call nods and types on her laptop, calm modern office, slow push-in, soft light, realistic, no text, no logos.`
- **Règles propres :**
  - Nom de domaine fictif (votremarque.ca) ; paiement filmé en mode test, aucun numéro de carte ni donnée personnelle.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : cliente qui tape sur son téléphone au café (5 s, boucle) | Site : aucun · Bumper : Votre nom, en ligne, aujourd'hui. | Site: none · Bumper: Your name, online, today. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : cliente qui tape sur son téléphone au café | Votre nom, en ligne, aujourd'hui. | Your name, online, today. | Votre nom, en ligne, aujourd'hui. | Your name, online, today. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/domain · takatak.ca/hosting | Trouvez votre domaine sur takatak.ca | Find your domain at takatak.ca | Trouvez votre domaine sur takatak.ca. | Find your domain at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui tape sur son téléphone au café | Votre nom, en ligne, aujourd'hui. | Your name, online, today. | Votre nom, en ligne, aujourd'hui. | Your name, online, today. |
| 0:04–0:10 | P1 | Capture : recherche d'un nom sur takatak.ca/domain | votremarque.ca · Disponible | yourbrand.ca · Available | Cherchez votre .ca, .com, .net ou .org. | Search for your .ca, .com, .net or .org. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/domain · takatak.ca/hosting | Trouvez votre domaine sur takatak.ca | Find your domain at takatak.ca | Trouvez votre domaine sur takatak.ca. | Find your domain at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui tape sur son téléphone au café | Votre nom, en ligne, aujourd'hui. | Your name, online, today. | Votre nom, en ligne, aujourd'hui. | Your name, online, today. |
| 0:04–0:08 | P1 | Capture : recherche d'un nom sur takatak.ca/domain | votremarque.ca · Disponible | yourbrand.ca · Available | Cherchez votre .ca, .com, .net ou .org. | Search for your .ca, .com, .net or .org. |
| 0:08–0:12 | P2 | Capture : ajout au panier, paiement (mode test) | Réservé. Payé en ligne. | Reserved. Paid online. | Réservez et payez en ligne. | Reserve it and pay online. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/domain · takatak.ca/hosting | Trouvez votre domaine sur takatak.ca | Find your domain at takatak.ca | Trouvez votre domaine sur takatak.ca. | Find your domain at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui tape sur son téléphone au café | Votre nom, en ligne, aujourd'hui. | Your name, online, today. | Votre nom, en ligne, aujourd'hui. | Your name, online, today. |
| 0:04–0:11 | P1 | Capture : recherche d'un nom sur takatak.ca/domain | votremarque.ca · Disponible | yourbrand.ca · Available | Cherchez votre .ca, .com, .net ou .org. | Search for your .ca, .com, .net or .org. |
| 0:11–0:18 | P2 | Capture : ajout au panier, paiement (mode test) | Réservé. Payé en ligne. | Reserved. Paid online. | Réservez et payez en ligne. | Reserve it and pay online. |
| 0:18–0:23 | P3 | Capture : panneau d'hébergement de démo | SSL actif · Sauvegardé aujourd'hui | SSL on · Backed up today | Hébergement avec SSL gratuit et sauvegardes quotidiennes. | Hosting with free SSL and daily backups. |
| 0:23–0:27 | B | Plan B : professionnelle en appel à son portable | Une vraie équipe au Canada. | A real team in Canada. | Configuré et soutenu par une équipe au Canada. | Set up and supported by a team in Canada. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/domain · takatak.ca/hosting | Trouvez votre domaine sur takatak.ca | Find your domain at takatak.ca | Trouvez votre domaine sur takatak.ca. | Find your domain at takatak.ca. |

### 4.3 TAKATAK — Réseaux sociaux / Social media

- **Statut (code) :** Accès anticipé (availability "early") ; 9 réseaux branchables (SOCIAL_NETWORKS_LIVE)
- **Lien :** takatak.ca/services/social-media · **Appel à l'action :** Branchez vos réseaux sur takatak.ca / Connect your networks at takatak.ca
- **Musique :** Pop rythmée, ~110 BPM ; un « pop » sonore à chaque icône.
- **Prix :** Optionnel, carte de fin 30 s : « Logiciel à partir de 20 $/mois, avant taxes » (core-categories.ts › social › plan Social Essential).
- **Matériel réel à fournir :**
  - Icônes officielles Facebook, Instagram, TikTok (centres de marque)
  - Capture : compositeur social du tableau de bord TAKATAK avec une marque de démo
  - Tournage réel : un doigt qui touche « Publier » sur un téléphone ou une tablette (écran réel incrusté au montage)
  - Capture : calendrier et statistiques de la marque de démo
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-social-a` — déjà dans `runway-shots.json` sous la clé `social`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/hero-cafe.webp` · slow dolly  
    `Close, slow dolly toward her hands holding a phone over a wooden café table, thumb scrolling, warm light, realistic, calm pace, no text, no logos.`
  - **B** (`pack-social-b` — déjà dans `runway-shots.json` sous la clé `marketing`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/studio-design.webp` · slow lateral move  
    `A designer on the phone in her bright studio laughs and turns to her laptop, fabric samples sway slightly, slow lateral camera move, realistic, editorial, no text, no logos.`
- **Règles propres :**
  - Montrer seulement les réseaux de SOCIAL_NETWORKS_LIVE (Facebook, Instagram, Threads, TikTok, YouTube, X, Bluesky, Twitch, Google Business Profile). LinkedIn et Pinterest sont « bientôt » : jamais présentés comme branchés.
  - Icônes officielles seulement, sans déformation (chartes Meta et TikTok à vérifier avant de les animer).

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : mains qui font défiler un téléphone (5 s, boucle) | Site : aucun · Bumper : Une publication. Tous vos réseaux. | Site: none · Bumper: One post. Every network. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : mains qui font défiler un téléphone | Une publication. Tous vos réseaux. | One post. Every network. | Une publication, tous vos réseaux. | One post, every network. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/services/social-media | Branchez vos réseaux sur takatak.ca | Connect your networks at takatak.ca | Branchez vos réseaux sur takatak.ca. | Connect your networks at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui font défiler un téléphone | Une publication. Tous vos réseaux. | One post. Every network. | Une publication, tous vos réseaux. | One post, every network. |
| 0:04–0:10 | P1 | Animation : icônes Facebook, Instagram, TikTok qui apparaissent, puis petit tableau de bord (capture réelle) | Facebook · Instagram · TikTok… | Facebook · Instagram · TikTok… | Facebook, Instagram, TikTok et plus, au même endroit. | Facebook, Instagram, TikTok and more, in one place. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/services/social-media | Branchez vos réseaux sur takatak.ca | Connect your networks at takatak.ca | Branchez vos réseaux sur takatak.ca. | Connect your networks at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui font défiler un téléphone | Une publication. Tous vos réseaux. | One post. Every network. | Une publication, tous vos réseaux. | One post, every network. |
| 0:04–0:08 | P1 | Animation : icônes Facebook, Instagram, TikTok qui apparaissent, puis petit tableau de bord (capture réelle) | Facebook · Instagram · TikTok… | Facebook · Instagram · TikTok… | Facebook, Instagram, TikTok et plus, au même endroit. | Facebook, Instagram, TikTok and more, in one place. |
| 0:08–0:12 | P2 | Tournage réel : un doigt touche « Publier » ; bulle verte | Publié sur tous vos réseaux | Posted to all your networks | Vous touchez Publier : c'est en ligne partout. | Tap Publish: it's live everywhere. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/services/social-media | Branchez vos réseaux sur takatak.ca | Connect your networks at takatak.ca | Branchez vos réseaux sur takatak.ca. | Connect your networks at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui font défiler un téléphone | Une publication. Tous vos réseaux. | One post. Every network. | Une publication, tous vos réseaux. | One post, every network. |
| 0:04–0:11 | P1 | Animation : icônes Facebook, Instagram, TikTok qui apparaissent, puis petit tableau de bord (capture réelle) | Facebook · Instagram · TikTok… | Facebook · Instagram · TikTok… | Facebook, Instagram, TikTok et plus, au même endroit. | Facebook, Instagram, TikTok and more, in one place. |
| 0:11–0:18 | P2 | Tournage réel : un doigt touche « Publier » ; bulle verte | Publié sur tous vos réseaux | Posted to all your networks | Vous touchez Publier : c'est en ligne partout. | Tap Publish: it's live everywhere. |
| 0:18–0:23 | P3 | Capture : calendrier de contenu et statistiques | Planifié · Mesuré · Approuvé | Scheduled · Measured · Approved | Planifiez, mesurez, faites approuver. | Schedule, measure, get approvals. |
| 0:23–0:27 | B | Plan B : designer qui rit au téléphone et revient à son portable | Ou confiez le tout à notre équipe. | Or hand it all to our team. | Ou laissez notre équipe s'en occuper. | Or let our team handle it. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/services/social-media | Branchez vos réseaux sur takatak.ca | Connect your networks at takatak.ca | Branchez vos réseaux sur takatak.ca. | Connect your networks at takatak.ca. |

### 4.4 TAKATAK — Fiches locales · SEO local / Local listings · local SEO

- **Statut (code) :** En ligne (availability "live") ; « L'IA fait les mises à jour, notre équipe les vérifie » (home-funnel.ts, homeV3)
- **Lien :** takatak.ca/services/local-listings · **Appel à l'action :** Inscrivez-vous sur takatak.ca / Sign up at takatak.ca
- **Phrase de fin (13, 15, 30 s, carte de 5 s) :** « L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. » / "AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up."
- **Musique :** Acoustique chaleureuse (guitare, piano), ~90 BPM.
- **Prix :** Optionnel, carte de fin 30 s : « Mise en place à partir de 99 $, avant taxes » (pricing.ts › local › Listing Setup).
- **Matériel réel à fournir :**
  - Capture : modification d'une fiche d'entreprise de démo dans le tableau de bord TAKATAK : heures, heures spéciales (Fêtes), téléphone
  - Capture : ajout d'un menu et d'une photo (photo dont on détient les droits)
  - Capture : la fiche à jour dans Google Maps ou la recherche, et les vues, appels et itinéraires dans le tableau de bord
  - Pour la fiche Google : tournage réel du commerce (devanture, comptoir), sans Runway
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-local-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/commerce-cafe.webp` · slow lateral move  
    `Slow lateral move past the café counter as the owner glances at his phone and smiles, warm morning light, shallow depth of field, realistic, no text, no logos.`
  - **B** (`pack-local-b` — déjà dans `runway-shots.json` sous la clé `local`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/artisan-atelier.webp` · slow arc  
    `A craftsman in his workshop celebrates reading his phone, dust particles floating in a beam of light, slow camera arc, realistic, joyful, no text, no logos.`
- **Règles propres :**
  - Phrase de fin demandée par le propriétaire, gardée telle quelle. Elle reste vraie tant que le code dit « l'IA fait les mises à jour, notre équipe les vérifie » ; la voix du 30 s le rappelle.
  - Fiche filmée : celle de TAKATAK ou une fiche de démo, jamais celle d'un client sans son accord écrit. Téléphone fictif 514-555-01XX.
  - Version fiche Google (Google Business Profile) : remplacer A et B par du tournage réel, 30 s max, 75 Mo max, 720p ou plus.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : propriétaire de café qui regarde son téléphone (5 s, boucle) | Site : aucun · Bumper : Quand on cherche près d'ici, c'est vous qu'on trouve. | Site: none · Bumper: When people search nearby, they find you. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : propriétaire de café qui regarde son téléphone | Quand on cherche près d'ici, c'est vous qu'on trouve. | When people search nearby, they find you. | Quand on cherche près d'ici, c'est vous qu'on doit trouver. | When people search nearby, they should find you. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/services/local-listings | Inscrivez-vous sur takatak.ca | Sign up at takatak.ca | Inscrivez-vous sur takatak.ca. | Sign up at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:03 | A | Plan A : propriétaire de café qui regarde son téléphone | Quand on cherche près d'ici, c'est vous qu'on trouve. | When people search nearby, they find you. | Quand on cherche près d'ici, c'est vous qu'on doit trouver. | When people search nearby, they should find you. |
| 0:03–0:08 | P1 | Capture : on modifie les heures, les heures des Fêtes, le téléphone | Heures · Heures des Fêtes · Téléphone | Hours · Holiday hours · Phone | Vos heures, vos heures des Fêtes, votre numéro… | Your hours, your holiday hours, your number… |
| 0:08–0:13 | FIN | Carte de fin (5 s) : logo officiel, takatak.ca/services/local-listings | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:03 | A | Plan A : propriétaire de café qui regarde son téléphone | Quand on cherche près d'ici, c'est vous qu'on trouve. | When people search nearby, they find you. | Quand on cherche près d'ici, c'est vous qu'on doit trouver. | When people search nearby, they should find you. |
| 0:03–0:07 | P1 | Capture : on modifie les heures, les heures des Fêtes, le téléphone | Heures · Heures des Fêtes · Téléphone | Hours · Holiday hours · Phone | Vos heures, vos heures des Fêtes, votre numéro… | Your hours, your holiday hours, your number… |
| 0:07–0:10 | P2 | Capture : on ajoute le menu et une photo | Menu · Photos | Menu · Photos | …votre menu et vos photos, à jour en quelques clics. | …your menu and photos, updated in a few clicks. |
| 0:10–0:15 | FIN | Carte de fin (5 s) : logo officiel, takatak.ca/services/local-listings | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : propriétaire de café qui regarde son téléphone | Quand on cherche près d'ici, c'est vous qu'on trouve. | When people search nearby, they find you. | Quand on cherche près d'ici, c'est vous qu'on doit trouver. | When people search nearby, they should find you. |
| 0:04–0:10 | P1 | Capture : on modifie les heures, les heures des Fêtes, le téléphone | Heures · Heures des Fêtes · Téléphone | Hours · Holiday hours · Phone | Vos heures, vos heures des Fêtes, votre numéro… | Your hours, your holiday hours, your number… |
| 0:10–0:16 | P2 | Capture : on ajoute le menu et une photo | Menu · Photos | Menu · Photos | …votre menu et vos photos, à jour en quelques clics. | …your menu and photos, updated in a few clicks. |
| 0:16–0:21 | P3 | Capture : la fiche à jour dans Maps + vues, appels, itinéraires | À jour partout | Up to date everywhere | Partout où vos clients cherchent. Notre équipe vérifie chaque changement. | Everywhere your customers search. Our team checks every change. |
| 0:21–0:25 | B | Plan B : artisan qui célèbre en lisant son téléphone | Trouvé partout. Choisi tout de suite. | Found everywhere. Chosen right away. | Trouvé partout, choisi tout de suite. | Found everywhere, chosen right away. |
| 0:25–0:30 | FIN | Carte de fin (5 s) : logo officiel, takatak.ca/services/local-listings | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. | L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. | AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up. |

### 4.5 TAKATAK — Avis et réputation / Reviews and reputation

- **Statut (code) :** Accès anticipé (availability "early") ; « les demandes d'avis et les brouillons de réponse par IA s'en viennent » (translations/fr.ts › cat.reviews.promise)
- **Lien :** takatak.ca/services/reviews · **Appel à l'action :** Suivez vos avis sur takatak.ca / Track your reviews at takatak.ca
- **Musique :** Piano léger et cordes, ~90 BPM ; petit carillon quand les étoiles se remplissent.
- **Prix :** Aucun prix : service sur devis (core-categories.ts › reviews › from "quote").
- **Matériel réel à fournir :**
  - Capture : écran Avis du tableau de bord (public/media/product/shot-reviews.webp ou nouvel enregistrement) avec un avis d'exemple
  - Animation au montage : 5 étoiles qui se remplissent
  - Capture : boîte de réponse ; texte qui s'écrit (étiquette « Bientôt »)
  - Capture : statut « Répondu » (vert) et compteur « en attente »
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-reviews-a` — déjà dans `runway-shots.json` sous la clé `reviews`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/artisan-atelier.webp` · slow push-in  
    `Slow push-in on the craftsman's smiling face as he reads good news on his phone, warm workshop light, realistic skin and fabric detail, no text, no logos.`
  - **B** (`pack-reviews-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/commerce-cafe.webp` · slow pull-back  
    `The café owner looks up from his phone and smiles toward the room, warm light, slow pull-back, realistic, no text, no logos.`
- **Règles propres :**
  - L'avis à l'écran porte « Avis d'exemple · Sample review », sans nom ni commerce réel ; ou un vrai avis sur TAKATAK avec l'accord écrit de son auteur.
  - Le brouillon de réponse par IA porte « Bientôt · Coming soon » tant que la fonction n'est pas en ligne. Aujourd'hui, ce qui est vrai : « notre équipe répond dans votre ton ».

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : artisan qui lit une bonne nouvelle (5 s, boucle) | Site : aucun · Bumper : Plus d'avis. De meilleures réponses. | Site: none · Bumper: More reviews. Better replies. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : artisan qui lit une bonne nouvelle | Plus d'avis. De meilleures réponses. | More reviews. Better replies. | Plus d'avis, de meilleures réponses. | More reviews, better replies. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/services/reviews | Suivez vos avis sur takatak.ca | Track your reviews at takatak.ca | Suivez vos avis sur takatak.ca. | Track your reviews at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : artisan qui lit une bonne nouvelle | Plus d'avis. De meilleures réponses. | More reviews. Better replies. | Plus d'avis, de meilleures réponses. | More reviews, better replies. |
| 0:04–0:10 | P1 | Capture : un nouvel avis Google arrive ; les étoiles se remplissent | Nouvel avis Google ★★★★★ | New Google review ★★★★★ | Un nouvel avis arrive : vous le voyez tout de suite. | A new review comes in: you see it right away. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/services/reviews | Suivez vos avis sur takatak.ca | Track your reviews at takatak.ca | Suivez vos avis sur takatak.ca. | Track your reviews at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : artisan qui lit une bonne nouvelle | Plus d'avis. De meilleures réponses. | More reviews. Better replies. | Plus d'avis, de meilleures réponses. | More reviews, better replies. |
| 0:04–0:08 | P1 | Capture : un nouvel avis Google arrive ; les étoiles se remplissent | Nouvel avis Google ★★★★★ | New Google review ★★★★★ | Un nouvel avis arrive : vous le voyez tout de suite. | A new review comes in: you see it right away. |
| 0:08–0:12 | P2 | Capture : la réponse s'écrit dans la boîte (étiquette Bientôt) | L'IA rédige la réponse · Bientôt | AI drafts the reply · Coming soon | Bientôt, l'IA proposera la réponse ; vous l'approuvez en un clic. | Soon, AI will draft the reply; you approve it in one click. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/services/reviews | Suivez vos avis sur takatak.ca | Track your reviews at takatak.ca | Suivez vos avis sur takatak.ca. | Track your reviews at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : artisan qui lit une bonne nouvelle | Plus d'avis. De meilleures réponses. | More reviews. Better replies. | Plus d'avis, de meilleures réponses. | More reviews, better replies. |
| 0:04–0:11 | P1 | Capture : un nouvel avis Google arrive ; les étoiles se remplissent | Nouvel avis Google ★★★★★ | New Google review ★★★★★ | Un nouvel avis arrive : vous le voyez tout de suite. | A new review comes in: you see it right away. |
| 0:11–0:18 | P2 | Capture : la réponse s'écrit dans la boîte (étiquette Bientôt) | L'IA rédige la réponse · Bientôt | AI drafts the reply · Coming soon | Bientôt, l'IA proposera la réponse ; vous l'approuvez en un clic. | Soon, AI will draft the reply; you approve it in one click. |
| 0:18–0:23 | P3 | Capture : statut « Répondu » | Répondu, dans votre ton | Answered, in your voice | Aujourd'hui déjà, notre équipe répond dans votre ton. | Today, our team already replies in your voice. |
| 0:23–0:27 | B | Plan B : propriétaire de café qui lève les yeux et sourit | Faites de chaque avis votre meilleur vendeur. | Make every review your best salesperson. | Faites de chaque avis votre meilleur vendeur. | Make every review your best salesperson. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/services/reviews | Suivez vos avis sur takatak.ca | Track your reviews at takatak.ca | Suivez vos avis sur takatak.ca. | Track your reviews at takatak.ca. |

### 4.6 MIMT — Téléphonie d'affaires / Business phone

- **Statut (code) :** Prélancement (SUITE_GROUPS › mimt : "planned") ; takatak.ca : « pas encore lancé, liste d'attente » (cat.voip.promise)
- **Lien :** mimt.ca · **Appel à l'action :** MIMT arrive bientôt. Liste d'attente : mimt.ca / MIMT is coming soon. Waiting list: mimt.ca
- **Musique :** Électronique feutrée, ~95 BPM ; une sonnerie neutre (bruitage libre de droits, jamais une sonnerie de marque).
- **Prix :** Aucun prix tant que MIMT n'ouvre pas la vente. Ensuite seulement ceux de mimt-plans.ts (Essentiel 12,99 $/mois ; Affaires 34,99 $/ligne/mois ; Affaires Pro 44,99 $/ligne/mois ; avant taxes ; TPS, TVQ et taxe municipale 9-1-1 en sus).
- **Matériel réel à fournir :**
  - Capture : app.mimt.ca, écran d'appel entrant (compte de démo, numéro fictif)
  - Capture : réglages du standard automatique et des groupes d'appel (compte de démo)
  - Capture : courriel de boîte vocale avec transcription (message enregistré par l'équipe)
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-mimt-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow push-in  
    `A professional on a phone call at her laptop nods and smiles as she listens, calm modern office, soft light, slow push-in, realistic, screen not readable, no text, no logos.`
  - **B** (`pack-mimt-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/studio-design.webp` · slow lateral move  
    `A designer in her bright studio laughs on a phone call, then turns back to her work, fabric samples sway slightly, slow lateral move, realistic, no text, no logos.`
- **Règles propres :**
  - Publier les versions « offre » seulement quand MIMT ouvre au public (mimtcaapp, docs/MIMT-LAUNCH.md § 8). Avant : CTA liste d'attente.
  - Numéros fictifs 514-555-01XX seulement. Aucune image ni promesse sur le 9-1-1.
  - Fonctions montrées = celles du forfait Affaires dans mimt-plans.ts : standard automatique et groupes d'appel, transcription de la boîte vocale, boîte vocale par courriel.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle au téléphone à son bureau (5 s, boucle) | Site : aucun · Bumper : Un appel arrive. MIMT le dirige. | Site: none · Bumper: A call comes in. MIMT routes it. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle au téléphone à son bureau | Un appel arrive. MIMT le dirige. | A call comes in. MIMT routes it. | Un appel arrive : MIMT le dirige vers la bonne personne. | A call comes in: MIMT sends it to the right person. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, mimt.ca | MIMT arrive bientôt. Liste d'attente : mimt.ca | MIMT is coming soon. Waiting list: mimt.ca | MIMT arrive bientôt. Inscrivez-vous sur mimt.ca. | MIMT is coming soon. Sign up at mimt.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle au téléphone à son bureau | Un appel arrive. MIMT le dirige. | A call comes in. MIMT routes it. | Un appel arrive : MIMT le dirige vers la bonne personne. | A call comes in: MIMT sends it to the right person. |
| 0:04–0:10 | P1 | Capture : écran d'appel entrant sur app.mimt.ca | Appel entrant · Ligne d'affaires | Incoming call · Business line | Votre ligne d'affaires sonne là où vous êtes. | Your business line rings wherever you are. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, mimt.ca | MIMT arrive bientôt. Liste d'attente : mimt.ca | MIMT is coming soon. Waiting list: mimt.ca | MIMT arrive bientôt. Inscrivez-vous sur mimt.ca. | MIMT is coming soon. Sign up at mimt.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle au téléphone à son bureau | Un appel arrive. MIMT le dirige. | A call comes in. MIMT routes it. | Un appel arrive : MIMT le dirige vers la bonne personne. | A call comes in: MIMT sends it to the right person. |
| 0:04–0:08 | P1 | Capture : écran d'appel entrant sur app.mimt.ca | Appel entrant · Ligne d'affaires | Incoming call · Business line | Votre ligne d'affaires sonne là où vous êtes. | Your business line rings wherever you are. |
| 0:08–0:12 | P2 | Capture + animation : le standard envoie l'appel (1 Ventes · 2 Soutien · Équipe) | Ventes · Soutien · Équipe | Sales · Support · Team | Le standard automatique l'envoie aux ventes, au soutien ou à l'équipe. | The auto attendant sends it to sales, support or the team. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, mimt.ca | MIMT arrive bientôt. Liste d'attente : mimt.ca | MIMT is coming soon. Waiting list: mimt.ca | MIMT arrive bientôt. Inscrivez-vous sur mimt.ca. | MIMT is coming soon. Sign up at mimt.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle au téléphone à son bureau | Un appel arrive. MIMT le dirige. | A call comes in. MIMT routes it. | Un appel arrive : MIMT le dirige vers la bonne personne. | A call comes in: MIMT sends it to the right person. |
| 0:04–0:11 | P1 | Capture : écran d'appel entrant sur app.mimt.ca | Appel entrant · Ligne d'affaires | Incoming call · Business line | Votre ligne d'affaires sonne là où vous êtes. | Your business line rings wherever you are. |
| 0:11–0:18 | P2 | Capture + animation : le standard envoie l'appel (1 Ventes · 2 Soutien · Équipe) | Ventes · Soutien · Équipe | Sales · Support · Team | Le standard automatique l'envoie aux ventes, au soutien ou à l'équipe. | The auto attendant sends it to sales, support or the team. |
| 0:18–0:23 | P3 | Capture : courriel de boîte vocale transcrite | Message vocal transcrit, dans votre courriel | Voicemail transcribed, in your inbox | Appel manqué ? Le message arrive transcrit dans votre courriel. | Missed it? The message arrives transcribed in your inbox. |
| 0:23–0:27 | B | Plan B : designer qui rit au téléphone | Votre système téléphonique, sans matériel. | Your company phone system, no hardware. | Le système téléphonique de votre entreprise, sans matériel. | Your company phone system, no hardware. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, mimt.ca | MIMT arrive bientôt. Liste d'attente : mimt.ca | MIMT is coming soon. Waiting list: mimt.ca | MIMT arrive bientôt. Inscrivez-vous sur mimt.ca. | MIMT is coming soon. Sign up at mimt.ca. |

### 4.7 TAKATAK — TAK bot IA / TAK bot AI

- **Statut (code) :** Accès anticipé ; essai de 50 crédits quand il est ouvert en production (docs/TAKBOT_TRIAL.md : connexion Google, clé économique, TAKBOT_TRIAL_ENABLED)
- **Lien :** takatak.ca/takbot · **Appel à l'action :** Essayez TAK bot sur takatak.ca/takbot / Try TAK bot at takatak.ca/takbot
- **Musique :** Synthé ambiant moderne, ~100 BPM.
- **Prix :** Aucun prix : les packs de crédits sont DRAFT (src/lib/growth/ai-engine.ts). « 50 crédits d'essai » seulement quand l'essai est ouvert en production.
- **Matériel réel à fournir :**
  - public/media/product/takbot-fr.mp4 et takbot-en.mp4 (vraies captures) ou nouvel enregistrement sur un compte de démo
  - Capture : le coût en crédits affiché avant la demande
  - Capture : la réponse gardée dans AI Studio › Saved
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-takbot-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow push-in  
    `A professional finishes her phone call, sets the phone down and types on her laptop, then leans back with a satisfied look, soft screen glow, slow push-in, realistic, screen not readable, no text, no logos.`
  - **B** (`pack-takbot-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/studio-design.webp` · slow arc  
    `A designer in her bright studio reads her laptop screen, nods and smiles, slow arc, realistic, screen not readable, no text, no logos.`
- **Règles propres :**
  - Noms des moteurs (Claude, ChatGPT, Gemini, Mistral, Grok) en texte seulement, aucun logo de tiers.
  - « 13 moteurs d'IA » (home-funnel.ts › homeV2) seulement tant que le catalogue TAK bot le dit.
  - Coûts montrés = ceux de l'essai : Clavarder 1 crédit, Écrire 2, Rechercher 2 (TAKBOT_TRIAL.md).

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui tape une question (5 s, boucle) | Site : aucun · Bumper : Un bot maître. Tous les moteurs d'IA derrière lui. | Site: none · Bumper: One master bot. Every AI engine behind it. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui tape une question | Un bot maître. Tous les moteurs d'IA derrière lui. | One master bot. Every AI engine behind it. | Un bot maître, tous les moteurs d'IA derrière lui. | One master bot, every AI engine behind it. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/takbot | Essayez TAK bot sur takatak.ca/takbot | Try TAK bot at takatak.ca/takbot | Essayez TAK bot sur takatak.ca. | Try TAK bot at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui tape une question | Un bot maître. Tous les moteurs d'IA derrière lui. | One master bot. Every AI engine behind it. | Un bot maître, tous les moteurs d'IA derrière lui. | One master bot, every AI engine behind it. |
| 0:04–0:10 | P1 | Capture : on tape « Écris une publication pour mon café » dans TAK bot | Demandez une fois à TAK bot | Ask TAK bot once | Vous demandez une fois ; TAK bot choisit le bon moteur. | Ask once; TAK bot picks the right engine. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/takbot | Essayez TAK bot sur takatak.ca/takbot | Try TAK bot at takatak.ca/takbot | Essayez TAK bot sur takatak.ca. | Try TAK bot at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui tape une question | Un bot maître. Tous les moteurs d'IA derrière lui. | One master bot. Every AI engine behind it. | Un bot maître, tous les moteurs d'IA derrière lui. | One master bot, every AI engine behind it. |
| 0:04–0:08 | P1 | Capture : on tape « Écris une publication pour mon café » dans TAK bot | Demandez une fois à TAK bot | Ask TAK bot once | Vous demandez une fois ; TAK bot choisit le bon moteur. | Ask once; TAK bot picks the right engine. |
| 0:08–0:12 | P2 | Capture : « 2 crédits » affiché, puis la réponse | Le coût s'affiche avant chaque demande | The cost shows before every request | Le coût en crédits s'affiche avant ; si un moteur échoue, les crédits reviennent. | The credit cost shows first; if an engine fails, the credits come back. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/takbot | Essayez TAK bot sur takatak.ca/takbot | Try TAK bot at takatak.ca/takbot | Essayez TAK bot sur takatak.ca. | Try TAK bot at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui tape une question | Un bot maître. Tous les moteurs d'IA derrière lui. | One master bot. Every AI engine behind it. | Un bot maître, tous les moteurs d'IA derrière lui. | One master bot, every AI engine behind it. |
| 0:04–0:11 | P1 | Capture : on tape « Écris une publication pour mon café » dans TAK bot | Demandez une fois à TAK bot | Ask TAK bot once | Vous demandez une fois ; TAK bot choisit le bon moteur. | Ask once; TAK bot picks the right engine. |
| 0:11–0:18 | P2 | Capture : « 2 crédits » affiché, puis la réponse | Le coût s'affiche avant chaque demande | The cost shows before every request | Le coût en crédits s'affiche avant ; si un moteur échoue, les crédits reviennent. | The credit cost shows first; if an engine fails, the credits come back. |
| 0:18–0:23 | P3 | Capture : la réponse gardée dans le dossier | Gardé dans votre dossier | Saved to your file | Chaque réponse est gardée dans votre dossier. | Every answer is saved to your file. |
| 0:23–0:27 | B | Plan B : designer qui lit son écran et sourit | Payé en crédits, pas en abonnements. | Paid with credits, not subscriptions. | Vous payez seulement ce que vous utilisez. | You pay only for what you use. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/takbot | Essayez TAK bot sur takatak.ca/takbot | Try TAK bot at takatak.ca/takbot | Essayez TAK bot sur takatak.ca. | Try TAK bot at takatak.ca. |

### 4.8 TAKATAK — Facturation / Invoicing

- **Statut (code) :** En ligne (availability "live") ; votre propre compte Stripe, factures en dollars canadiens avec TPS et TVQ (cat.billing.promise)
- **Lien :** takatak.ca/services/billing · **Appel à l'action :** Facturez avec takatak.ca / Invoice with takatak.ca
- **Musique :** Lo-fi calme, ~85 BPM ; un « ding » discret au paiement.
- **Prix :** Aucun prix : sur devis (core-categories.ts › billing › from "quote").
- **Matériel réel à fournir :**
  - Capture : création d'une facture de démo (client fictif) avec TPS et TVQ calculées
  - Capture : paiement en mode test, statut « Payée »
  - Capture : liste des factures et rappel automatique
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-billing-a` — déjà dans `runway-shots.json` sous la clé `billing`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow drift  
    `Slow cinematic drift across the desk toward the laptop as the professional finishes her call and smiles, quiet satisfaction, realistic, no text, no logos.`
  - **B** (`pack-billing-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/artisan-atelier.webp` · slow push-in  
    `The craftsman reads a notification on his phone and smiles with relief, warm workshop light, slow push-in, realistic, screen not readable, no text, no logos.`
- **Règles propres :**
  - Client et facture fictifs ; paiement Stripe en mode test, carte de test, aucun numéro visible.
  - Ce n'est pas le produit « Facturations » (pas encore autorisé pour le public, RAW_MATERIAL_REQUEST.md) : c'est la facturation du tableau de bord takatak.ca.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui termine son appel en souriant (5 s, boucle) | Site : aucun · Bumper : Des factures professionnelles. Payées en ligne. | Site: none · Bumper: Professional invoices. Paid online. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui termine son appel en souriant | Des factures professionnelles. Payées en ligne. | Professional invoices. Paid online. | Des factures professionnelles, payées en ligne. | Professional invoices, paid online. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca/services/billing | Facturez avec takatak.ca | Invoice with takatak.ca | Facturez avec takatak.ca. | Invoice with takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui termine son appel en souriant | Des factures professionnelles. Payées en ligne. | Professional invoices. Paid online. | Des factures professionnelles, payées en ligne. | Professional invoices, paid online. |
| 0:04–0:10 | P1 | Capture : création de la facture, taxes calculées | TPS et TVQ calculées | GST and QST calculated | Vous facturez en dollars canadiens, TPS et TVQ comprises. | Invoice in Canadian dollars, GST and QST included. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca/services/billing | Facturez avec takatak.ca | Invoice with takatak.ca | Facturez avec takatak.ca. | Invoice with takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui termine son appel en souriant | Des factures professionnelles. Payées en ligne. | Professional invoices. Paid online. | Des factures professionnelles, payées en ligne. | Professional invoices, paid online. |
| 0:04–0:08 | P1 | Capture : création de la facture, taxes calculées | TPS et TVQ calculées | GST and QST calculated | Vous facturez en dollars canadiens, TPS et TVQ comprises. | Invoice in Canadian dollars, GST and QST included. |
| 0:08–0:12 | P2 | Capture : paiement par carte (test), statut vert | Facture #1042 · Payée | Invoice #1042 · Paid | Votre client paie par carte ; l'argent va dans votre compte. | Your client pays by card; the money goes to your account. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca/services/billing | Facturez avec takatak.ca | Invoice with takatak.ca | Facturez avec takatak.ca. | Invoice with takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui termine son appel en souriant | Des factures professionnelles. Payées en ligne. | Professional invoices. Paid online. | Des factures professionnelles, payées en ligne. | Professional invoices, paid online. |
| 0:04–0:11 | P1 | Capture : création de la facture, taxes calculées | TPS et TVQ calculées | GST and QST calculated | Vous facturez en dollars canadiens, TPS et TVQ comprises. | Invoice in Canadian dollars, GST and QST included. |
| 0:11–0:18 | P2 | Capture : paiement par carte (test), statut vert | Facture #1042 · Payée | Invoice #1042 · Paid | Votre client paie par carte ; l'argent va dans votre compte. | Your client pays by card; the money goes to your account. |
| 0:18–0:23 | P3 | Capture : liste des factures et rappel | Rappels automatiques · Statuts clairs | Automatic reminders · Clear statuses | Rappels et statuts : vous savez qui a payé. | Reminders and statuses: you know who paid. |
| 0:23–0:27 | B | Plan B : artisan soulagé qui lit une notification | Moins de suivi, plus de temps. | Less chasing, more time. | Moins de suivi, plus de temps. | Less chasing, more time. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca/services/billing | Facturez avec takatak.ca | Invoice with takatak.ca | Facturez avec takatak.ca. | Invoice with takatak.ca. |

### 4.9 QMAPS — Répertoire local du Québec / Québec's local directory

- **Statut (code) :** En ligne (qmaps.ca, "live") ; ajout d'un commerce sans frais (SUITE_GROUPS › qmaps)
- **Lien :** qmaps.ca · **Appel à l'action :** Ajoutez votre commerce sur qmaps.ca / Add your business at qmaps.ca
- **Musique :** Folk-pop instrumentale légère, ~100 BPM.
- **Prix :** « Sans frais » pour ajouter un commerce (home-funnel.ts). Aucun prix de placement commandité (aucun dans le code).
- **Matériel réel à fournir :**
  - Capture : une recherche sur qmaps.ca qui se termine sur une fiche
  - Capture : la fiche (heures, avis, itinéraire)
  - Capture : le parcours « Ajouter mon commerce »
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-qmaps-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/hero-cafe.webp` · slight handheld drift  
    `A woman in a café looks at a map on her phone, then up toward the street, soft daylight, slight handheld drift, realistic, screen not readable, no text, no logos.`
  - **B** (`pack-qmaps-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/commerce-cafe.webp` · slow push-in  
    `The café owner behind his counter looks toward the door and smiles in welcome, warm morning light, slow push-in, realistic, no text, no logos.`
- **Règles propres :**
  - Fiches filmées : fiches de démo ou commerces qui ont donné leur accord écrit. Source et licence connues pour chaque photo visible (RAW_MATERIAL_REQUEST.md).
  - Une fiche commanditée à l'écran porte l'étiquette « Commandité · Sponsored ».

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : cliente qui regarde une carte sur son téléphone (5 s, boucle) | Site : aucun · Bumper : Le répertoire local du Québec. | Site: none · Bumper: Québec's local directory. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : cliente qui regarde une carte sur son téléphone | Le répertoire local du Québec. | Québec's local directory. | QMAPS, le répertoire local du Québec. | QMAPS, Québec's local directory. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, qmaps.ca | Ajoutez votre commerce sur qmaps.ca | Add your business at qmaps.ca | Rendez-vous sur qmaps.ca. | Go to qmaps.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui regarde une carte sur son téléphone | Le répertoire local du Québec. | Québec's local directory. | QMAPS, le répertoire local du Québec. | QMAPS, Québec's local directory. |
| 0:04–0:10 | P1 | Capture : recherche sur qmaps.ca | Cherchez près de chez vous | Search near you | Vos clients cherchent près de chez eux… | Your customers search close to home… |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, qmaps.ca | Ajoutez votre commerce sur qmaps.ca | Add your business at qmaps.ca | Rendez-vous sur qmaps.ca. | Go to qmaps.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui regarde une carte sur son téléphone | Le répertoire local du Québec. | Québec's local directory. | QMAPS, le répertoire local du Québec. | QMAPS, Québec's local directory. |
| 0:04–0:08 | P1 | Capture : recherche sur qmaps.ca | Cherchez près de chez vous | Search near you | Vos clients cherchent près de chez eux… | Your customers search close to home… |
| 0:08–0:12 | P2 | Capture : la fiche du commerce | Heures · Avis · Itinéraire | Hours · Reviews · Directions | …et trouvent vos heures, vos avis et le chemin jusqu'à vous. | …and find your hours, your reviews and the way to you. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, qmaps.ca | Ajoutez votre commerce sur qmaps.ca | Add your business at qmaps.ca | Rendez-vous sur qmaps.ca. | Go to qmaps.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : cliente qui regarde une carte sur son téléphone | Le répertoire local du Québec. | Québec's local directory. | QMAPS, le répertoire local du Québec. | QMAPS, Québec's local directory. |
| 0:04–0:11 | P1 | Capture : recherche sur qmaps.ca | Cherchez près de chez vous | Search near you | Vos clients cherchent près de chez eux… | Your customers search close to home… |
| 0:11–0:18 | P2 | Capture : la fiche du commerce | Heures · Avis · Itinéraire | Hours · Reviews · Directions | …et trouvent vos heures, vos avis et le chemin jusqu'à vous. | …and find your hours, your reviews and the way to you. |
| 0:18–0:23 | P3 | Capture : « Ajouter mon commerce » | Ajoutez votre commerce sans frais | Add your business at no cost | Ajouter votre commerce ne coûte rien. | Adding your business costs nothing. |
| 0:23–0:27 | B | Plan B : propriétaire qui accueille, sourire | Soyez trouvé. Recevez des avis. | Get found. Get reviews. | Soyez trouvé, recevez des avis. | Get found, get reviews. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, qmaps.ca | Ajoutez votre commerce sur qmaps.ca | Add your business at qmaps.ca | Rendez-vous sur qmaps.ca. | Go to qmaps.ca. |

### 4.10 FLEXS — Marché des demandes de service / Service-request marketplace

- **Statut (code) :** En ligne (flexs.ca, "live") : les clients décrivent leur projet, les pros reçoivent les demandes
- **Lien :** flexs.ca · **Appel à l'action :** Publiez votre demande sur flexs.ca / Post your request at flexs.ca
- **Musique :** Rythme percussif « atelier », ~105 BPM.
- **Prix :** Aucun prix (aucun dans le code pour FLEXS).
- **Matériel réel à fournir :**
  - Capture : formulaire de demande sur flexs.ca rempli avec un projet fictif
  - Capture : confirmation « Demande envoyée »
  - Capture : la demande qui arrive côté pro (compte pro de démo)
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-flexs-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/hero-cafe.webp` · slow dolly  
    `Close, slow dolly toward a woman's hands typing a message on her phone at a café table, warm light, calm pace, screen not readable, realistic, no text, no logos.`
  - **B** (`pack-flexs-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/artisan-atelier.webp` · slow push-in  
    `The craftsman picks up his phone from the workbench and reads with interest, dust in a beam of light, slow push-in, realistic, screen not readable, no text, no logos.`
- **Règles propres :**
  - Projet fictif ; aucun nombre de pros ni délai de réponse promis.
  - Version « pros » : même montage, CTA « Pros : recevez des demandes sur flexs.ca ».

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : mains qui écrivent sur un téléphone (5 s, boucle) | Site : aucun · Bumper : Un projet ? Décrivez-le. | Site: none · Bumper: A project? Describe it. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : mains qui écrivent sur un téléphone | Un projet ? Décrivez-le. | A project? Describe it. | Vous avez un projet ? Décrivez-le. | Got a project? Describe it. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, flexs.ca | Publiez votre demande sur flexs.ca | Post your request at flexs.ca | Publiez votre demande sur flexs.ca. | Post your request at flexs.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui écrivent sur un téléphone | Un projet ? Décrivez-le. | A project? Describe it. | Vous avez un projet ? Décrivez-le. | Got a project? Describe it. |
| 0:04–0:10 | P1 | Capture : formulaire FLEXS (quoi, où, quand) | Quoi · Où · Quand | What · Where · When | Dites quoi, où et quand. | Say what, where and when. |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, flexs.ca | Publiez votre demande sur flexs.ca | Post your request at flexs.ca | Publiez votre demande sur flexs.ca. | Post your request at flexs.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui écrivent sur un téléphone | Un projet ? Décrivez-le. | A project? Describe it. | Vous avez un projet ? Décrivez-le. | Got a project? Describe it. |
| 0:04–0:08 | P1 | Capture : formulaire FLEXS (quoi, où, quand) | Quoi · Où · Quand | What · Where · When | Dites quoi, où et quand. | Say what, where and when. |
| 0:08–0:12 | P2 | Capture : « Demande envoyée » (vert) | Demande envoyée | Request sent | Votre demande part. | Your request goes out. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, flexs.ca | Publiez votre demande sur flexs.ca | Post your request at flexs.ca | Publiez votre demande sur flexs.ca. | Post your request at flexs.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : mains qui écrivent sur un téléphone | Un projet ? Décrivez-le. | A project? Describe it. | Vous avez un projet ? Décrivez-le. | Got a project? Describe it. |
| 0:04–0:11 | P1 | Capture : formulaire FLEXS (quoi, où, quand) | Quoi · Où · Quand | What · Where · When | Dites quoi, où et quand. | Say what, where and when. |
| 0:11–0:18 | P2 | Capture : « Demande envoyée » (vert) | Demande envoyée | Request sent | Votre demande part. | Your request goes out. |
| 0:18–0:23 | P3 | Capture : la demande arrive côté pro | Les pros reçoivent la demande | Pros receive the request | Les pros la reçoivent et vous répondent. | Pros receive it and get back to you. |
| 0:23–0:27 | B | Plan B : artisan qui lit la demande sur son téléphone | Le marché des demandes de service. | The service-request marketplace. | FLEXS, le marché des demandes de service. | FLEXS, the service-request marketplace. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, flexs.ca | Publiez votre demande sur flexs.ca | Post your request at flexs.ca | Publiez votre demande sur flexs.ca. | Post your request at flexs.ca. |

### 4.11 SEO TAKATAK — Plans d'action SEO / SEO action plans

- **Statut (code) :** Accès anticipé (SUITE_GROUPS › seo : "early") : données Search Console et plans d'action SEO
- **Lien :** takatak.ca · **Appel à l'action :** Accès anticipé sur takatak.ca / Early access at takatak.ca
- **Musique :** Électronique minimaliste, ~95 BPM.
- **Prix :** Aucun prix (aucun dans le code pour SEO TAKATAK).
- **Matériel réel à fournir :**
  - Capture : SEO TAKATAK branché à la Search Console d'un site de démo (public/media/product/shot-seo.webp ou nouvel enregistrement)
  - Capture : le plan d'action, puis une tâche cochée
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-seo-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/studio-design.webp` · slow lateral move  
    `The designer turns to her laptop and studies the screen with focus, bright studio, slow lateral move, realistic, screen not readable, no text, no logos.`
  - **B** (`pack-seo-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow drift  
    `The professional nods at her laptop and writes a short note, calm modern office, slow drift, realistic, screen not readable, no text, no logos.`
- **Règles propres :**
  - Site de démo de TAKATAK seulement. Aucune promesse de classement, aucune courbe de trafic inventée.
  - « Search Console » est une marque de Google : en texte, sans logo.

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : designer concentrée devant son portable (5 s, boucle) | Site : aucun · Bumper : Ce que Google voit de votre site. | Site: none · Bumper: What Google sees of your site. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : designer concentrée devant son portable | Ce que Google voit de votre site. | What Google sees of your site. | Que voit Google de votre site ? | What does Google see of your site? |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca | Accès anticipé sur takatak.ca | Early access at takatak.ca | Demandez l'accès anticipé sur takatak.ca. | Ask for early access at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : designer concentrée devant son portable | Ce que Google voit de votre site. | What Google sees of your site. | Que voit Google de votre site ? | What does Google see of your site? |
| 0:04–0:10 | P1 | Capture : données Search Console du site de démo | Données Search Console | Search Console data | SEO TAKATAK lit vos données Search Console… | SEO TAKATAK reads your Search Console data… |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca | Accès anticipé sur takatak.ca | Early access at takatak.ca | Demandez l'accès anticipé sur takatak.ca. | Ask for early access at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : designer concentrée devant son portable | Ce que Google voit de votre site. | What Google sees of your site. | Que voit Google de votre site ? | What does Google see of your site? |
| 0:04–0:08 | P1 | Capture : données Search Console du site de démo | Données Search Console | Search Console data | SEO TAKATAK lit vos données Search Console… | SEO TAKATAK reads your Search Console data… |
| 0:08–0:12 | P2 | Capture : le plan d'action | Votre plan d'action SEO | Your SEO action plan | …et en tire un plan d'action clair. | …and turns it into a clear action plan. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca | Accès anticipé sur takatak.ca | Early access at takatak.ca | Demandez l'accès anticipé sur takatak.ca. | Ask for early access at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : designer concentrée devant son portable | Ce que Google voit de votre site. | What Google sees of your site. | Que voit Google de votre site ? | What does Google see of your site? |
| 0:04–0:11 | P1 | Capture : données Search Console du site de démo | Données Search Console | Search Console data | SEO TAKATAK lit vos données Search Console… | SEO TAKATAK reads your Search Console data… |
| 0:11–0:18 | P2 | Capture : le plan d'action | Votre plan d'action SEO | Your SEO action plan | …et en tire un plan d'action clair. | …and turns it into a clear action plan. |
| 0:18–0:23 | P3 | Capture : une tâche cochée | Une tâche à la fois | One task at a time | Vous avancez une tâche à la fois. | You move forward one task at a time. |
| 0:23–0:27 | B | Plan B : professionnelle qui prend une note | Des actions claires, pas du jargon. | Clear actions, not jargon. | Des actions claires, pas du jargon. | Clear actions, not jargon. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca | Accès anticipé sur takatak.ca | Early access at takatak.ca | Demandez l'accès anticipé sur takatak.ca. | Ask for early access at takatak.ca. |

### 4.12 TAKATAK Academy — Formations / Courses

- **Statut (code) :** Bientôt (SUITE_GROUPS › academy : "soon", pas encore d'adresse publique) : formations gratuites pour commencer, parcours avancés ensuite
- **Lien :** takatak.ca · **Appel à l'action :** TAKATAK Academy arrive bientôt · takatak.ca / TAKATAK Academy is coming soon · takatak.ca
- **Musique :** Piano et pulsation douce, ~90 BPM (thème « apprentissage »).
- **Prix :** Aucun prix (le catalogue ACADEMYTAKATAK/src/lib/catalog.ts dit gratuit, freemium ou achat, sans montant).
- **Matériel réel à fournir :**
  - Capture : la liste des cours et une page de leçon (public/media/product/shot-academy.webp ou nouvel enregistrement)
  - Capture : l'activité de la leçon, puis l'attestation de réussite (compte de démo)
- **Plans Runway (communs aux 5 durées ; générer en 16:9 et en 9:16) :**
  - **A** (`pack-academy-a`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/pro-bureau.webp` · slow push-in  
    `A professional watches a lesson on her laptop and writes a note, calm modern office, soft light, slow push-in, realistic, screen not readable, no text, no logos.`
  - **B** (`pack-academy-b`) · image vers vidéo · `gen4_turbo` · 5 s · `public/photos/artisan-atelier.webp` · slow arc  
    `The craftsman looks at his phone, then back at his work with confidence, warm workshop light, slow arc, realistic, no text, no logos.`
- **Règles propres :**
  - Ne pas afficher l'adresse de l'Academy avant qu'elle soit publique.
  - Cours nommés = ceux du catalogue (SEO + AEO, Sites web domaines et hébergement, SEO local et QMAPS, Réseaux sociaux et marketing TAKATAK, Outils IA et automatisation, Shopify, Téléphonie d'affaires).

**5 s** · 16:9 (site) + 9:16 (bumper) · Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui suit une leçon (5 s, boucle) | Site : aucun · Bumper : Apprenez chaque outil TAKATAK. | Site: none · Bumper: Learn every TAKATAK tool. | — | — |

**8 s** · 9:16 + 16:9 · Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:05 | A | Plan A : professionnelle qui suit une leçon | Apprenez chaque outil TAKATAK. | Learn every TAKATAK tool. | TAKATAK Academy : apprenez chaque outil, à votre rythme. | TAKATAK Academy: learn every tool, at your pace. |
| 0:05–0:08 | FIN | Carte de fin : logo officiel, takatak.ca | TAKATAK Academy arrive bientôt · takatak.ca | TAKATAK Academy is coming soon · takatak.ca | Bientôt sur takatak.ca. | Coming soon at takatak.ca. |

**13 s** · 9:16 · Reels · Shorts · TikTok · publicité Meta

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui suit une leçon | Apprenez chaque outil TAKATAK. | Learn every TAKATAK tool. | TAKATAK Academy : apprenez chaque outil, à votre rythme. | TAKATAK Academy: learn every tool, at your pace. |
| 0:04–0:10 | P1 | Capture : la liste des cours | Sites web · SEO · Fiches locales · Réseaux sociaux · IA | Websites · SEO · Local listings · Social · AI | Sites web, SEO, fiches locales, réseaux sociaux, IA… | Websites, SEO, local listings, social media, AI… |
| 0:10–0:13 | FIN | Carte de fin : logo officiel, takatak.ca | TAKATAK Academy arrive bientôt · takatak.ca | TAKATAK Academy is coming soon · takatak.ca | Bientôt sur takatak.ca. | Coming soon at takatak.ca. |

**15 s** · 9:16 (+ 16:9 pour la pub YouTube/Meta) · Reels · Shorts · TikTok · publicités Meta et YouTube

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui suit une leçon | Apprenez chaque outil TAKATAK. | Learn every TAKATAK tool. | TAKATAK Academy : apprenez chaque outil, à votre rythme. | TAKATAK Academy: learn every tool, at your pace. |
| 0:04–0:08 | P1 | Capture : la liste des cours | Sites web · SEO · Fiches locales · Réseaux sociaux · IA | Websites · SEO · Local listings · Social · AI | Sites web, SEO, fiches locales, réseaux sociaux, IA… | Websites, SEO, local listings, social media, AI… |
| 0:08–0:12 | P2 | Capture : une leçon puis son activité | Une leçon, une activité | One lesson, one activity | Une leçon courte, puis une activité pour votre commerce. | A short lesson, then an activity for your business. |
| 0:12–0:15 | FIN | Carte de fin : logo officiel, takatak.ca | TAKATAK Academy arrive bientôt · takatak.ca | TAKATAK Academy is coming soon · takatak.ca | Bientôt sur takatak.ca. | Coming soon at takatak.ca. |

**30 s** · 9:16 + 16:9 · Page de service du site · YouTube Shorts · Reels · publicités YouTube et Meta (TikTok Creator Rewards exige 1 min et plus)

| Temps | Bloc | Image | Texte FR | Text EN | Voix FR | Voice EN |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:04 | A | Plan A : professionnelle qui suit une leçon | Apprenez chaque outil TAKATAK. | Learn every TAKATAK tool. | TAKATAK Academy : apprenez chaque outil, à votre rythme. | TAKATAK Academy: learn every tool, at your pace. |
| 0:04–0:11 | P1 | Capture : la liste des cours | Sites web · SEO · Fiches locales · Réseaux sociaux · IA | Websites · SEO · Local listings · Social · AI | Sites web, SEO, fiches locales, réseaux sociaux, IA… | Websites, SEO, local listings, social media, AI… |
| 0:11–0:18 | P2 | Capture : une leçon puis son activité | Une leçon, une activité | One lesson, one activity | Une leçon courte, puis une activité pour votre commerce. | A short lesson, then an activity for your business. |
| 0:18–0:23 | P3 | Capture : l'attestation de réussite | Attestation de réussite | Certificate of completion | Et une attestation à la fin. | And a certificate at the end. |
| 0:23–0:27 | B | Plan B : artisan confiant qui revient à son travail | Des formations gratuites pour commencer. | Free courses to start. | Les premières formations sont gratuites. | The first courses are free. |
| 0:27–0:30 | FIN | Carte de fin : logo officiel, takatak.ca | TAKATAK Academy arrive bientôt · takatak.ca | TAKATAK Academy is coming soon · takatak.ca | Bientôt sur takatak.ca. | Coming soon at takatak.ca. |


## 5. Vidéos YouTube de 3 minutes

Une vidéo de 3 minutes par marque principale, plus un gabarit de leçon Academy. Même système : plan Runway A
pour l'accroche, chapitres en capture réelle, plan B, écran de fin.

- **Durée finale : viser 3:05 à 3:20.** Sur Facebook, les vidéos hôtes des pubs in-stream doivent durer 3 min
  ou plus ; une coupe à 2:58 fait tout perdre. Sur YouTube, une vidéo de 3 min n'a pas de pub en milieu de
  vidéo (8 min et plus seulement) : pour les revenus, faire aussi des **compilations de 8 à 12 min** (3 ou 4
  leçons d'un même sujet, avec de vraies transitions et une introduction nouvelle, pas un simple collage).
- **Chapitres** dans la description (première ligne à 0:00). **Écran de fin** sur les dernières secondes
  (vidéo suivante, abonnement). Les règles exactes des chapitres et des écrans de fin (durées minimales) sont
  **à revérifier** dans YouTube Studio.
- **À la mise en ligne :** titre de 70 caractères visibles au plus, phrase clé dans les 2 premières lignes de
  la description, langue définie, « Conçue pour les enfants » : non, « Utilisation de l'IA » : oui (plans
  Runway), case « promotion payée » cochée seulement si quelqu'un nous paie pour la vidéo (§ 7).
- **Voix :** humaine de préférence (Matt ou l'équipe) ; si ElevenLabs, le dire dans la description.

### Mettre votre commerce en ligne, étape par étape | TAKATAK

*Get your business online, step by step | TAKATAK* · TAKATAK · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (website) | Accroche : « Votre commerce mérite un site à sa hauteur. » | Hook: "Your business deserves a website that matches it." |
| 0:10–0:25 | Montage | Ce que vous allez voir : domaine, site, hébergement, fiche Google | What you'll see: domain, website, hosting, Google listing |
| 0:25–0:55 | Capture réelle | 1. Trouver son nom de domaine sur takatak.ca/domain | 1. Find your domain at takatak.ca/domain |
| 0:55–1:35 | Capture réelle | 2. Le site : demande, design, mise en ligne (« www » → la page → « Succès, vous êtes en ligne ») | 2. The website: request, design, launch ("www" → the page → "Success, you're online") |
| 1:35–2:05 | Capture réelle | 3. Hébergement : SSL, sauvegardes, courriel d'affaires | 3. Hosting: SSL, backups, business email |
| 2:05–2:35 | Capture réelle | 4. Être trouvé : fiche Google et fiches locales | 4. Get found: Google listing and local listings |
| 2:35–2:50 | Runway B (website) + texte | Récapitulatif ; prix de départ de pricing.ts, avant taxes (optionnel) | Recap; starting prices from pricing.ts, before taxes (optional) |
| 2:50–3:00 | Écran de fin | Vidéo suivante + abonnement + takatak.ca | Next video + subscribe + takatak.ca |

- **Appel à l'action :** Créez votre compte sur takatak.ca / Create your account at takatak.ca
- **Plans Runway :** A et B de la section « Sites web » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Toutes les captures des sections Sites web, Domaines et hébergement, Fiches locales ; Voix humaine (Matt ou l'équipe) de préférence ; Chapitres dans la description.

### Modifier votre fiche d'entreprise : menu, photos, téléphone, heures et heures des Fêtes

*Update your business listing: menu, photos, phone, hours and holiday hours* · TAKATAK · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (local) | Accroche : « Quand on cherche près d'ici, c'est vous qu'on doit trouver. » | Hook: "When people search nearby, they should find you." |
| 0:10–0:30 | Montage | Pourquoi une fiche à jour partout compte (heures, numéro, cohérence) | Why an up-to-date listing everywhere matters (hours, number, consistency) |
| 0:30–0:55 | Capture réelle | Les heures d'ouverture | Opening hours |
| 0:55–1:20 | Capture réelle | Les heures spéciales (Fêtes, jours fériés) | Special hours (holidays) |
| 1:20–1:40 | Capture réelle | Le numéro de téléphone (fictif 514-555-01XX à l'écran) | The phone number (fictional 514-555-01XX on screen) |
| 1:40–2:05 | Capture réelle | Le menu | The menu |
| 2:05–2:30 | Capture réelle | Les photos : vraies, récentes, liées au commerce | Photos: real, recent, about the business |
| 2:30–2:45 | Capture réelle | Ce que l'IA met à jour, ce que notre équipe vérifie | What AI updates, what our team checks |
| 2:45–3:00 | Runway B (local) + écran de fin | « L'IA peut automatiser votre fiche en tout temps avec Groupe TAKATAK. Inscrivez-vous. » | "AI can keep your listing up to date, any time, with GROUPE TAKATAK. Sign up." |

- **Appel à l'action :** Inscrivez-vous sur takatak.ca / Sign up at takatak.ca
- **Plans Runway :** A et B de la section « Fiches locales · SEO local » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Capture complète de la modification d'une fiche de démo (heures, heures spéciales, téléphone, menu, photo) ; Fiche filmée : celle de TAKATAK ou une fiche de démo ; Aussi publiable comme leçon Academy (cours SEO local et QMAPS).

### Publier sur tous vos réseaux en une seule fois | TAKATAK

*Post to all your social networks at once | TAKATAK* · TAKATAK · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (social) | Accroche : « Une publication, tous vos réseaux. » | Hook: "One post, every network." |
| 0:10–0:35 | Capture réelle | Brancher ses réseaux (les 9 réseaux branchables) | Connect your networks (the 9 available) |
| 0:35–1:10 | Capture réelle | Écrire une publication et voir l'aperçu par réseau | Write a post and preview it per network |
| 1:10–1:35 | Tournage réel + capture | Toucher « Publier » → « Publié sur tous vos réseaux » | Tap "Publish" → "Posted to all your networks" |
| 1:35–2:05 | Capture réelle | Le calendrier de contenu et les approbations | Content calendar and approvals |
| 2:05–2:35 | Capture réelle | Les statistiques et la veille concurrentielle | Analytics and competitor tracking |
| 2:35–2:50 | Runway B (social) | « Ou confiez le tout à notre équipe. » | "Or hand it all to our team." |
| 2:50–3:00 | Écran de fin | takatak.ca + vidéo suivante | takatak.ca + next video |

- **Appel à l'action :** Branchez vos réseaux sur takatak.ca / Connect your networks at takatak.ca
- **Plans Runway :** A et B de la section « Réseaux sociaux » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Marque de démo branchée sur des comptes de test ; Aucun compte client réel à l'écran.

### TAK bot : un seul bot, plusieurs moteurs d'IA, payé en crédits | TAKATAK

*TAK bot: one bot, many AI engines, paid with credits | TAKATAK* · TAKATAK · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (takbot) | Accroche : « Un bot maître, tous les moteurs d'IA derrière lui. » | Hook: "One master bot, every AI engine behind it." |
| 0:10–0:35 | Capture réelle | Se connecter (Google ou courriel) ; l'essai, s'il est ouvert | Sign in (Google or email); the trial, if open |
| 0:35–1:15 | Capture réelle | Les modes Clavarder, Écrire, Rechercher et leur coût en crédits | Chat, Write and Research modes and their credit cost |
| 1:15–1:50 | Capture réelle | Laisser TAK bot choisir le moteur, ou le choisir soi-même | Let TAK bot pick the engine, or pick it yourself |
| 1:50–2:15 | Capture réelle | Les réponses gardées dans votre dossier ; crédits remboursés si un moteur échoue | Answers saved to your file; credits refunded if an engine fails |
| 2:15–2:40 | Montage | Bonnes pratiques : vérifier les faits, ne pas coller de données sensibles (leçon Academy « Where AI helps and fails ») | Good practice: check facts, never paste sensitive data (Academy lesson "Where AI helps and fails") |
| 2:40–2:50 | Runway B (takbot) | « Vous payez seulement ce que vous utilisez. » | "You pay only for what you use." |
| 2:50–3:00 | Écran de fin | takatak.ca/takbot | takatak.ca/takbot |

- **Appel à l'action :** Essayez TAK bot sur takatak.ca/takbot / Try TAK bot at takatak.ca/takbot
- **Plans Runway :** A et B de la section « TAK bot IA » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** takbot-fr.mp4 / takbot-en.mp4 ou nouvel enregistrement ; Aucun prix de pack (DRAFT).

### Ajouter votre commerce sur QMAPS, sans frais | QMAPS

*Add your business to QMAPS at no cost | QMAPS* · QMAPS · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (qmaps) | Accroche : « QMAPS, le répertoire local du Québec. » | Hook: "QMAPS, Québec's local directory." |
| 0:10–0:40 | Capture réelle | Comment les clients cherchent sur qmaps.ca | How customers search on qmaps.ca |
| 0:40–1:50 | Capture réelle | Ajouter son commerce, étape par étape (sans frais) | Add your business, step by step (no cost) |
| 1:50–2:20 | Capture réelle | Les avis : les recevoir et y répondre | Reviews: getting them and replying |
| 2:20–2:40 | Capture réelle | Les placements commandités : à quoi ils ressemblent (étiquette « Commandité ») | Sponsored placements: what they look like ("Sponsored" label) |
| 2:40–2:50 | Runway B (qmaps) | « Soyez trouvé, recevez des avis. » | "Get found, get reviews." |
| 2:50–3:00 | Écran de fin | qmaps.ca | qmaps.ca |

- **Appel à l'action :** Ajoutez votre commerce sur qmaps.ca / Add your business at qmaps.ca
- **Plans Runway :** A et B de la section « Répertoire local du Québec » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Compte marchand de démo QMAPS ; Fiches filmées avec accord ou de démo.

### Recevoir des demandes de service avec FLEXS (pour les pros) | FLEXS

*Get service requests with FLEXS (for pros) | FLEXS* · FLEXS · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (flexs) | Accroche : « Un projet ? Décrivez-le. » | Hook: "A project? Describe it." |
| 0:10–0:45 | Capture réelle | Côté client : décrire un projet (quoi, où, quand) | Customer side: describe a project (what, where, when) |
| 0:45–1:30 | Capture réelle | Côté pro : créer son profil | Pro side: create your profile |
| 1:30–2:15 | Capture réelle | Recevoir une demande et y répondre | Receive a request and reply |
| 2:15–2:40 | Montage | Conseils : réponse rapide, soumission claire et honnête | Tips: fast reply, clear and honest quote |
| 2:40–2:50 | Runway B (flexs) | « FLEXS, le marché des demandes de service. » | "FLEXS, the service-request marketplace." |
| 2:50–3:00 | Écran de fin | flexs.ca | flexs.ca |

- **Appel à l'action :** Pros : recevez des demandes sur flexs.ca / Pros: get requests at flexs.ca
- **Plans Runway :** A et B de la section « Marché des demandes de service » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Compte client et compte pro de démo sur flexs.ca ; Projet fictif.

### Un système téléphonique d'affaires, sans matériel | MIMT

*A business phone system, no hardware | MIMT* · MIMT · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (mimt) | Accroche : « Un appel arrive : MIMT le dirige vers la bonne personne. » | Hook: "A call comes in: MIMT sends it to the right person." |
| 0:10–0:35 | Capture réelle | Un numéro local réel pour votre entreprise | A real local number for your business |
| 0:35–1:15 | Capture réelle | Le standard automatique et les groupes d'appel | Auto attendant and ring groups |
| 1:15–1:45 | Capture réelle | Boîte vocale par courriel et transcription | Voicemail to email and transcription |
| 1:45–2:15 | Capture réelle | Assistance IA : réponses aux textos, réceptionniste | AI assist: text replies, receptionist |
| 2:15–2:35 | Capture réelle | Réunions vidéo MIMT (seulement si le service est en marche à la publication) | MIMT video meetings (only if live when published) |
| 2:35–2:50 | Runway B (mimt) + texte | Forfaits : seulement ceux de mimt-plans.ts, et seulement après l'ouverture | Plans: only from mimt-plans.ts, and only after launch |
| 2:50–3:00 | Écran de fin | mimt.ca | mimt.ca |

- **Appel à l'action :** mimt.ca (liste d'attente avant l'ouverture) / mimt.ca (waiting list before launch)
- **Plans Runway :** A et B de la section « Téléphonie d'affaires » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Publier seulement à l'ouverture de MIMT ; Compte de démo, numéros fictifs, aucune mention du 9-1-1.

### Comprendre ce que Google voit de votre site | SEO TAKATAK

*Understand what Google sees of your site | SEO TAKATAK* · SEO TAKATAK · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Runway A (seo) | Accroche : « Que voit Google de votre site ? » | Hook: "What does Google see of your site?" |
| 0:10–0:40 | Capture réelle | Brancher la Search Console (site de démo) | Connect Search Console (demo site) |
| 0:40–1:20 | Capture réelle | Lire les données : requêtes, pages, clics, impressions | Read the data: queries, pages, clicks, impressions |
| 1:20–2:10 | Capture réelle | Le plan d'action : quoi corriger d'abord | The action plan: what to fix first |
| 2:10–2:40 | Montage | SEO et AEO : être cité par les moteurs de réponse, honnêtement (cours SEO + AEO) | SEO and AEO: earning citations in answer engines, honestly (SEO + AEO course) |
| 2:40–2:50 | Runway B (seo) | « Des actions claires, pas du jargon. » | "Clear actions, not jargon." |
| 2:50–3:00 | Écran de fin | takatak.ca | takatak.ca |

- **Appel à l'action :** Accès anticipé sur takatak.ca / Early access at takatak.ca
- **Plans Runway :** A et B de la section « Plans d'action SEO » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Site de démo de TAKATAK avec Search Console ; Aucune promesse de classement.

### <Titre de la leçon> | TAKATAK Academy (gabarit, une vidéo par leçon)

*<Lesson title> | TAKATAK Academy (template, one video per lesson)* · TAKATAK Academy · 16:9, 1920×1080 · voix FR (version EN séparée) · sous-titres SRT FR et EN

| Temps | Image | Contenu FR | Content EN |
| --- | --- | --- | --- |
| 0:00–0:10 | Clip de la section du cours (Runway A) | Accroche : le problème que la leçon règle | Hook: the problem the lesson solves |
| 0:10–0:20 | Montage | L'objectif de la leçon, en une phrase | The lesson goal, in one sentence |
| 0:20–2:30 | Capture réelle | La démonstration (texte de la leçon dans ACADEMYTAKATAK/src/lib/catalog.ts) | The demo (lesson text in ACADEMYTAKATAK/src/lib/catalog.ts) |
| 2:30–2:45 | Montage | L'activité à faire pour son commerce | The activity to do for your business |
| 2:45–2:50 | Montage | Récapitulatif | Recap |
| 2:50–3:00 | Écran de fin | Leçon suivante + takatak.ca | Next lesson + takatak.ca |

- **Appel à l'action :** TAKATAK Academy / takatak.ca
- **Plans Runway :** A et B de la section « Formations » (§ 4) ; musique de la même section, sous la voix.
- **À fournir :** Une vidéo par leçon gratuite du catalogue ; Version longue 8–12 min (3 ou 4 leçons d'un même cours) pour les pubs en milieu de vidéo.


## 6. Suite Clover et Food Hub : complément au pack existant

Le pack `foodhubca/docs/2026-10-28 18-23 — Pack vidéos Marketplace Clover — scripts storyboards prompts Runway.md`
reste la référence (12 films, scripts, storyboards, voix FR/EN, chaîne d'outils). On ne le réécrit pas. Il lui
manque quatre choses, ajoutées ici :

1. **Les durées du propriétaire.** Le pack fait des films de 30 à 45 s en 16:9. Chaque film se découpe en 5,
   8, 13, 15 et 30 s avec ses propres plans (tableau plus bas) : plan 1 = ambiance Runway, plans 2 et 3 =
   écran réel, plan 4 = ambiance, puis la carte de fin.
2. **Les formats des plateformes.** Les déclinaisons 9:16 se font en régénérant les plans d'ambiance en
   `720:1280` (option `--vertical`) avec la fin de prompt `9:16 vertical framing, subject centered` ; les
   écrans réels vont dans un cadre d'appareil ou sont recadrés sur la zone utile, dans la zone sûre (§ 1).
3. **Les étiquettes IA.** Les plans d'ambiance du pack montrent des personnes et des restaurants générés par
   l'IA, en photoréaliste : « Utilisation de l'IA : oui » sur YouTube, « Infos sur l'IA » sur Facebook et
   Instagram, « Contenu généré par l'IA » sur TikTok (§ 3.4). Une règle propre au Clover App Market sur les
   images générées par IA est **à vérifier** avant le dépôt. La vidéo fonctionnelle (écran réel seulement)
   n'en a pas besoin.
4. **Le bleu au lieu de l'or.** `BRAND.md` a retiré l'or : prompts corrigés ci-dessous, fondus enchaînés
   neutres (pas « dorés »), carte de fin marine `#060D1F` avec le logo officiel au lieu du plan signature or.

Règles qui s'ajoutent à celles du pack :

- **Food Hub et Phone AI sont en révision chez Clover :** aucune modification de leurs fiches ni de leurs
  vidéos tant que la révision n'est pas terminée (pack § 15). Pas de déclinaison courte pour eux avant
  l'approbation.
- **ON2GO (§ 9), plan 2 « fiche publique ON2GO (capture réelle) » :** jamais le marchand `RNVTBYMCKXEJ1`
  (On2GO.ca, dormant, lecture seule). Fiche de démo seulement.
- **Plateformes de livraison :** un film ou une déclinaison destinés à une plateforme (fiche DoorDash, demande
  de menu, campagne commune) ne montrent que cette plateforme. Le film maître et nos propres canaux peuvent en
  montrer plusieurs.
- **Prix et téléphone :** le pack interdit déjà les prix des paliers à l'image ; nos déclinaisons courtes ne
  montrent aucun numéro de téléphone et finissent sur takatak.ca.

Même découpe pour chaque film (numéros de plan du pack) :

| Durée | Plans et minutage | Usage |
| --- | --- | --- |
| 5 s | plan 1 (0:00–0:05) | Boucle du site (16:9, muette, sans texte) · bumper Stories/Shorts (9:16, titre au montage) |
| 8 s | plan 1 (0:00–0:05) + fin bleue (0:05–0:08) | Reels · Shorts · TikTok · Stories (9:16) · scène de défilement de l'accueil (16:9, sans texte ni carte de fin) |
| 13 s | plan 1 (0:00–0:04) + plan 2 (0:04–0:10) + fin bleue (0:10–0:13) | Reels · Shorts · TikTok · LinkedIn |
| 15 s | plan 1 (0:00–0:04) + plan 2 (0:04–0:08) + plan 3 (0:08–0:12) + fin bleue (0:12–0:15) | Reels · Shorts · TikTok · publicités |
| 30 s | plan 1 (0:00–0:05) + plan 2 (0:05–0:12) + plan 3 (0:12–0:19) + plan 4 (0:19–0:26) + fin bleue (0:26–0:30) | Fiche Clover App Market (16:9) · réseaux (9:16) · publicités |

Films concernés : Film maître « TAKATAK — le système » (§ 3) · 4CCOUNTING by TAKATAK (§ 4, VQTZE8C31D8MW) · C4ISSE by TAKATAK (§ 5, VDV7XAH5TPB78) · CH4T by TAKATAK (§ 6, RGE4PFGC9SR7C) · LOY4LTY by TAKATAK (§ 7, WX0Y6313JX1TY) · M4RKETING by TAKATAK (§ 8, EQRZ028619JRW) · ON2GO (§ 9, N4NYCJCZ17FF4) · REW4RDS by TAKATAK (§ 10, 239362NZSVFSC) · ST4FF by TAKATAK (§ 11, E0BGTY752BZYE) · T4CTILE by TAKATAK (§ 12, SFH7X57N3B5FJ) · TAKATAK (§ 13, F4TMP23FM7K5M) · TR4CKER by TAKATAK (§ 14, EB2EPCWEJBZ82). Le texte à l'écran de chaque plan est celui du pack (liste ci-dessous) ; la voix reprend les phrases du texte intégral du pack qui correspondent aux plans gardés.

Prompts corrigés (or → marine et bleu électrique ; « golden » devient « warm », sauf « golden hour », qui est une heure du jour). Pour le 9:16, remplacer la fin `16:9` par `9:16 vertical framing, subject centered`.

- **Film maître « TAKATAK — le système »** (§ 3) : textes à l'écran par plan : 1 « TAKATAK » (ambiance) · 2 « UNE COMMANDE. TOUS LES CANAUX. » (ambiance) · 3 « UN SEUL TABLEAU DE BORD » (écran réel) · 4 « DU COMPTOIR À LA PORTE » (ambiance) · 5 « FIDÉLITÉ · CARTES-CADEAUX · COMPTABILITÉ » (écran réel) · 6 « TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot inside an upscale Montreal restaurant at dusk, dark elegant counter with brass accents, warm light, a sleek point-of-sale terminal on the counter, steam rising softly from the kitchen pass, slow push-in camera, shallow depth of field, premium deep navy ambience with subtle electric blue accents, no text, no logos, no prices, no readable signage, 16:9`
  - plan 2 : `Photorealistic cinematic montage feel, four elegant gestures in a premium restaurant: a hand tapping a card at the counter terminal, a customer touching a large self-service kiosk screen, a phone ringing on a dark counter, a delivery bag being picked up, warm light, smooth slow motion, deep navy palette with subtle electric blue accents, no text, no logos, no readable screens, 16:9`
  - plan 4 : `Photorealistic cinematic shot, delivery courier leaving an upscale Montreal restaurant at blue hour, warm light spilling from the door, customer smiling as they receive their order at a residential doorway, cinematic slow tracking shot, premium deep navy tones with subtle electric blue accents, no text, no logos, no license plates, 16:9`
  - plan 6 : `Photorealistic cinematic close shot of a modern point-of-sale terminal on a dark marble restaurant counter, golden hour light raking across brass details, gentle camera arc, luxurious calm mood, deep navy palette with subtle electric blue accents, no text, no logos, no prices, negative space in upper third, 16:9`
- **4CCOUNTING by TAKATAK** (§ 4) : textes à l'écran par plan : 1 « LA FIN DE JOURNÉE, SANS PAPERASSE » (ambiance) · 2 « TPS ET TVQ, AU CENTIME » (écran réel) · 3 « VERSEMENTS RAPPROCHÉS » (écran réel) · 4 « PRÊT POUR VOTRE COMPTABLE » (ambiance) · 5 « 4CCOUNTING by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, restaurant owner relaxing at closing time in an upscale Montreal bistro, warm lamps, dark wood and brass, staff wiping the counter in soft focus background, slow dolly, calm luxurious mood, no text, no logos, no paperwork with readable writing, 16:9`
  - plan 4 : `Photorealistic cinematic shot, quiet premium restaurant after closing, point-of-sale terminal in sleep mode on a dark counter, warm glow, owner walking out with coat on, peaceful end-of-day atmosphere, slow camera drift, no text, no logos, 16:9`
- **C4ISSE by TAKATAK** (§ 5) : textes à l'écran par plan : 1 « LE COMPTOIR, SANS FRICTION » (ambiance) · 2 « ON TOUCHE LA PHOTO. C'EST TOUT. » (écran réel) · 3 « VARIANTES, SCAN, CLIENT RECONNU » (écran réel) · 4 « RAPIDE DÈS LE PREMIER QUART » (ambiance) · 5 « C4ISSE by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, elegant fast-casual restaurant counter at dinner rush, calm confident staff, customers in soft focus, dark counter with brass trim, warm lighting, smooth lateral tracking shot, premium mood, no text, no logos, no readable menus, 16:9`
  - plan 4 : `Photorealistic cinematic shot, young new employee confidently taking their first order at a bright photo-based register in a premium fast-casual restaurant, warm light, encouraging senior colleague nearby, smooth slow dolly, no readable screen text, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic shot, kitchen pass in a premium Montreal restaurant, a receipt sliding out of a small printer, chef hand taking it, steam and warm light, shallow depth of field, slow motion feel, no readable text on the receipt, no logos, 16:9`
- **CH4T by TAKATAK** (§ 6) : textes à l'écran par plan : 1 « VOS CLIENTS ÉCRIVENT. VOUS SAVEZ QUI ILS SONT. » (ambiance) · 2 « LE CONTEXTE, DANS LA CONVERSATION » (écran réel) · 3 « L'ÉTAT DE COMMANDE, SANS RELANCE » (écran réel) · 4 « HUMAIN, INFORMÉ, RAPIDE » (ambiance) · 5 « CH4T by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, customer at home in the evening typing on a smartphone, warm lamp light, cozy premium interior, calm expression, over-the-shoulder angle with blurred screen, shallow depth of field, no readable text on screen, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic shot, friendly restaurant team member answering a message on a tablet behind an elegant dark counter, warm light, genuine calm smile, premium bistro ambience, slow push-in, no readable text, no logos, 16:9`
- **LOY4LTY by TAKATAK** (§ 7) : textes à l'écran par plan : 1 « UN NUMÉRO. C'EST TOUT. » (ambiance) · 2 « POINTS CRÉDITÉS APRÈS PAIEMENT CONFIRMÉ » (écran réel) · 3 « L'ÉCHANGE DEVIENT UN RABAIS » (écran réel) · 4 « LE MÊME CLIENT, PARTOUT » (ambiance) · 5 « LOY4LTY by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, a regular customer warmly greeted at the counter of an upscale Montreal restaurant, staff member smiling in recognition, warm light, dark elegant interior, slow dolly-in, premium hospitality mood, no text, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic sequence feel, same customer ordering happily in three premium settings: restaurant counter, self-service kiosk, and at home on a laptop, warm continuity of light across scenes, elegant transitions, no readable screens, no text, no logos, 16:9`
- **M4RKETING by TAKATAK** (§ 8) : textes à l'écran par plan : 1 « UN MARDI SOIR, COMPLET » (ambiance) · 2 « VOS VRAIS CLIENTS, EN SEGMENTS » (écran réel) · 3 « DES CAMPAGNES QUI PARTENT AU BON MOMENT » (écran réel) · 4 « ILS REVIENNENT. VOUS SAVEZ POURQUOI. » (ambiance) · 5 « M4RKETING by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, upscale Montreal restaurant filling up on a quiet weekday evening, guests arriving through warm light, elegant dark interior with brass details, smooth crane-down movement, lively but refined mood, no text, no logos, no readable menus, 16:9`
  - plan 4 : `Photorealistic cinematic shot, returning guests welcomed at the door of a premium restaurant, host smiling, warm evening glow, shallow depth of field, slow tracking shot, deep navy palette with subtle electric blue accents, no text, no logos, 16:9`
- **ON2GO** (§ 9) : textes à l'écran par plan : 1 « ILS VOUS CHERCHENT » (ambiance) · 2 « VOTRE FICHE, TOUJOURS À JOUR » (écran réel) · 3 « ZÉRO COMMISSION DE PLATEFORME » (écran réel) · 4 « EN DIRECT, DE VOUS À EUX » (ambiance) · 5 « ON2GO by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, person on a lively Montreal street at dusk searching on a smartphone, restaurant windows glowing warm around them, cinematic shallow focus, premium urban mood, blurred phone screen with no readable text, no logos, no storefront signage readable, 16:9`
  - plan 4 : `Photorealistic cinematic shot, happy customer picking up a takeout bag at an elegant dark restaurant counter, warm light, staff handing the order with a smile, slow push-in, deep navy palette with subtle electric blue accents, no text, no logos, 16:9`
- **REW4RDS by TAKATAK** (§ 10) : textes à l'écran par plan : 1 « UNE PROMESSE, BIEN TENUE » (ambiance) · 2 « VENDUE COMME UNE VRAIE COMMANDE » (écran réel) · 3 « ÉCHANGE PARTIEL ACCEPTÉ » (écran réel) · 4 « VALIDE DANS TOUTES VOS SUCCURSALES » (ambiance) · 5 « REW4RDS by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic close shot, elegant matte deep navy gift card with a thin electric blue edge being handed across a dark marble counter as a present, warm light, soft focus premium restaurant background, slow graceful camera move, luxurious mood, card completely blank with no text and no logo, 16:9`
  - plan 4 : `Photorealistic cinematic shot, customer paying with a sleek deep navy gift card at a second elegant restaurant location, different interior same warm signature light, cashier smiling, smooth arc shot, blank card with no text, no logos, 16:9`
- **ST4FF by TAKATAK** (§ 11) : textes à l'écran par plan : 1 « L'ÉQUIPE, AU CENTRE » (ambiance) · 2 « QUARTS POINTÉS SUR CLOVER » (écran réel) · 3 « LE COÛT RÉEL, QUART PAR QUART » (écran réel) · 4 « LE BON MONDE, AU BON MOMENT » (ambiance) · 5 « ST4FF by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, restaurant team starting their shift in the morning, putting on aprons in an elegant dark kitchen, soft warm window light, confident calm energy, slow steadicam move, premium documentary feel, no text, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic shot, perfectly coordinated dinner service in a premium Montreal restaurant, servers moving gracefully between tables, warm ambience, dark wood and brass, smooth tracking shot, no text, no logos, 16:9`
- **T4CTILE by TAKATAK** (§ 12) : textes à l'écran par plan : 1 « COMME DANS LES GRANDES CHAÎNES » (ambiance) · 2 « VOTRE VRAI MENU, EN PLEIN ÉCRAN » (écran réel) · 3 « PAIEMENT ET POINTS, SANS SORTIR DU PARCOURS » (écran réel) · 4 « DE LA BORNE À LA CUISINE » (ambiance) · 5 « T4CTILE by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, customer standing before a large glowing self-service kiosk screen in a premium dark restaurant, warm rim light, elegant posture, screen showing only blurred colorful food photography with no readable text, slow orbit shot, luxurious fast-casual mood, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic shot, fresh order being handed over a pickup counter from the kitchen side, steam rising, warm light, customer reaching for the tray, shallow depth of field, slow motion elegance, no text, no logos, 16:9`
- **TAKATAK** (§ 13) : textes à l'écran par plan : 1 « PLUSIEURS ADRESSES. UNE SEULE VUE. » (ambiance) · 2 « CHAQUE MARQUE, SON ESPACE » (écran réel) · 3 « LES ÉCARTS, AVANT QU'ILS COÛTENT » (écran réel) · 4 « LE SYSTÈME, VISIBLE » (ambiance) · 5 « TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, multi-location restaurant owner calmly reviewing a tablet over morning coffee in an elegant office above a Montreal restaurant, warm window light, blurred dashboard colors on screen with no readable text, confident relaxed mood, slow push-in, no logos, 16:9`
  - plan 4 : `Photorealistic cinematic triptych feel, three different upscale Montreal restaurants of the same group at dusk, each glowing with the same warm signature light, elegant exteriors with unreadable blurred signage, cinematic wide shots, no text, no logos, 16:9`
- **TR4CKER by TAKATAK** (§ 14) : textes à l'écran par plan : 1 « DE VOTRE CUISINE À LEUR PORTE » (ambiance) · 2 « SUIVI EN DIRECT, SUR LA VRAIE COMMANDE » (écran réel) · 3 « POURBOIRE ET AVIS, APRÈS LA LIVRAISON » (écran réel) · 4 « LIVRÉ. SUIVI. APPRÉCIÉ. » (ambiance) · 5 « TR4CKER by TAKATAK — takatak.ca » (signature)
  - plan 1 : `Photorealistic cinematic shot, delivery driver leaving an upscale Montreal restaurant at dusk carrying an insulated bag, warm door light, city evening glow, smooth tracking shot alongside, premium mood, no text, no logos, no readable license plates, 16:9`
  - plan 4 : `Photorealistic cinematic shot, delighted customer receiving a hot meal at their front door on a Montreal evening, driver handing the bag with a smile, warm porch light against blue-hour street, shallow depth of field, no text, no logos, 16:9`

## 7. Liste de contrôle à la publication

| Plateforme | Réglages à chaque mise en ligne |
| --- | --- |
| YouTube | Attributs › Utilisation de l'IA : **Oui** (plans Runway). « Contient une promotion payée » seulement si un tiers paie ou fournit quelque chose pour la vidéo : YouTube affiche alors une mention pendant 10 s au début ; la loi canadienne peut demander plus ([YouTube Help 154235](https://support.google.com/youtube/answer/154235?hl=en)). Conçue pour les enfants : non. Chapitres, sous-titres FR/EN, liste de lecture (`YOUTUBE_PLAN.md`). |
| Facebook, Instagram | Étiquette « Infos sur l'IA ». Sous-titres. Texte important dans la zone sûre. Musique de la Meta Sound Collection ou sous licence propre. Vidéo de 3 min et plus pour les pubs in-stream. |
| TikTok | « Contenu généré par l'IA » activé. Compte d'affaires : sons de la Commercial Music Library seulement. Le 30 s ne compte pas pour Creator Rewards (1 min et plus). |
| Fiche Google | Tournage réel, 30 s max, 75 Mo max, 720p ou plus, lié au commerce. Pas de texte publicitaire incrusté inutile. |
| Site takatak.ca | 16:9 muet, sans texte, ajouté à `src/lib/website/media-manifest.json` par le kit ; la photo reste l'image fixe. |
| Partout | Description : « Certaines images ont été créées avec l'IA (Runway). » Aucun prix hors du code. Aucune donnée réelle. Une plateforme de livraison à la fois. Signature de l'agent dans le registre des mises en ligne. |

## 8. Ce que le propriétaire doit faire

1. **Déposer le logo officiel** (`logo-circle.png`, `logo-wordmark.png`, `banner.png`) dans
   `knowledgeAI/brand/`. Sans ces fichiers, aucune carte de fin.
2. **Choisir la source des visages** pour la pub et les vidéos monétisées (§ 3.2) : Unsplash+, tournage avec
   décharges signées, ou plans sans visage.
3. **Faire faire les enregistrements d'écran** sur comptes de démo (`RAW_MATERIAL_REQUEST.md` et la liste
   « Matériel réel à fournir » de chaque section). Priorité : fiche locale (heures, heures des Fêtes,
   téléphone, menu, photo), « www » → « Succès, vous êtes en ligne », « Publier » → « Publié sur tous vos
   réseaux ».
4. **Runway :** autoriser `api.dev.runwayml.com` (réseau de la session cloud) ou lancer depuis votre
   ordinateur ; vérifier le coût en crédits de `gen4_turbo` ; générer d'abord les 8 plans déjà dans le kit
   (`npm run media:videos -- --run`, puis `--vertical`).
5. **Musique :** confirmer que le thème maître Suno a été créé sur un forfait payant (preuve gardée), ou
   choisir les pistes dans la Bibliothèque audio YouTube.
6. **Comptes :** chaîne YouTube, Page Facebook et compte Instagram professionnels, compte TikTok d'affaires,
   accès à la fiche Google de TAKATAK. La monétisation de ces comptes est dans
   `docs/marketing/MONETIZATION_ARCHITECTURE.md`.
7. **Décider la langue des chaînes** (une chaîne FR avec traductions, ou FR et EN séparées) avant de
   téléverser les 16 Shorts FR/EN de `youtube-uploads.json` (§ 3.4).

## 9. Sources (consultées le 2026-11-01)

L'accès direct à `support.google.com` et `docs.dev.runwayml.com` était bloqué dans cette session cloud : ces
pages ont été lues par recherche Web. Tout ce qui est marqué « à vérifier » doit être confirmé sur la page
officielle avant usage.

- YouTube : Shorts de 3 minutes ([15424877](https://support.google.com/youtube/answer/15424877?hl=en) ; [Blog, oct. 2024](https://blog.youtube/news-and-events/tall-updates-coming-to-shorts/)) · mid-rolls 8 min et plus ([6175006](https://support.google.com/youtube/answer/6175006?hl=en)) · contenu IA ([14328491](https://support.google.com/youtube/answer/14328491?hl=en), [Blog 2024](https://blog.youtube/news-and-events/disclosing-ai-generated-content/), [Blog 2026](https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/)) · politiques de monétisation, contenu non authentique ou réutilisé ([1311392](https://support.google.com/youtube/answer/1311392?hl=en)) · Bibliothèque audio ([3376882](https://support.google.com/youtube/answer/3376882?hl=en)) · musique sûre ([15577610](https://support.google.com/youtube/answer/15577610?hl=en)) · Creator Music FAQ ([11610609](https://support.google.com/youtube/answer/11610609?hl=en)) · promotion payée ([154235](https://support.google.com/youtube/answer/154235?hl=en)).
- Meta : étiquettes IA ([Meta Help](https://www.meta.com/en-gb/help/artificial-intelligence/1783222608822690/)) · in-stream, spécifications annonceurs ([1199881793491951](https://www.facebook.com/business/help/1199881793491951)) · Content Monetization ([About Meta, oct. 2024](https://about.fb.com/news/2024/10/monetize-content-facebooks-new-streamlined-program/)) · Reels de 3 min ([Social Media Today, janv. 2025](https://www.socialmediatoday.com/news/instagram-officially-expands-reels-length-to-3-minutes/737766/)) · zones sûres (guides tiers : [Billo](https://billo.app/blog/meta-ads-safe-zones), [AdNabu](https://blog.adnabu.com/meta-ads/meta-safe-zones/)).
- TikTok : contenu IA ([Support](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content), [Règles de la communauté 2025 S2](https://www.tiktok.com/community-guidelines/en-GB/integrity-authenticity?cgversion=2025H2update)) · Creator Rewards ([conditions](https://www.tiktok.com/legal/page/global/creator-rewards-program-us/en), [Support](https://support.tiktok.com/en/business-and-creator/creator-rewards-program)) · Commercial Music Library ([Ads Help](https://ads.tiktok.com/help/article/commercial-music-library)).
- Google Business Profile : photos et vidéos ([6103862](https://support.google.com/business/answer/6103862?hl=en)), conseils photo ([6123536](https://support.google.com/business/answer/6123536?hl=en)), politique de contenu ([7213077](https://support.google.com/business/answer/7213077?hl=en)).
- Runway : [modèles](https://docs.dev.runwayml.com/guides/models/), [paramètres](https://docs.dev.runwayml.com/assets/inputs/), [changelog](https://docs.dev.runwayml.com/api-details/api_changelog/), [Gen-4](https://help.runwayml.com/hc/en-us/articles/37327109429011-Creating-with-Gen-4-Video).
- Unsplash : [licence](https://unsplash.com/license), [décharge de modèle](https://help.unsplash.com/en/articles/6604664-when-do-i-need-to-get-a-model-release), [licence Unsplash+](https://unsplash.com/plus/license).
- Suno (résumés tiers, à vérifier sur suno.com) : [Dynamoi](https://dynamoi.com/learn/ai-music-distribution/suno-commercial-rights-explained), [terms.law](https://terms.law/ai-output-rights/suno/).
- Langue française : [Éducaloi](https://educaloi.qc.ca/actualites-juridiques/droits-linguistiques-de-nouvelles-regles-pour-les-entreprises/), [DLA Piper, juin 2025](https://www.dlapiper.com/fr-ca/insights/publications/2025/06/quebecs-language-laws-changed-this-week).
- Divulgation au Canada : [Ad Standards, lignes directrices oct. 2025 (résumé Gowling WLG)](https://gowlingwlg.com/en/insights-resources/articles/2025/updated-influencer-marketing-disclosure-guidelines-in-canada).
- Faits internes : `BRAND.md`, `src/lib/website/home-funnel.ts`, `core-categories.ts`, `pricing.ts`, `mimt-plans.ts`, `translations/fr.ts`, `src/lib/growth/ai-engine.ts`, `docs/TAKBOT_TRIAL.md`, `docs/SALES_FLOW_PLAN.md`, `public/photos/CREDITS.md`, `ACADEMYTAKATAK/src/lib/catalog.ts`, `mimtcaapp/docs/MIMT-LAUNCH.md`.

— signé : Claude (agent Runway, session upbeat-einstein) @ Claude Code cloud · 2026-11-01 12:12 UTC
