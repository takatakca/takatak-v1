# takatak.ca : vitesse, accessibilité, SEO et sécurité (2026-11-04)

Demande du propriétaire : « 100 % partout quand je scanne ce soir, même la sécurité », avec les fenêtres d'appel,
de mot de passe et de partage d'écran.

**Où ces chiffres ont été mesurés :** Lighthouse 12 sur un serveur de production local (`next build --webpack` puis
`next start`), cellulaire (Moto G simulé, réseau 4G lent simulé) et ordinateur. La session infonuagique ne peut pas
joindre takatak.ca. **Le site en ligne ne change qu'après la fusion de la PR et le déploiement par le propriétaire.**
PageSpeed Insights utilise le même Lighthouse, mais sur les serveurs de Google, avec le réseau et le cache de
production : les notes de performance peuvent varier de quelques points d'un essai à l'autre.

## Notes (builds du 2026-11-04, 06:20 et 06:38 UTC)

| Page | Cellulaire perf. | Ordinateur perf. | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|---|
| `/?lang=fr` (accueil FR) | 65 (était 49) | 97 (était 85) | 100 | 100 | 100 |
| `/` (accueil EN) | 64 | 96 | 100 | 100 | 100 (était 92 : liens « See more ») |
| `/marketplace` | 90 | 100 | 100 | 100 | 100 |
| `/deals` | 88 | 100 | 100 | 100 | 100 |
| `/free-tools` | 90 | 100 | 100 | 100 | 100 |
| `/clover` | 88 | 100 | 100 (était 96) | 100 | 100 |
| `/foodhub` | 85 | 100 | 100 (était 96) | 100 | 100 |
| `/takbot` | 82 | 99 | 100 (était 97) | 100 | 100 |
| `/services/websites` | 86 | 99 | 100 (était 97) | 100 | 100 |
| `/infolettre` | 77 | 98 | 100 | 100 | 100 |
| `/seo`, `/pricing`, `/domain`, `/hosting` (build précédent) | 80–88 | 99–100 | 100 après les correctifs | 100 | 100 |

`/register`, `/login` et `/commander` ont un SEO de 66 **exprès** : ces pages sont marquées `noindex` (on ne veut
pas une page de connexion ou un panier dans Google). C'est la bonne pratique ; le propriétaire peut demander de
retirer `noindex` sur `/register` s'il préfère, mais c'est la zone d'authentification, donc pas sans son accord.

## Ce qui a été corrigé

**Vitesse (cellulaire surtout)**
- Le premier affichage n'attend plus : l'écran « Loading… » global est retiré (sans JavaScript, les pages publiques
  montraient seulement « Loading… »).
- Les scripts Upmind (domaines/hébergement) ne se chargent plus sur chaque page, seulement quand on ouvre la fenêtre.
- La bibliothèque de connexion Google de TAK-TAK se charge au clic, pas avec la page d'accueil (55 Ko de moins).
- Les photos de la bande d'offres, les enregistrements vidéo de l'application et leurs affiches se chargent quand on
  approche, pas au premier affichage.
- Le logo de 36 px demandait une image de 1920 px : il demande maintenant 48/96 px.
- Les polices du tableau de bord (Geist) et l'italique d'accent (Instrument Serif) ne sont plus préchargées sur les
  pages publiques. Il reste Inter (texte) et Montserrat (titres).
- Animations du héros (anneau, micro, puces) refaites pour le processeur graphique seulement ; les sections plus bas
  ne sont dessinées qu'à l'approche.
- Octets téléchargés avant le premier affichage sur cellulaire (accueil) : **1 054 Ko → 711 Ko**.

**Accessibilité** : contrastes WCAG AA (petits textes des mini-écrans Clover, pastilles vertes, légendes « Aperçu »,
TAK-TAK), ordre des titres du pied de page, onglets des prix, une seule balise h1 sur `/infolettre`.

**SEO** : liens « See more / Voir plus » qui nomment leur service ; `/deals`, `/free-tools`, `/blog`, `/marketplace`
et les moteurs TAK-TAK en français ; plus de liens morts dans le pied de page.

**Sécurité (en-têtes sur chaque page)** : HSTS (1 an), `Content-Security-Policy` de base (`base-uri 'self'`,
`object-src 'none'`, `frame-ancestors 'self'`, `form-action 'self' https:`), `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, plus d'en-tête `X-Powered-By`, et
`/.well-known/security.txt` (RFC 9116).

**Fenêtres d'appel, de mot de passe et d'écran** : la `Permissions-Policy` permet au site lui-même (et seulement à
lui) la caméra, le micro, le partage d'écran et le plein écran (appels), et les clés d'accès et codes à usage unique
(mots de passe). Géolocalisation, USB et Bluetooth restent fermés.

**Honnêteté** : la place de marché affichait des étoiles et des nombres d'avis (« 4,9 (312) ») qui n'étaient pas de
vrais avis. Ils sont retirés partout (accueil de la place de marché, cartes de résultats, pages de forfait, tri
« mieux notés »). Les cartes montrent maintenant les vrais titres, prix de départ et délais du catalogue.

## Ce qui reste pour atteindre 100 partout

1. **Performance cellulaire de l'accueil (~60)** : la page fait environ 17 000 px et 5 500 éléments ; le simulateur
   compte tout le JavaScript qui la rend interactive. Le vrai Chrome ralenti affiche le texte principal en 0,4 s, mais
   la note simulée reste basse. Le levier réel est la proposition 4 de l'inventaire (une page d'accueil plus courte,
   les détails sur leurs propres pages) : c'est une décision du propriétaire.
2. **Sécurité A+ (Mozilla Observatory)** : il faut une CSP stricte avec un *nonce* (`script-src 'nonce-…'
   'strict-dynamic'`). Next 16 le permet dans `proxy.ts`, mais chaque page doit alors être rendue à la demande et chaque
   script tiers (Upmind, clavardage) vérifié en production. À faire dans sa propre PR, testée sur le site en ligne.
   `includeSubDomains` / `preload` pour HSTS : seulement si tous les sous-domaines de takatak.ca sont en HTTPS.
3. `/register`, `/login`, `/commander` : `noindex` voulu (voir plus haut).

Captures (local, après les correctifs) : `home-desktop.jpg`, `home-phone.jpg` (plus de fenêtre 10 % sur le cellulaire),
`marketplace-desktop.jpg`, `marketplace-phone.jpg` (vrais prix, sans fausses étoiles), `deals-desktop.jpg`,
`free-tools-phone.jpg`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-04 06:42 UTC
