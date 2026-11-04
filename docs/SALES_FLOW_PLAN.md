# Tunnel de vente IA : de la conversation au contrat signé

*Plan pour le propriétaire et les agents. Ce qui est fait, ce qui reste, dans quel ordre, et les règles à respecter.
Aucun secret ici. English summary at the bottom.*

## 1. Ce qui est en ligne dans le code (branche `claude/upbeat-einstein-zqkf58`)

| Étape | État | Où |
| --- | --- | --- |
| Assistant ventes IA à côté des offres (Écrire · Parler · Un humain) | fait | `src/components/website/funnel/OfferRail.tsx` |
| Reste sur la vente ; un problème avec un service existant → soutien | fait | `src/lib/website/concierge.ts` (intention `support`) |
| Remplit la fiche dans la conversation (nom, entreprise, courriel, téléphone), la montre à côté, demande « Tout est bon ? », envoie | fait | `src/lib/website/sales-fiche.ts`, `AskBar.tsx` |
| La demande arrive dans `/dashboard/leads/inbox` (même circuit que les formulaires) | fait | `POST /api/public/website-requests`, `category: sales-assistant` |
| Mode voix : dictée du navigateur, réponses lues à voix haute, envoi automatique à la fin de la dictée | fait (navigateur) | `AskBar.tsx` |
| Essai TAK-TAK : connexion Google, fiche client, 50 crédits | fait | `docs/TAKBOT_TRIAL.md` |
| Commande pas à pas, sans paiement | existe | `/commander` |

## 2. Ce qui reste, dans l'ordre

Chaque étape est une PR séparée, testée, derrière un interrupteur (variable d'environnement), fermée par défaut.

1. **Voix temps réel** (comme le mode vocal de ChatGPT). Un modèle temps réel côté serveur (clé dans Admin › AI provider
   keys), session courte signée, limitée à la vente : catalogue et prix réels seulement, jamais de prix inventé. Coût
   par minute à fixer avant d'ouvrir. Le mode actuel (dictée + lecture) reste la solution de repli.
2. **Paiement Stripe** (Checkout, mode abonnement) depuis la fiche :
   - les prix viennent du catalogue côté serveur, jamais du navigateur ;
   - la carte est gardée pour le compte seulement si le client coche « Garder cette carte » (`setup_future_usage`),
     jamais cochée d'avance ;
   - **pré-autorisation** : Stripe permet de bloquer un montant (`capture_method: manual`) environ 7 jours pour une carte.
     On l'utilise seulement pour un montant affiché et accepté, puis on encaisse au début du service, ou on libère.
3. **Vérification du téléphone** : code par texto (Supabase Auth + Twilio, chantier
   [TAKATAK AUTH #141](https://github.com/takatakca/takatak-v1/issues/141)). Reprendre le modèle de MIMT déjà construit :
   `signed_up → phone_verified → passkey_enrolled → full` (mimtcaapp PR #92).
4. **Clé d'accès (passkey)** : WebAuthn, pour que seuls les appareils du client puissent confirmer un achat. Supabase ne
   la fournit pas partout : vérifier l'offre actuelle avant de choisir ; sinon une bibliothèque WebAuthn côté serveur.
5. **Selfie (vérification d'identité)** : seulement si on en a vraiment besoin (fraude), et en option, jamais obligatoire
   pour acheter. Voir les règles au § 3. Fournisseur possible : Stripe Identity (document + selfie).
6. **Contrat signé à l'écran** : DocuSign ou Dropbox Sign (compte et clé API du propriétaire). Le contrat reprend les
   services, les prix, la durée, l'annulation. Copie signée envoyée au client et à TAKATAK.
7. **Suite d'offres** (style ClickFunnels) : après le paiement, une offre à la fois, liée à ce qui vient d'être acheté
   (site → hébergement → courriel pro → fiches locales → avis). Chaque offre a un bouton « Non merci » aussi visible que
   « Oui ». Rien n'est ajouté sans un clic du client. La chaîne existe déjà en partie (`src/lib/website/home-upsell.ts`).

## 3. Règles (Québec et Canada) à respecter

- **Consentement clair, une chose à la fois.** Pas de case cochée d'avance, pas de frais ajoutés sans clic, prix total
  avec TPS et TVQ avant de payer. Loi sur la protection du consommateur du Québec : contrat à distance, le client reçoit
  le contrat par écrit et peut annuler dans les délais prévus.
- **Pré-autorisation** : seulement un montant affiché et accepté ; on la libère si le service ne commence pas.
- **Selfie = donnée biométrique.** Au Québec, la Loi concernant le cadre juridique des technologies de l'information
  (art. 44-45) exige le consentement exprès de la personne et une **déclaration à la Commission d'accès à l'information
  au moins 60 jours avant** de mettre en service une vérification biométrique ou une banque de caractéristiques
  biométriques. La Loi 25 ajoute une évaluation des facteurs relatifs à la vie privée. Toujours offrir une autre méthode
  (téléphone + clé d'accès). **Ne pas lancer le selfie avant ces étapes.**
- **Courriels et textos de vente** : LCAP (loi anti-pourriel), consentement séparé, désabonnement dans chaque message.
- **L'IA dit qu'elle est une IA**, garde les prix du catalogue, et passe la main à une personne sur demande.
- **Aucun « 100 % d'autorisation » forcé** : la carte peut être refusée ; on propose un autre moyen ou un appel.

## 4. Ce que le propriétaire doit fournir

| Pour | Quoi |
| --- | --- |
| Stripe | Compte en mode réel, produits/prix alignés sur le catalogue, clés dans Coolify (`STRIPE_*`, déjà prévues) |
| Téléphone | Fournisseur SMS Twilio branché dans Supabase (issue #141) |
| Contrat | Compte DocuSign ou Dropbox Sign, modèle de contrat validé par un avocat |
| Selfie (optionnel) | Décision, déclaration à la CAI, évaluation Loi 25, fournisseur |
| Voix temps réel | Choix du fournisseur et budget par minute |

---

## English summary

Done: AI sales assistant beside the offers (type, talk, a person), sales-only answers (problems go to support), the
request form filled from the conversation and sent to the leads inbox, browser voice mode, TAK-TAK trial. Next, one PR
each, behind a switch: real-time voice, Stripe Checkout subscription with opt-in saved card and manual-capture
pre-authorization, phone OTP (issue #141, reuse MIMT's onboarding stages), passkeys, optional selfie check, e-signed
contract, one-offer-at-a-time upsell chain with an equally visible "No thanks". Biometric checks in Québec need express
consent, a CAI declaration 60 days before use and a privacy impact assessment, with another method always offered.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-01
