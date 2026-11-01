# Fiches vidéo TAKATAK — clips de 5 à 8 secondes

Une fiche par service. Chaque clip existe déjà en version **muette** (montée ici avec ffmpeg à partir de
photos sous licence) ; la fiche dit comment le passer au niveau suivant avec les comptes IA de TAKATAK
(registre Drive « Registre des comptes IA — v4 (29 services) », connexion takatak.ca@gmail.com).

## Ce qui est déjà prêt (dans ce dépôt)

| Fichier | Format | Usage |
| --- | --- | --- |
| `public/media/social/<service>-fr.mp4` | 1080×1920, 7 s, muet | Reels, Shorts, TikTok, Stories (français) |
| `public/media/social/<service>-en.mp4` | 1080×1920, 7 s, muet | même chose en anglais |
| `public/media/videos/<service>.mp4` | 1280×720, 6 s, boucle | le site les joue tout seul |

Refaire ou ajouter un clip : `python3 scripts/media/make-clips.py <service>` (textes dans
`scripts/media/clip-copy.json`). Les 8 services : website, domains, hosting, marketing, social, local,
reviews, billing.

## Chaîne de production (un outil par rôle, selon le registre)

| Rôle | Outil (compte TAKATAK) | Pour ces clips |
| --- | --- | --- |
| Plans animés à partir d’une photo | **Runway** (plan Pro, workspace takatakca ; 1 000 crédits achetés le 2026-10-06, reçu dans Drive) | `npm run media:videos -- --run` : 8 plans de 5 s (`scripts/media/runway-shots.json`) |
| Voix off | **ElevenLabs** (profil « takatak ca ») | une phrase par clip, FR québécois posé / EN nord-américain calme |
| Musique | **Suno** | le thème maître du pack Clover (piano feutré, ~90 BPM), coupé à 7 s |
| Contrôle qualité | **Twelve Labs** (plan Plus) | vérifier : aucun texte parasite, aucun logo inventé, aucun prix faux |
| Déclinaisons courtes | **Revid AI** (70 crédits affichés au registre) | seulement si une version 15 s est demandée |
| Vignettes | une image du clip (carte de fin bleue) | pas besoin de génération |

Règle de crédits : 5 secondes par plan Runway, un seul essai par plan, puis on garde ce qui marche.
Le registre du 2026-10-26 parle d’un gel de création en attendant le « Méga planning » de Taktak : ces
fiches s’y ajoutent, elles ne le remplacent pas.

## Règles pour chaque clip et chaque publication

- Prix seulement ceux de `src/lib/website/pricing.ts`. Aucun nom de client, aucun résultat non prouvé.
- Photos de personnes : licence Unsplash (`public/photos/CREDITS.md`) ; jamais présentées comme clients
  ou employés de TAKATAK, jamais de faux témoignage.
- Chaque plateforme de livraison n’apparaît que seule (un clip DoorDash ne montre jamais Uber).
- Couleurs : bleu TAKATAK (#1565D8) sur blanc ou bleu électrique sur marine (`BRAND.md`), jamais l’or.

---

## 1. Sites web — `website`

- **À l’écran (FR)** : « Votre commerce mérite un site à sa hauteur. » · puce « votrecafe.ca · En ligne »
- **On screen (EN)**: "Your business deserves a website that matches it." · chip "yourcafe.ca · Live"
- **Voix off FR (≤ 6 s)** : « Un site à votre image, bâti et entretenu par TAKATAK. »
- **Voice-over EN**: "A website that looks like you, built and looked after by TAKATAK."
- **Plan Runway** : propriétaire de café au téléphone, lent travelling avant (`website`).
- **YouTube Shorts** — titre : « Un site web pour votre commerce à Montréal | TAKATAK » ; description : site
  web sur mesure, nom de domaine, hébergement et courriel pro, équipe bilingue à Montréal. takatak.ca
- **Instagram / Facebook** : Votre commerce mérite un site à sa hauteur. On le bâtit, on l’héberge, on s’en
  occupe. 👉 takatak.ca #SiteWeb #Montréal #PetiteEntreprise #Québec

## 2. Domaines — `domains`

- **FR** : « Votre nom, en ligne, aujourd’hui. » · « votremarque.ca · Disponible · 19,99 $/an »
- **EN**: "Your name, online, today." · "yourbrand.ca · Available · $19.99/yr"
- **Voix off** : « Trouvez votre .ca sur takatak.ca. » / "Find your .ca on takatak.ca."
- **Plan Runway** : cliente souriante devant son téléphone dans un café (`domains`).
- **Shorts** : « Réservez votre nom de domaine .ca | TAKATAK » · #NomDeDomaine #PointCA #Québec

## 3. Hébergement — `hosting`

- **FR** : « Rapide, sécurisé, avec une vraie équipe derrière. » · « SSL actif · Sauvegardé aujourd’hui »
- **EN**: "Fast, secure, with a real team behind it." · "SSL on · Backed up today"
- **Voix off** : « Hébergement rapide et sécurisé, avec du soutien humain au Canada. »
- **Plan Runway** : professionnelle en appel devant son portable (`hosting`).
- **Shorts** : « Hébergement web au Canada, soutien humain | TAKATAK » · #HébergementWeb #Canada

## 4. Marketing — `marketing`

- **FR** : « Des clients qui reviennent, semaine après semaine. » · « Campagne Meta · En cours »
- **EN**: "Customers who come back, week after week." · "Meta campaign · Running"
- **Voix off** : « Publicités Meta et Google, mesurées dans un seul tableau de bord. »
- **Plan Runway** : designer au téléphone dans son atelier (`marketing`).
- **Shorts** : « Publicité Facebook et Google pour PME | TAKATAK » · #MarketingNumérique #PME

## 5. Réseaux sociaux — `social`

- **FR** : « Une publication. Tous vos réseaux. » · « Planifiée · Mesurée »
- **EN**: "One post. Every network." · "Scheduled · Measured"
- **Voix off** : « Une publication, partout, au bon moment. »
- **Plan Runway** : mains qui font défiler un téléphone sur une table de café (`social`).
- **Shorts** : « Gérer tous vos réseaux sociaux au même endroit | TAKATAK » · #RéseauxSociaux

## 6. Fiches locales — `local`

- **FR** : « Quand on cherche près d’ici, c’est vous qu’on trouve. » · « Fiche Google · À jour »
- **EN**: "When people search nearby, they find you." · "Google profile · Up to date"
- **Voix off** : « Votre fiche Google, les cartes et les annuaires, toujours à jour. »
- **Plan Runway** : artisan qui célèbre dans son atelier (`local`).
- **Shorts** : « Être trouvé sur Google Maps | TAKATAK » · #SEOlocal #GoogleMaps #Montréal

## 7. Avis — `reviews`

- **FR** : « Plus d’avis. De meilleures réponses. » · « Nouvel avis Google · ★★★★★ »
- **EN**: "More reviews. Better replies." · "New Google review · ★★★★★"
- **Voix off** : « Demandez des avis et répondez à chacun, sans y passer vos soirées. »
- **Plan Runway** : artisan qui lit une bonne nouvelle (`reviews`).
- **Shorts** : « Obtenir plus d’avis Google | TAKATAK » · #AvisGoogle #Réputation

## 8. Facturation — `billing`

- **FR** : « Factures avec TPS et TVQ, payées en ligne. » · « Facture #1042 · Payée »
- **EN**: "Invoices with GST and QST, paid online." · "Invoice #1042 · Paid"
- **Voix off** : « Facturez avec TPS et TVQ et soyez payé par carte, en ligne. »
- **Plan Runway** : professionnelle qui termine son appel en souriant (`billing`).
- **Shorts** : « Facturation TPS TVQ en ligne pour PME | TAKATAK » · #Facturation #TPS #TVQ

---

## Phase 2 — produits (après réception du matériel brut des agents)

Food Hub, la suite Clover, QMAPS, FLEXS, MIMT, Academy et TAK bot : enregistrements d’écran de 10 à 30 s
sur comptes de démo (demande : `docs/media/RAW_MATERIAL_REQUEST.md`). Montage : 2 s d’ambiance (photo ou
plan Runway) + 3 à 5 s d’écran réel + carte de fin bleue. Les films Clover suivent le pack existant
(foodhubca, 2026-10-28) en remplaçant l’or par le bleu.
