# TAKATAK AUTH — passation #141, 2026-10-08

Branche : `codex/141-phone-only-auth`. Point de départ : `9a0a74d`.
Périmètre : première correction du parcours téléphone dans le dépôt existant. **P0 non terminé, aucune mise en production.** Continuer cette branche; ne pas dupliquer la tâche. Les PR #140 et #143 restent les références MIMT. Ne pas modifier leurs branches.

## Réalisé

- `Profile.email` devient nullable avec maintien de l'index unique. Aucun faux courriel et aucune modification des données dans la migration.
- Inscription SMS : retrait du courriel obligatoire et de sa copie dans les métadonnées.
- Synchronisation : seuls les contacts confirmés par Supabase sont utilisables. Les métadonnées ne prouvent ni coordonnées ni permissions. Une seule transaction sérialisable couvre profil, MasterIdentity, espace personnel, abonnement initial bloqué et audit. Les erreurs de concurrence sont réessayées au maximum trois fois; aucun raccourci de succès après une erreur d'unicité.
- Une identité historique trouvée seulement par téléphone/courriel n'est pas automatiquement rattachée. Un compte désactivé est refusé. Une identité déjà liée au même UUID Supabase est conservée.
- Adaptation des écrans, invitations, audit et types dépendants au courriel absent. Les chaînes vides servent seulement aux formulaires/DTO d'affichage; elles ne sont pas persistées comme identifiants. Upmind reste limité à son intégration existante et n'est pas ajouté à MIMT; sa création de client exige un courriel et ne bloque pas l'authentification téléphone.
- Paramètres de compte : suppression de `admin.updateUserById(... email_confirm: true)`. Demande de changement par session Supabase, confirmation préalable, puis synchronisation du contact confirmé. Le callback existant prend déjà en charge `email_change`.
- Le rapport de prévalidation distingue variables présentes et preuve de fonctionnement Supabase, SMS, email, profil et télécom. Le mode de connexion reste email par défaut jusqu'à la preuve SMS en staging demandée par #141.

## Validation et limites

Tests locaux : TypeScript; suites auth OTP/session/frontend/cookies/deployment; isolation d'identité; matrice d'accès; nouveaux tests de synchronisation avec double transactionnel. Ces tests ne prouvent pas une livraison SMS, une migration PostgreSQL réelle ou une connexion navigateur complète.

Aucune variable Supabase, Twilio ou DATABASE_URL n'était fournie dans cet environnement. Aucun réglage fournisseur n'a été lu par ces tests. Aucun appel/SMS de test envoyé. Ne pas déduire que le compte Twilio ou le fournisseur Supabase est absent : **statut non vérifié**.

Environnement local Node 24; projet et CI attendent Node 22. Exécution des scripts TypeScript avec `node --import tsx --require ./scripts/register-server-only.cjs` : le CLI `tsx` ne peut pas ouvrir son socket IPC dans cet environnement.

## Migration, staging et retour arrière

Migration : `20261008120000_phone_only_profiles`. Ne figure pas dans une liste d'approbation de déploiement ajoutée par cette PR. Ne pas appliquer sur production.

1. Sur staging identifié explicitement : sauvegarde et inventaire des migrations, doublons et dépendances de `profiles.email`. Appliquer par le workflow gardé du dépôt après examen. Vérifier deux profils sans courriel, conservation des emails existants et rejet d'un email dupliqué.
2. Déployer le code compatible avec NULL. Vérifier confirmations email activées et Secure Email Change, URL callback autorisée, ainsi que le fournisseur exact Twilio ou Twilio Verify **dans Supabase Auth**. Les secrets Twilio directs du serveur ne prouvent pas ce réglage.
3. Deux appareils canadiens, deux locataires : inscription téléphone, codes valide/invalide/expiré, renvoi et limites, reconnexion/logout, même MasterIdentity, session expirée/renouvelée, aucun accès à l'autre locataire, collision, désactivation, panne SMS et secours email réellement vérifié.
4. Ajout de courriel : aucune écriture du nouveau contact dans Profile/MasterIdentity avant confirmation; confirmer par callback puis vérifier même UUID et même MasterIdentity. Tester aussi un changement depuis un email existant et la confirmation sur autre appareil.
5. Simuler concurrence/échec transactionnel sur PostgreSQL réel et confirmer absence de profil/espace/abonnement partiel. Enregistrer uniquement références de preuves et identifiants masqués.
6. Après tous les tests : changement phone-first dans une révision de cette PR, CI verte, approbation finale de publication selon #141.

Retour arrière : désactiver temporairement les nouvelles inscriptions SMS et conserver une version compatible NULL pour les comptes téléphone déjà créés. Ne pas rétablir l'ancien binaire exigeant un courriel pour ces comptes. Ne restaurer NOT NULL que si `SELECT count(*) FROM profiles WHERE email IS NULL` vaut zéro et après revue; ne jamais fabriquer d'email ou supprimer des comptes pour permettre un rollback. La migration additive peut rester en place. Restaurer les réglages fournisseur sauvegardés si leur changement a causé la panne.

## À poursuivre dans la même tâche

- Preuves staging/fournisseurs ci-dessus, état CI et build de la révision finale.
- Récupération supervisée pour compte téléphone sans email en cas de perte du numéro; aucun contournement OTP. Fonctionnement opérationnel à valider avant ouverture publique.
- Audit complet des flux de sessions et consommation de l'identité centrale après changement de coordonnées. Ne pas considérer un ancien contact conservé par un système dérivé comme une nouvelle preuve d'identité.
- Assertions interapplications à audience limitée et revue CRM/SourceProfile : aucun endpoint, droit ou ingestion supplémentaire n'est introduit ici. Tests d'intégration des autorisations, consentement/base légale, rétention, retrait et export **encore requis**. Les suites d'isolation existantes ne constituent pas cette validation complète.
- Distinguer clients/contrats/leads propres à TAKATAK des abonnés privés des produits indépendants. Aucun transfert de conversations ou base client entière.
- Vérifier la configuration réelle email/Supabase/Twilio et secrets staging par canal sécurisé; ne pas les coller dans une issue ou un commit.

Références techniques consultées : https://supabase.com/docs/reference/javascript/auth-updateuser et https://supabase.com/docs/guides/auth/phone-login. Aucune déclaration d'activation télécom, conformité 911, achat ou contrat fournisseur.
