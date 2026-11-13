# Standards de sécurité — sites web clients

**Initiative Irqc — 2026-11-04.** Documentée par TWILO.

## Contexte

Dans la nuit du 2026-11-04 (~00:42), Irqc a transmis 7 captures d'écran
(Uber Eats, Banque Scotia, Neo, Google) comme modèles des sécurités à
répliquer sur **chaque site web client** du groupe. Objectif : protéger les
clients avec les mêmes mécanismes que les grandes plateformes, configurés
avec les paramètres propres de chaque client (numéros, appareils, courriels
d'alerte).

Ceci fait suite au pop-up déjà livré précédemment (référence exacte à
préciser) — l'initiative continue à partir de là.

## Les 5 mesures à implémenter partout

### 1. Vérification en 2 étapes (2SV) sur l'accès
- Modèle : Banque Scotia — « Activate 2-step verification », appareil nommé
enregistré (ex. Galaxy S23 Ultra), bascule des codes SMS vers les
notifications push.
- À implémenter : 2SV obligatoire sur les comptes admin/propriétaire de
chaque site client, avec codes de secours.

### 2. Alerte immédiate de modification des infos bancaires
- Modèle : Uber Eats — « Attention ! Quelqu'un a essayé de modifier vos
informations bancaires dans le Gestionnaire Uber Eats », avec les détails
d'activité : **date et heure, commerce concerné, appareil utilisé**, +
lien vers le service d'aide + conseils anti-fraude.
- À implémenter : tout changement (ou tentative) sur les coordonnées de
paiement/versement d'un client déclenche un courriel/SMS immédiat avec
ces 3 détails minimum.

### 3. Approbation de connexion inter-appareils
- Modèle : Scotia — « Sign-in approved. You can return to your other app,
browser, or device, or continue banking here. »
- À implémenter : quand une connexion est approuvée depuis un 2e appareil,
afficher une confirmation claire et proposer de continuer ou retourner.

### 4. Vérification « match the number »
- Modèle : Google — « Tap the number shown on your other device »
(choix entre 3 nombres) pour prouver que c'est bien le titulaire.
- À implémenter : pour les actions sensibles (connexion d'un nouvel
appareil, changement de mot de passe), préférer le match-the-number au
simple « oui/non ».

### 5. Vérification d'identité avant le support
- Modèle : Neo — « Are you contacting Neo Support ? We're making sure
it's you we're speaking with. » (Yes, it's me / No, it isn't me).
- À implémenter : tout contact support (téléphone/clavardage) commence par
une vérification d'identité du demandeur.

## Déploiement par client

- [ ] Inventorier les sites clients concernés
- [ ] Pour chaque site : activer 2SV admin + alertes bancaires + approbation
de connexion, avec les paramètres propres du client
- [ ] Noter la configuration appliquée par site (sans secrets) dans le suivi
- [ ] Annoncer aux clients via le fil COORDINATION AGENTS

## Événements réels ayant motivé l'initiative (2026-11-04)

- **Uber Eats — Bolon Café (Saint-Léonard)** : tentative de modification des
informations bancaires le 2026-11-04 à 00:40 depuis un appareil Linux.
**CONFIRMÉ par Irqc le 2026-11-04 ~00:44 : c'était lui.** Pas de fraude.
- Rappel : alerte similaire **Uber Eats — O'Crêpe** (tentative + ajout
réussi) le 2026-11-03 — attribution toujours non confirmée par Irqc.

— TWILO
