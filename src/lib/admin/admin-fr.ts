// French for the admin screens, keyed by the English text the server builds
// (go-live checklist, AI switches, system health, status labels, data source
// notes). A page shows adminFr(text, fr): French when the account reads
// French, the English text otherwise. Unknown text is shown unchanged.
// scripts/verify-admin-fr.ts checks that every text built here has French.

export const ADMIN_FR: Record<string, string> = {
  // Status labels (lib/admin/status.ts)
  Planned: "Planifiée",
  Queued: "En file",
  Running: "En cours",
  Completed: "Terminée",
  Failed: "Échec",
  Cancelled: "Annulée",
  Debug: "Débogage",
  Info: "Info",
  Warning: "Avertissement",
  Error: "Erreur",
  Received: "Reçu",
  Processed: "Traité",
  "Ignored (never processed)": "Ignoré (jamais traité)",
  Unread: "Non lue",
  Read: "Lue",
  Archived: "Archivée",
  Owner: "Propriétaire",
  Admin: "Administrateur",
  Manager: "Gestionnaire",
  Staff: "Personnel",
  Viewer: "Lecture seule",

  // Raw status and role values stored in the database (lowercase)
  active: "actif",
  inactive: "inactif",
  disabled: "désactivé",
  pending: "en attente",
  invited: "invité",
  suspended: "suspendu",
  archived: "archivé",
  cancelled: "annulé",
  canceled: "annulé",
  planned: "planifié",
  trial: "essai",
  trialing: "en essai",
  draft: "brouillon",
  paused: "en pause",
  past_due: "en retard de paiement",
  provisioning: "en activation",
  owner: "propriétaire",
  admin: "administrateur",
  manager: "gestionnaire",
  staff: "personnel",
  viewer: "lecture seule",
  member: "membre",
  // Synchronization event states (Rentauto, 1LV)
  PROCESSED: "TRAITÉ",
  FAILED: "ÉCHEC",
  RECEIVED: "REÇU",
  PENDING: "EN ATTENTE",
  IGNORED: "IGNORÉ",

  // Data source notes (lib/admin/*-data.ts)
  "Mock foundation data — database not connected yet.": "Données d’exemple : la base de données n’est pas encore branchée.",
  "Database — live foundation records (view only, no write actions active).":
    "Base de données : enregistrements réels (lecture seule, aucune modification active).",
  "Platform administration access is required.": "L’accès administrateur de la plateforme est requis.",
  "Data is temporarily unavailable.": "Les données sont temporairement indisponibles.",
  "The database is unavailable.": "La base de données est indisponible.",
  "Live database records": "Enregistrements réels de la base de données",
  "Platform users are temporarily unavailable.": "Les utilisateurs de la plateforme sont temporairement indisponibles.",
  "TAKATAK database unavailable": "Base de données TAKATAK indisponible",
  "TAKATAK master database": "Base de données maîtresse TAKATAK",

  "Live Rentauto operational data from the shared TAKATAK Supabase backend. Master-data projection remains isolated for CRM/reporting.":
    "Données d’exploitation Rentauto en direct, depuis le Supabase partagé de TAKATAK. La projection des données maîtresses reste à part pour le CRM et les rapports.",
  "Rentauto operational database is unavailable; projection metrics may still be visible.":
    "La base d’exploitation Rentauto est indisponible ; les chiffres de la projection peuvent rester visibles.",

  // System health (lib/admin/admin-data.ts)
  App: "Application",
  "Database env": "Variables de la base de données",
  "Supabase auth env": "Variables de connexion Supabase",
  Configured: "Configuré",
  "Not configured": "Non configuré",
  "Configured (untested)": "Configuré (non testé)",
  "Key present (unverified)": "Clé présente (non vérifiée)",
  "Disabled (flag off)": "Désactivé (interrupteur éteint)",

  // RENTAUTO.CA provisioning errors (lib/admin/rentauto-service-admin.ts)
  "The service provisioning database is unavailable.": "La base de données d’activation des services est indisponible.",
  "The selected workspace could not be found.": "L’espace client choisi est introuvable.",
  "Multiple Rentauto service records exist for this workspace. Resolve the duplicate records before changing access.":
    "Cet espace a plusieurs fiches de service Rentauto. Réglez les doublons avant de changer l’accès.",
  "Rentauto must be provisioned before it can be paused.": "Rentauto doit être activé avant de pouvoir être mis en pause.",
  "The selected workspace identifier is invalid.": "L’identifiant de l’espace choisi est invalide.",
  "The request body must be a JSON object.": "Le contenu de la demande doit être un objet JSON.",
  "Rentauto status must be pending_setup, active, or paused.": "L’état Rentauto doit être pending_setup, active ou paused.",
  "RENTAUTO.CA access could not be updated.": "L’accès RENTAUTO.CA n’a pas pu être mis à jour.",
  "RENTAUTO.CA access updated.": "Accès RENTAUTO.CA mis à jour.",
  pending_setup: "configuration en attente",

  // Invoice requests (lib/billing/invoices/request-policy.ts, source-apps.ts)
  "Pending review": "En attente de révision",
  "Sending to Facturations": "Envoi vers Facturations",
  "Draft created in Facturations": "Brouillon créé dans Facturations",
  "Failed — safe to retry": "Échec : on peut réessayer sans risque",
  "Rejected by Facturations — needs correction": "Refusée par Facturations : à corriger",
  "Draft may already exist — link it": "Le brouillon existe peut-être déjà : liez-le",
  "Manual (TAKATAK admin)": "Manuelle (admin TAKATAK)",
  "Web Hosting": "Hébergement web",

  // Metricool and Upmind (lib/integrations/metricool, upmind)
  "Configured — untested": "Configuré : non testé",
  Connected: "Branché",
  Disabled: "Désactivé",
  "Metricool credentials are not configured.": "Les identifiants Metricool ne sont pas configurés.",
  "Upmind credentials are not configured.": "Les identifiants Upmind ne sont pas configurés.",
  "Credentials and live test endpoint detected. Run a test connection to verify.":
    "Identifiants et point de test en direct détectés. Lancez un test de connexion pour vérifier.",
  "Credentials detected, live API test endpoint not confirmed.": "Identifiants détectés, point de test de l’API en direct non confirmé.",
  "Account listing is not implemented until the official Metricool endpoint is confirmed and a real credentialed call succeeds.":
    "La liste des comptes n’est pas offerte tant que le point d’accès officiel de Metricool n’est pas confirmé et qu’un vrai appel avec identifiants n’a pas réussi.",
  "Live Metricool API test succeeded.": "Le test en direct de l’API Metricool a réussi.",
  "Live Upmind API test succeeded.": "Le test en direct de l’API Upmind a réussi.",
  "Upmind credentials required.": "Identifiants Upmind requis.",
  "Upmind connection verified.": "Connexion Upmind vérifiée.",
  "Last Upmind test failed safely.": "Le dernier test Upmind a échoué sans risque.",
  "Upmind integration disabled.": "Intégration Upmind désactivée.",
  "Upmind webhooks are disabled (UPMIND_WEBHOOK_ENABLED is not true).": "Les webhooks Upmind sont désactivés (UPMIND_WEBHOOK_ENABLED n’est pas true).",
  "Webhook secret is not configured (UPMIND_WEBHOOK_SECRET missing).": "Le secret du webhook n’est pas configuré (UPMIND_WEBHOOK_SECRET manque).",
  "Webhook signature did not match.": "La signature du webhook ne correspond pas.",
  "Webhook signature verified.": "Signature du webhook vérifiée.",

  // AI provider categories (lib/ai-providers/catalog.ts)
  "Text and chat": "Texte et clavardage",
  Voice: "Voix",
  Video: "Vidéo",
  Images: "Images",
  Music: "Musique",
  "Team tools": "Outils d’équipe",

  // AI provider keys (lib/ai-providers/catalog.ts, store.ts, admin/ai-providers/actions.ts)
  "The provider accepted the key.": "Le fournisseur a accepté la clé.",
  "The provider refused the key. Check that it is correct and active.": "Le fournisseur a refusé la clé. Vérifiez qu’elle est exacte et active.",
  "The provider is rate limiting this key. Try the test again in a minute.":
    "Le fournisseur limite cette clé pour l’instant. Refaites le test dans une minute.",
  "The provider did not answer correctly. Try again later.": "Le fournisseur n’a pas répondu correctement. Réessayez plus tard.",
  "The provider could not be reached from the server.": "Le serveur n’a pas pu joindre le fournisseur.",
  "Only a signed-in platform owner or admin can change AI provider keys.":
    "Seul un propriétaire ou un administrateur connecté de la plateforme peut changer les clés des fournisseurs IA.",
  "Unknown AI provider.": "Fournisseur IA inconnu.",
  "Saved. Run the test to confirm the key works.": "Enregistrée. Lancez le test pour confirmer que la clé fonctionne.",
  "Saved.": "Enregistrée.",
  "Key removed.": "Clé retirée.",
  "No saved key to remove.": "Aucune clé enregistrée à retirer.",
  "The key could not be saved. Try again.": "La clé n’a pas pu être enregistrée. Réessayez.",
  "The test could not run. Try again.": "Le test n’a pas pu se faire. Réessayez.",
  "The key could not be removed. Try again.": "La clé n’a pas pu être retirée. Réessayez.",
  "The database is not available.": "La base de données n’est pas disponible.",
  "Key storage is not set up on this server (GROWTH_TOKEN_ENCRYPTION_KEY_V1).":
    "Le stockage des clés n’est pas prêt sur ce serveur (GROWTH_TOKEN_ENCRYPTION_KEY_V1).",
  "This provider has no automatic key check.": "Ce fournisseur n’a pas de test de clé automatique.",
  "Save a key for this provider first.": "Enregistrez d’abord une clé pour ce fournisseur.",
  "Paste the API key.": "Collez la clé API.",
  "The key has spaces or invalid characters. Copy it again.": "La clé contient des espaces ou des caractères invalides. Copiez-la de nouveau.",
  "Perplexity has no documented read-only endpoint to check a key.": "Perplexity n’a pas de point d’accès documenté en lecture seule pour tester une clé.",
  "Create the key at ollama.com/settings/keys. Cloud usage needs Ollama credits or a paid plan.":
    "Créez la clé sur ollama.com/settings/keys. L’usage infonuagique demande des crédits Ollama ou un forfait payant.",
  "Create the key at platform.kimi.ai (keys from platform.kimi.com do not work on this endpoint).":
    "Créez la clé sur platform.kimi.ai (les clés de platform.kimi.com ne fonctionnent pas sur ce point d’accès).",
  "Z.ai documents no read-only endpoint to check a key.": "Z.ai ne documente aucun point d’accès en lecture seule pour tester une clé.",
  "OpenRouter's model list is public, so it cannot prove a key works.": "La liste des modèles d’OpenRouter est publique, elle ne peut donc pas prouver qu’une clé fonctionne.",
  "Cerebras documents no read-only endpoint to check a key.": "Cerebras ne documente aucun point d’accès en lecture seule pour tester une clé.",
  "SambaNova's model list is public, so it cannot prove a key works.": "La liste des modèles de SambaNova est publique, elle ne peut donc pas prouver qu’une clé fonctionne.",
  "DeepInfra's model list is public, so it cannot prove a key works.": "La liste des modèles de DeepInfra est publique, elle ne peut donc pas prouver qu’une clé fonctionne.",
  "Video understanding and search.": "Compréhension et recherche dans les vidéos.",
  "Revid's API only exposes render calls, which spend credits, so the key is not checked automatically.":
    "L’API de Revid n’offre que des rendus, qui dépensent des crédits : la clé n’est donc pas testée automatiquement.",
  "Short-form video generation.": "Création de vidéos courtes.",
  "Video and image generation.": "Création de vidéos et d’images.",
  "Black Forest Labs documents no read-only endpoint to check a key.": "Black Forest Labs ne documente aucun point d’accès en lecture seule pour tester une clé.",
  "Image generation and editing.": "Création et retouche d’images.",
  "Ideogram documents no read-only endpoint to check a key.": "Ideogram ne documente aucun point d’accès en lecture seule pour tester une clé.",
  "Images with readable text (posters, menus, logos).": "Images avec du texte lisible (affiches, menus, logos).",
  "Deepgram expects the 'Token' scheme, which the automatic check does not send yet.":
    "Deepgram attend le format « Token », que le test automatique n’envoie pas encore.",
  "Transcription and text-to-speech.": "Transcription et synthèse vocale.",
  "AssemblyAI documents no read-only endpoint to check a key.": "AssemblyAI ne documente aucun point d’accès en lecture seule pour tester une clé.",
  "Transcription of calls, videos and meetings.": "Transcription d’appels, de vidéos et de réunions.",
  "Mureka's API docs could not be read automatically; confirm the key on platform.mureka.ai.":
    "La documentation de l’API Mureka n’a pas pu être lue automatiquement ; confirmez la clé sur platform.mureka.ai.",
  "Full songs with lyrics and vocals. ElevenLabs Music uses the ElevenLabs key; Stable Audio uses the Stability AI key.":
    "Chansons complètes avec paroles et voix. ElevenLabs Music utilise la clé ElevenLabs ; Stable Audio utilise la clé Stability AI.",
  "Suno has no public API yet (partner program only, July 2026).": "Suno n’a pas encore d’API publique (programme de partenaires seulement, juillet 2026).",
  "Kept for when Suno opens its API. Not billable until then.": "Gardé pour quand Suno ouvrira son API. Non facturable d’ici là.",
  "Lovable's API manages projects; it is a team tool, not a client AI service.":
    "L’API de Lovable gère des projets ; c’est un outil d’équipe, pas un service IA pour les clients.",
  "Team tool for building sites. Not resold as credits.": "Outil d’équipe pour bâtir des sites. Pas revendu en crédits.",
  "Cursor's API is for team agents and admin data, not a client AI service.":
    "L’API de Cursor sert aux agents de l’équipe et aux données d’administration, pas aux clients.",
  "Team coding tool. Not resold as credits.": "Outil de programmation de l’équipe. Pas revendu en crédits.",

  // Agents (lib/growth/ai-engine.ts)
  "Plans the week, writes one post per day, adapts it to every platform and queues it for approval.":
    "Planifie la semaine, écrit une publication par jour, l’adapte à chaque plateforme et la met en attente d’approbation.",
  "Drafts on-brand replies to every new review and escalates 1–3 star reviews to the owner first.":
    "Rédige une réponse fidèle à la marque pour chaque nouvel avis et envoie d’abord les avis de 1 à 3 étoiles au propriétaire.",
  "Sends review requests after each job or visit by SMS, WhatsApp or email and follows up once.":
    "Demande un avis après chaque travail ou visite, par texto, WhatsApp ou courriel, et relance une fois.",
  "Answers website chat, Messenger and WhatsApp questions 24/7 and books leads into the pipeline.":
    "Répond jour et nuit aux questions du clavardage du site, de Messenger et de WhatsApp, et inscrit les prospects dans le pipeline.",
  "Audits client sites weekly, flags regressions and writes a prioritized fix list.":
    "Vérifie les sites des clients chaque semaine, signale les reculs et écrit une liste de corrections par priorité.",
  "Watches spend and cost-per-lead, proposes budget shifts and fresh ad copy. Never spends without approval.":
    "Surveille les dépenses et le coût par prospect, propose des changements de budget et de nouveaux textes d’annonce. Ne dépense jamais sans approbation.",
  "Turns the month's numbers into a plain-language client report with next steps.":
    "Transforme les chiffres du mois en rapport client en langage simple, avec les prochaines étapes.",

  // AI switches (lib/admin/ai-control.ts)
  "AI Studio content generator": "Générateur de contenu AI Studio",
  "AI Studio live generation is off.": "La génération en direct d’AI Studio est éteinte.",
  "AI Studio generation is on, but its provider has no key.": "La génération AI Studio est allumée, mais son fournisseur n’a pas de clé.",
  "AI Studio generation is on, but no valid model is set.": "La génération AI Studio est allumée, mais aucun modèle valide n’est réglé.",
  "AI Studio generation names an unknown provider.": "La génération AI Studio nomme un fournisseur inconnu.",
  "Off.": "Éteint.",
  "TAK-TAK free trial": "Essai gratuit TAK-TAK",
  "Off: new visitors cannot try TAK-TAK for free.": "Éteint : les nouveaux visiteurs ne peuvent pas essayer TAK-TAK gratuitement.",
  "Selling AI credits (card checkout)": "Vente de crédits IA (paiement par carte)",
  "On: clients can buy credit packs by card.": "Allumé : les clients peuvent acheter des forfaits de crédits par carte.",
  "Off: clients cannot buy AI credits; only credits you grant can be used.":
    "Éteint : les clients ne peuvent pas acheter de crédits IA ; seuls les crédits que vous accordez sont utilisables.",
  "External AI Gateway (optional)": "Passerelle IA externe (facultative)",
  "Configured: the gateway runs every agent.": "Configurée : la passerelle fait tourner tous les agents.",
  "Not configured (optional): Chat Concierge and Social Autopilot run here on the connected engines; SMS, SEO, ads and report agents wait for the gateway.":
    "Non configurée (facultative) : Chat Concierge et Social Autopilot tournent ici sur les moteurs branchés ; les agents texto, SEO, publicité et rapports attendent la passerelle.",
  "Saving provider keys from the dashboard": "Enregistrer les clés des fournisseurs depuis le tableau de bord",
  "On: keys entered on the provider keys screen are encrypted and stored.":
    "Allumé : les clés saisies sur l’écran des clés des fournisseurs sont chiffrées et enregistrées.",
  "Off: keys can only come from server variables.": "Éteint : les clés ne peuvent venir que des variables du serveur.",

  // Run waiting agents (app/dashboard/admin/ai/actions.ts)
  "Only a signed-in platform owner or admin can run agents.":
    "Seul un propriétaire ou un administrateur connecté de la plateforme peut lancer les agents.",
  "The AI Gateway is configured: it runs the agents.": "La passerelle IA est configurée : c’est elle qui fait tourner les agents.",
  "No agent run was waiting.": "Aucun passage d’agent n’était en attente.",
  "The runs could not be processed. Try again in a minute.": "Les passages n’ont pas pu être traités. Réessayez dans une minute.",

  // Go-live checklist (lib/admin/go-live.ts)
  "Requests from the website reach you": "Les demandes du site vous parviennent",
  "On: contact, project, order, transfer, hosting and TAK-TAK requests are recorded in your leads inbox.":
    "Allumé : les demandes de contact, de projet, de commande, de transfert, d’hébergement et de TAK-TAK sont inscrites dans votre boîte des prospects.",
  "Off: every request from the website is refused (visitors are offered an email instead).":
    "Éteint : toutes les demandes du site sont refusées (on propose plutôt un courriel aux visiteurs).",
  "In Coolify, set WEBSITE_LEADS_ENABLED to true and WEBSITE_LEADS_CLIENT_ID to the TAKATAK workspace ID (in the Drive note), then redeploy.":
    "Dans Coolify, mettez WEBSITE_LEADS_ENABLED à true et WEBSITE_LEADS_CLIENT_ID à l’identifiant de l’espace TAKATAK (dans la note Drive), puis redéployez.",
  "Email alert for each new request": "Alerte par courriel à chaque nouvelle demande",
  "On.": "Allumé.",
  "Off: new requests only appear in the dashboard.": "Éteint : les nouvelles demandes apparaissent seulement dans le tableau de bord.",
  "Set WEBSITE_LEADS_NOTIFY_EMAIL to the address that should receive each new request.":
    "Mettez dans WEBSITE_LEADS_NOTIFY_EMAIL l’adresse qui doit recevoir chaque nouvelle demande.",
  "Card payments (Stripe)": "Paiements par carte (Stripe)",
  "A Stripe key is set.": "Une clé Stripe est réglée.",
  "No Stripe key: no card payment can be taken.": "Aucune clé Stripe : aucun paiement par carte n’est possible.",
  "Set STRIPE_SECRET_KEY from the Stripe dashboard (Developers → API keys).":
    "Réglez STRIPE_SECRET_KEY depuis le tableau de bord Stripe (Développeurs → Clés API).",
  "Clients can buy AI credits": "Les clients peuvent acheter des crédits IA",
  "Checkout is on, but without the webhook secret paid credits are never added.":
    "Le paiement est allumé, mais sans le secret du webhook les crédits payés ne sont jamais ajoutés.",
  "Off: credits can only be granted by you.": "Éteint : seuls vous pouvez accorder des crédits.",
  "In Stripe, add a webhook to https://takatak.ca/api/billing/ai-credits/webhook and copy its signing secret into STRIPE_AI_CREDITS_WEBHOOK_SECRET; then set AI_CREDITS_CHECKOUT_ENABLED to true.":
    "Dans Stripe, ajoutez un webhook vers https://takatak.ca/api/billing/ai-credits/webhook et copiez son secret de signature dans STRIPE_AI_CREDITS_WEBHOOK_SECRET ; puis mettez AI_CREDITS_CHECKOUT_ENABLED à true.",
  "Scheduled tasks run (publishing, syncs, agents)": "Les tâches planifiées tournent (publications, synchronisations, agents)",
  "Running: an automatic sync succeeded in the last 24 hours.":
    "En marche : une synchronisation automatique a réussi dans les dernières 24 heures.",
  "CRON_SECRET is set, but no automatic sync in the last 24 hours: the scheduler does not call the app yet.":
    "CRON_SECRET est réglé, mais aucune synchronisation automatique dans les dernières 24 heures : le planificateur n’appelle pas encore l’application.",
  "Off: production has no scheduler, so planned posts, syncs and agents never start on their own.":
    "Éteint : la production n’a pas de planificateur, donc les publications planifiées, les synchronisations et les agents ne démarrent jamais seuls.",
  'Simplest: put the same random value in CRON_SECRET (Coolify) and in the GitHub repository secret CRON_SECRET; the "TAKATAK production scheduler" workflow then calls every scheduled route each 15 minutes. Or use Coolify scheduled tasks with Authorization: Bearer $CRON_SECRET.':
    "Le plus simple : mettez la même valeur au hasard dans CRON_SECRET (Coolify) et dans le secret CRON_SECRET du dépôt GitHub ; le flux « TAKATAK production scheduler » appelle alors chaque route planifiée toutes les 15 minutes. Ou utilisez les tâches planifiées de Coolify avec Authorization: Bearer $CRON_SECRET.",
  "AI engine keys": "Clés des moteurs IA",
  "Add the missing keys on Admin → AI provider keys (each key is tested there).":
    "Ajoutez les clés manquantes dans Admin → Clés des fournisseurs IA (chaque clé y est testée).",
  "Claude (Anthropic) connected": "Claude (Anthropic) branché",
  "Connected.": "Branché.",
  "Missing: long-form writing and the Claude option are unavailable.": "Manquant : l’écriture de longs textes et l’option Claude sont indisponibles.",
  "Enter the Anthropic API key on Admin → AI provider keys, or set ANTHROPIC_API_KEY.":
    "Saisissez la clé API Anthropic dans Admin → Clés des fournisseurs IA, ou réglez ANTHROPIC_API_KEY.",
  "Keys can be saved from the dashboard": "Les clés peuvent être enregistrées depuis le tableau de bord",
  "On: keys are encrypted and stored.": "Allumé : les clés sont chiffrées et enregistrées.",
  "Set GROWTH_TOKEN_ENCRYPTION_KEY_V1 to 32 random bytes in Base64 (generate once, keep it safe, never change it).":
    "Mettez dans GROWTH_TOKEN_ENCRYPTION_KEY_V1 32 octets au hasard en Base64 (générez-la une fois, gardez-la en sûreté, ne la changez jamais).",
  "AI Studio writes drafts for clients": "AI Studio rédige des brouillons pour les clients",
  "On through the TAK-TAK engines: clients pay AI credits per draft.":
    "Allumé grâce aux moteurs TAK-TAK : les clients paient des crédits IA par brouillon.",
  "Off: no engine is connected, so clients see the team page instead of the generator.":
    "Éteint : aucun moteur n’est branché, donc les clients voient la page de l’équipe au lieu du générateur.",
  "Nothing to do while a TAK-TAK engine is connected. Optional: AI_STUDIO_GENERATION_ENABLED=true runs drafts on the OpenAI key with no credits used.":
    "Rien à faire tant qu’un moteur TAK-TAK est branché. Facultatif : AI_STUDIO_GENERATION_ENABLED=true rédige les brouillons avec la clé OpenAI, sans utiliser de crédits.",
  "Autopilot agents can run": "Les agents autopilote peuvent tourner",
  "Chat Concierge and Social Autopilot run on the connected engines every 15 minutes.":
    "Chat Concierge et Social Autopilot tournent sur les moteurs branchés toutes les 15 minutes.",
  'Chat Concierge and Social Autopilot run on the connected engines when you press "Run waiting agents now" (AI Control Center); automatic runs start with the scheduler.':
    "Chat Concierge et Social Autopilot tournent sur les moteurs branchés quand vous appuyez sur « Lancer les agents en attente » (Centre de contrôle IA) ; les passages automatiques démarrent avec le planificateur.",
  "No engine is connected, so no agent can run.": "Aucun moteur n’est branché, donc aucun agent ne peut tourner.",
  "Turn on the scheduler (item above). SMS, SEO, ads and report agents also need their own connections.":
    "Allumez le planificateur (point ci-dessus). Les agents texto, SEO, publicité et rapports ont aussi besoin de leurs propres branchements.",
  "Newsletter sign-ups": "Inscriptions à l’infolettre",
  "Keys set, but sign-ups also need website requests switched on.":
    "Clés réglées, mais les inscriptions ont aussi besoin que les demandes du site soient allumées.",
  'Off: the sign-up form shows "opening soon".': "Éteint : le formulaire d’inscription affiche « ouverture bientôt ».",
  "Set NEWSLETTER_TOKEN_SECRET (random, 32+ characters) and NEWSLETTER_SENDER_ADDRESS (the sending address), with website requests on.":
    "Réglez NEWSLETTER_TOKEN_SECRET (au hasard, 32 caractères ou plus) et NEWSLETTER_SENDER_ADDRESS (l’adresse d’envoi), avec les demandes du site allumées.",
  "Browser alerts for promotions": "Alertes du navigateur pour les promotions",
  "Generate one VAPID key pair (npx web-push generate-vapid-keys) and set both values.":
    "Générez une paire de clés VAPID (npx web-push generate-vapid-keys) et réglez les deux valeurs.",
  "Domains and hosting (Upmind)": "Domaines et hébergement (Upmind)",
  "Upmind settings present.": "Réglages Upmind présents.",
  "Not connected: domains and hosting are handled by hand.": "Non branché : les domaines et l’hébergement se font à la main.",
  "Set UPMIND_API_BASE_URL and UPMIND_API_KEY from your Upmind account, then run the live test on Admin → Integrations → Upmind.":
    "Réglez UPMIND_API_BASE_URL et UPMIND_API_KEY depuis votre compte Upmind, puis lancez le test en direct dans Admin → Intégrations → Upmind.",
  "Local listings (QMAPS)": "Fiches locales (QMAPS)",
  "QMAPS settings present.": "Réglages QMAPS présents.",
  "Not connected.": "Non branché.",
  "Set QMAPS_FUNCTIONS_BASE_URL and QMAPS_INTEGRATION_SECRET (shared with the QMAPS app).":
    "Réglez QMAPS_FUNCTIONS_BASE_URL et QMAPS_INTEGRATION_SECRET (partagés avec l’application QMAPS).",
  "Google reviews (Google Business Profile)": "Avis Google (Google Business Profile)",
  "Google Business settings present.": "Réglages Google Business présents.",
  "Not connected: reviews cannot be imported or answered.": "Non branché : les avis ne peuvent être ni importés ni répondus.",
  "Create a Google Cloud OAuth client with the Business Profile API and set its ID and secret.":
    "Créez un client OAuth Google Cloud avec l’API Business Profile et réglez son identifiant et son secret.",
  "Business phone (MIMT)": "Téléphone d’affaires (MIMT)",
  "MIMT settings present.": "Réglages MIMT présents.",
  "Set MIMT_API_URL (https) and MIMT_API_KEY once the MIMT service is ready.":
    "Réglez MIMT_API_URL (https) et MIMT_API_KEY quand le service MIMT sera prêt.",
  "Database and sign-in": "Base de données et connexion",
  "Database answers; sign-in is configured.": "La base de données répond ; la connexion est configurée.",
  "The database does not answer.": "La base de données ne répond pas.",
  "Check DATABASE_URL and the Supabase settings in Coolify.": "Vérifiez DATABASE_URL et les réglages Supabase dans Coolify.",
  "Sign-in email and Google return address": "Courriel de connexion et adresse de retour Google",
  "Cannot be read from here: the Magic Link email template and allowed return addresses live in Supabase.":
    "Impossible à lire d’ici : le modèle de courriel Magic Link et les adresses de retour permises se trouvent dans Supabase.",
  "In Supabase → Authentication: fix the Magic Link template (link to /auth/callback) and allow https://takatak.ca/auth/callback.":
    "Dans Supabase → Authentication : corrigez le modèle Magic Link (lien vers /auth/callback) et permettez https://takatak.ca/auth/callback.",
};

// Text the server builds with numbers or names in it.
const ADMIN_FR_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(Metricool|Upmind) credentials are not configured\. Missing: (.+)\.$/, (m) => `Les identifiants ${m[1]} ne sont pas configurés. Manquant : ${m[2]}.`],
  [/^Live (Metricool|Upmind) API test failed with HTTP (\d+)\. Verify the endpoint and credentials\.$/, (m) => `Le test en direct de l’API ${m[1]} a échoué avec HTTP ${m[2]}. Vérifiez le point d’accès et les identifiants.`],
  [/^Live (Metricool|Upmind) API test failed safely: ([\s\S]*)$/, (m) => `Le test en direct de l’API ${m[1]} a échoué sans risque : ${m[2]}`],
  [
    /^RENTAUTO\.CA access is now (\w+) for (.+)\.$/,
    (m) => `L’accès RENTAUTO.CA est maintenant « ${ADMIN_FR[m[1]] ?? m[1]} » pour ${m[2]}.`,
  ],
  [
    /^RENTAUTO\.CA access was already (\w+) for (.+)\.$/,
    (m) => `L’accès RENTAUTO.CA était déjà « ${ADMIN_FR[m[1]] ?? m[1]} » pour ${m[2]}.`,
  ],
  [/^An API key is (\d+) to (\d+) characters\.$/, (m) => `Une clé API compte de ${m[1]} à ${m[2]} caractères.`],
  [/^(\d+) run\(s\) processed\. (.*)$/, (m) => `${m[1]} passage(s) traité(s). ${m[2]}`],
  [/^(\d+) of (\d+) TAK-TAK engines have a key\.$/, (m) => `${m[1]} des ${m[2]} moteurs TAK-TAK ont une clé.`],
  [/^On \((.+), no credits used\)\.$/, (m) => `Allumé (${m[1]}, sans utiliser de crédits).`],
  [
    /^On through the TAK-TAK engines \((.+) first\): (\d+) AI credits per draft, refunded on failure\. Setting AI_STUDIO_GENERATION_ENABLED runs it on a provider key without credits instead\.$/,
    (m) =>
      `Allumé grâce aux moteurs TAK-TAK (${m[1]} d’abord) : ${m[2]} crédits IA par brouillon, remboursés en cas d’échec. Régler AI_STUDIO_GENERATION_ENABLED le fait plutôt tourner sur une clé de fournisseur, sans crédits.`,
  ],
  [/^On: (.+) · (.+) · up to (\d+) drafts per workspace per day\.$/, (m) => `Allumé : ${m[1]} · ${m[2]} · jusqu’à ${m[3]} brouillons par espace par jour.`],
  [
    /^On: (\d+) free credits per new workspace, on (.+)\.$/,
    (m) => `Allumé : ${m[1]} crédits gratuits par nouvel espace, sur ${m[2] === "the trial engine" ? "le moteur d’essai" : m[2]}.`,
  ],
];

/** French for a text built on the server when `fr`; the text itself otherwise. */
export function adminFr(text: string, fr: boolean): string {
  if (!fr) return text;
  const exact = ADMIN_FR[text];
  if (exact) return exact;
  for (const [pattern, build] of ADMIN_FR_PATTERNS) {
    const match = text.match(pattern);
    if (match) return build(match);
  }
  return text;
}
