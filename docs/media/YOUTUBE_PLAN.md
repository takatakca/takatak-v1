# Chaîne YouTube TAKATAK — plan et paquet de mise en ligne

Ordre du propriétaire (2026-10-31) : tout pousser sur YouTube, organisé par catégories, SEO propre, mots-clic,
Shorts, Reels, vidéos de plus de 30 s et de 3 min, et l'Academy. — signé : Claude (cloud session upbeat-einstein)

## Prêt à téléverser maintenant

`docs/media/youtube-uploads.json` : 18 vidéos avec titre, description, mots-clés, mots-clic, langue, liste de
lecture et catégorie, déjà rédigés.

| Vidéos | Fichiers | Format |
| --- | --- | --- |
| 8 services × FR + EN | `public/media/social/<service>-fr.mp4`, `-en.mp4` | Shorts / Reels, 7 s, vertical |
| « TAKATAK en 60 secondes » FR + EN | `public/media/social/takatak-60s-fr.mp4`, `-en.mp4` | Short, 56 s, vertical |

Les mêmes fichiers servent pour Instagram Reels, Facebook Reels et TikTok (légendes dans
`docs/media/FICHES_VIDEO.md`).

## Organisation de la chaîne (YouTube Studio → Personnalisation → Mise en page)

| Section / liste de lecture | Contenu | Langue |
| --- | --- | --- |
| TAKATAK — Services en 7 secondes | les 8 Shorts + le 60 s | FR (et la version EN dans « Services in 7 seconds ») |
| TAKATAK Academy — Sites web, domaines et hébergement | leçons de 3 min | FR / EN |
| TAKATAK Academy — SEO + AEO | leçons de 3 min | FR / EN |
| TAKATAK Academy — SEO local et QMAPS | leçons de 3 min | FR / EN |
| TAKATAK Academy — Réseaux sociaux et marketing | leçons de 3 min | FR / EN |
| TAKATAK Academy — Outils IA et automatisation | leçons de 3 min | FR / EN |
| TAKATAK Academy — Shopify et commerce en ligne | leçons de 3 min | FR / EN |
| TAKATAK Academy — Téléphonie d'affaires | leçons de 3 min | FR / EN |
| Suite Clover (après approbation des fiches) | films du pack Clover (foodhubca, 2026-10-28) | FR / EN |
| Témoignages clients | 10 s par client réel, avec consentement écrit | FR / EN |

Les cours viennent du catalogue de l'Academy (`ACADEMYTAKATAK/src/lib/catalog.ts`).

## Règles SEO pour chaque vidéo

- Titre ≤ 70 caractères visibles : le bénéfice d'abord, puis « | TAKATAK ». Pas de majuscules partout, pas de
  promesse non prouvée.
- Description : la phrase clé dans les 2 premières lignes, le lien takatak.ca, 3 à 5 mots-clic (le 1er
  s'affiche au-dessus du titre), « #Shorts » sur les Shorts.
- Langue et sous-titres définis (FR ou EN). Catégorie « Science et technologie ». « Conçu pour les enfants » : non.
- Une vignette par vidéo : la carte de fin bleue du clip.
- Chaque plateforme de livraison n'apparaît que seule ; aucun nom de client sans consentement écrit.

## Vidéos plus longues

- **30 à 60 s** : enchaîner 3 à 5 clips d'un même thème avec la commande `ffmpeg … concat` (voir le 60 s).
- **3 min (Academy)** : une leçon = intro 10 s (clip du service) + 2 min 30 de démonstration réelle (capture
  d'écran du tableau de bord TAKATAK ou de l'outil, compte de démo) + voix off ElevenLabs lue depuis le texte de
  la leçon + carte de fin. Les captures d'écran viennent des agents (`docs/media/RAW_MATERIAL_REQUEST.md`).

## Témoignages de 10 secondes

Seulement de vrais clients, filmés pendant ou après un vrai travail, avec leur accord écrit (formulaire :
nom, entreprise, ce qui peut être montré, date, signature ; une copie conservée). Jamais de photo libre de droits
présentée comme un client, jamais de témoignage écrit par nous.

## Ce que cette session ne peut pas faire

Aucun accès à YouTube Studio ni à l'API YouTube d'ici (pas de connecteur YouTube, réseau limité). Téléverser
depuis YouTube Studio avec le compte takatak.ca@gmail.com, en copiant les champs de `youtube-uploads.json`, ou
brancher un connecteur YouTube pour qu'un agent le fasse.
