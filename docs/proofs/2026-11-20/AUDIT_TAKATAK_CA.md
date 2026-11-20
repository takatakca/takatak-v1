# Audit en direct de takatak.ca — 2026-11-20

Ordre du propriétaire du 2026-11-13 : lire le site en direct (captures et OCR), faire marcher ce qui ne marche pas,
finir ce qui doit l'être, et ne plus montrer de prototypes aux clients. Ce document classe ce que nous avons trouvé et
explique pourquoi le projet donne l'impression de s'effondrer.

- **Site lu :** https://takatak.ca, version en ligne `db4140f6` (en-tête `x-takatak-release`).
- **Méthode :** robot de navigation sur les 118 pages publiques, en français, avec captures, OCR (tesseract `fra`),
  chaque lien et chaque bouton. Envoi réel des formulaires vers l'API de production. Lecture de la base de production
  (demandes reçues) en lecture seule.
- **Rien de privé ici :** aucun identifiant, aucune clé, aucune donnée de client. L'identifiant de l'espace TAKATAK qui
  reçoit les demandes est dans la note Drive seulement.

## 1. Ce qui fonctionne

- Les 118 pages publiques répondent 200, sans erreur de notre code. `www.takatak.ca` répond aussi.
- Le catalogue, les prix réels, les forfaits, les pages de services et la marketplace s'affichent correctement.
- L'assistant TAK-TAK de l'accueil répond à partir du vrai catalogue (vrais prix) et met les services dans la
  sélection du visiteur.
- Non vérifié de bout en bout : un paiement réel et une session de client connecté sur les données de production.

## 2. Ce qui est cassé pour les clients (cause unique)

**Depuis le 2026-11-08, la production refuse toutes les demandes.** `POST /api/public/website-requests` répond
`503 not_enabled`. Les 4 dernières demandes enregistrées sont arrivées de `/transfert` le 6 et le 8 novembre : la prise
de demandes marchait, puis elle a été coupée dans les réglages de production.

Chemins touchés, tous ceux qui vendent :

- le formulaire de contact ;
- « Publier un projet » (marketplace) ;
- la commande d'un forfait (`/checkout`) ;
- la demande de transfert de domaine ou de site ;
- la demande d'hébergement ;
- la fiche de demande préparée par TAK-TAK.

**Ce n'est pas du code : c'est un réglage.** Le code lit `WEBSITE_LEADS_ENABLED` et `WEBSITE_LEADS_CLIENT_ID`.
Sans les deux, chaque demande est refusée.

**À faire par le propriétaire (Coolify, production) :**

1. `WEBSITE_LEADS_ENABLED=true`.
2. `WEBSITE_LEADS_CLIENT_ID=<identifiant de l'espace TAKATAK>` (dans la note Drive).
3. Facultatif : `WEBSITE_LEADS_NOTIFY_EMAIL` pour un courriel à chaque nouvelle demande.
4. Redéployer.

**Ce que nous avons fait en attendant (PR #353, fusionnée) :** aucune demande ne se perd. Quand le serveur refuse,
chaque formulaire propose la même demande dans un courriel déjà écrit à support@takatak.ca. Le visiteur n'a qu'à
l'envoyer.

## 3. Fermé par un réglage (le code existe, la clé ou l'interrupteur manque)

| Fonction | Ce qui manque |
| --- | --- |
| Infolettre | `NEWSLETTER_TOKEN_SECRET`, `NEWSLETTER_SENDER_ADDRESS`, et la prise de demandes (§2) |
| Alertes push des promotions | Clés VAPID |
| Moteurs du studio TAK-TAK | 0 moteur branché sur 21 (clés des fournisseurs) |
| Achat de crédits IA | Paiement désactivé |
| Essai TAK-TAK sur l'accueil | Désactivé |
| Surveillance payante | Inscriptions fermées |

## 4. Prototypes montrés aux clients (corrigé)

Dans le tableau de bord, un client connecté voyait :

- 13 pages vides qui affichaient « Foundation placeholder », des fonctions prévues, des moteurs futurs et un chemin de
  document interne ;
- 3 pages bâties sur des données fictives (« Mock foundation data », « No service is live ») ;
- `/contact` envoyait les clients vers `/dashboard/support`, qui était une de ces pages vides.

**Corrigé dans la PR #353 :**

- `/dashboard/support` est une vraie page : le formulaire lié au compte, le courriel de soutien, la facturation et les
  factures.
- 16 espaces non finis sont retirés du menu des clients (`STAFF_ONLY_ROUTES`). L'équipe TAKATAK les voit encore.
- `/dashboard/services`, `/integrations` et `/jobs` montrent une page propre à quiconque n'est pas de l'équipe.
- Les pages vides restantes ne contiennent plus de jargon interne. Elles disent que l'espace n'est pas encore en
  libre-service et proposent « Demander à l'équipe ».

## 5. À décider ou à faire par le propriétaire

- **flexs.ca répond 403.** Le lien est dans l'en-tête de chaque page. L'en-tête est hors limites pour nous.
- **Textes légaux :** `/terms` et `/privacy` sont en anglais seulement. Une traduction légale demande votre accord.
- **Supabase :**
  - le courriel « Magic Link » a le mauvais modèle (sujet d'invitation, lien sans `/auth/callback`) ;
  - `https://takatak.ca/auth/callback` doit être dans les adresses de retour permises pour Google.
- **Connexion :**
  - le lien « Create an account » de `/login` perd `?next=` ;
  - le formulaire de connexion est en anglais seulement, et la PR #275 qui le traduisait est en conflit.

## 6. Pourquoi le projet donne l'impression de s'effondrer

1. **Des écrans avant les branchements.** Des sessions d'IA ont livré l'interface (pages, menus, boutons) avant le
   serveur, les clés ou les données. L'écran avait l'air fini, alors il est parti en ligne.
2. **Des interrupteurs laissés fermés.** Beaucoup de fonctions sont protégées par une variable d'environnement. Quand
   elle manque, la fonction se ferme sans bruit. C'est sûr, mais personne ne le voit : le site a l'air normal et les
   demandes tombent dans le vide.
3. **Personne ne vérifiait le vrai chemin de vente en production.** Les tests automatiques ouvrent les pages
   (réponse 200), mais n'envoient jamais une vraie demande. Une page qui répond 200 avec un formulaire qui refuse
   tout passe tous les tests.
4. **Beaucoup d'agents en parallèle.** Chacun finissait son morceau. Personne ne faisait le parcours complet d'un
   client, du premier clic jusqu'à la demande reçue.
5. **Les pages vides restaient dans le menu.** Les espaces « à venir » étaient visibles des clients au lieu d'être
   réservés à l'équipe.

**La règle à partir de maintenant :**

- une fonction n'apparaît devant un client que si elle marche de bout en bout en production ;
- sinon elle est réservée à l'équipe, ou remplacée par « Demander à l'équipe » ;
- chaque formulaire a une sortie qui ne perd jamais la demande (le courriel prérempli).

## 7. Suite

- Accueil : TAK-TAK devient un écran de clavardage plein format (demande du propriétaire du 2026-11-20). Le texte
  de gauche est retiré.
- Après le rétablissement de la prise de demandes : envoyer une vraie demande de test depuis chaque formulaire et
  vérifier qu'elle arrive dans la boîte des demandes.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-20 17:45 UTC
