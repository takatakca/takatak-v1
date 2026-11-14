// Per-connection capability profile (pure, client-safe).
//
// Turns the facts TAKATAK actually stores about a social connection (status,
// granted scopes, token expiry, selected accounts, last error) into an honest
// profile: what the connection can do through TAKATAK today, what is missing,
// and what the owner must do to enable it. Labels are bilingual.
// Nothing here calls a provider; it describes stored state only.

export type CapabilityKey =
  | "identity"
  | "publish"
  | "schedule"
  | "analytics"
  | "inbox"
  | "media_video";

export type CapabilityState =
  | "available"
  | "missing_scope"
  | "needs_reconnect"
  | "needs_app_review"
  | "blocked_cost"
  | "not_built"
  | "unsupported";

export type CapabilityAction = "none" | "reconnect" | "select_account" | "takatak_roadmap" | "provider_review" | "owner_budget";

export type ConnectionCapability = {
  key: CapabilityKey;
  state: CapabilityState;
  requiredScopes: string[];
  missingScopes: string[];
  action: CapabilityAction;
  label: { en: string; fr: string };
  detail: { en: string; fr: string };
};

export type TokenHealth = "healthy" | "expiring_soon" | "expired" | "missing" | "error";

export type ConnectionCapabilityProfile = {
  provider: string;
  tokenHealth: TokenHealth;
  tokenExpiresAt: string | null;
  identityVerified: boolean;
  selectedAccountCount: number;
  capabilities: ConnectionCapability[];
  /** Union of scopes TAKATAK would need for everything buildable on this provider. */
  missingScopes: string[];
  reconnectRequired: boolean;
  summary: { en: string; fr: string };
};

export type CapabilityProfileInput = {
  provider: string;
  status: string;
  scopes: string[];
  hasCredential: boolean;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastErrorCode: string | null;
  externalSubjectId: string | null;
  accounts: Array<{
    platform: string;
    status: string;
    accessStatus: string;
    accountType: string | null;
    canPublish: boolean | null;
  }>;
  now: Date;
};

type Rule = {
  key: CapabilityKey;
  /** All of these scopes are required (when the provider uses scopes for it). */
  scopes: string[];
  /** Implementation status in TAKATAK, independent of scopes. */
  built: "yes" | "no" | "review" | "cost" | "unsupported";
  label: { en: string; fr: string };
  whenBuilt: { en: string; fr: string };
  whenMissing: { en: string; fr: string };
};

const L = (en: string, fr: string) => ({ en, fr });

const PUBLISH = L("Publishing", "Publication");
const SCHEDULE = L("Scheduling", "Planification");
const ANALYTICS = L("Analytics", "Statistiques");
const INBOX = L("Inbox & comments", "Boîte de réception et commentaires");
const VIDEO = L("Video upload", "Téléversement vidéo");

const ROADMAP = L("Not built in TAKATAK yet.", "Pas encore construit dans TAKATAK.");
const UNSUPPORTED = L("Not offered by the provider's official API.", "Non offert par l'API officielle du fournisseur.");

const RULES: Record<string, Rule[]> = {
  meta: [
    { key: "publish", scopes: ["pages_manage_posts"], built: "yes", label: PUBLISH, whenBuilt: L("Text, link and photo posts on the selected Page, verified with the Facebook post id.", "Publications texte, lien et photo sur la Page choisie, vérifiées avec l'identifiant Facebook."), whenMissing: L("Reconnect Facebook and grant publishing access (pages_manage_posts).", "Reconnectez Facebook et accordez l'accès de publication (pages_manage_posts).") },
    { key: "schedule", scopes: ["pages_manage_posts"], built: "yes", label: SCHEDULE, whenBuilt: L("TAKATAK's scheduler publishes approved posts at the chosen time.", "Le planificateur TAKATAK publie les publications approuvées à l'heure choisie."), whenMissing: L("Requires publishing access.", "Nécessite l'accès de publication.") },
    { key: "analytics", scopes: ["pages_read_engagement", "read_insights"], built: "yes", label: ANALYTICS, whenBuilt: L("Page insights and post performance sync daily.", "Les statistiques de la Page et des publications se synchronisent chaque jour."), whenMissing: L("Reconnect and grant insights access.", "Reconnectez et accordez l'accès aux statistiques.") },
    { key: "inbox", scopes: ["pages_manage_engagement"], built: "no", label: INBOX, whenBuilt: ROADMAP, whenMissing: L("Needs pages_manage_engagement and the TAKATAK inbox (planned).", "Nécessite pages_manage_engagement et la boîte de réception TAKATAK (prévue).") },
  ],
  instagram: [
    { key: "publish", scopes: ["instagram_business_content_publish"], built: "no", label: PUBLISH, whenBuilt: ROADMAP, whenMissing: L("Needs instagram_business_content_publish (incremental authorization) and the Instagram publishing adapter (next).", "Nécessite instagram_business_content_publish (autorisation incrémentale) et l'adaptateur de publication Instagram (prochaine étape).") },
    { key: "analytics", scopes: ["instagram_business_manage_insights"], built: "yes", label: ANALYTICS, whenBuilt: L("Account and media insights.", "Statistiques du compte et des médias."), whenMissing: L("Reconnect Instagram and grant insights.", "Reconnectez Instagram et accordez les statistiques.") },
    { key: "inbox", scopes: ["instagram_business_manage_messages", "instagram_business_manage_comments"], built: "no", label: INBOX, whenBuilt: ROADMAP, whenMissing: L("Needs messaging and comment permissions plus Meta app review.", "Nécessite les permissions de messages et commentaires et la revue d'application Meta.") },
  ],
  threads: [
    { key: "publish", scopes: ["threads_content_publish"], built: "no", label: PUBLISH, whenBuilt: ROADMAP, whenMissing: L("Needs threads_content_publish and the Threads adapter.", "Nécessite threads_content_publish et l'adaptateur Threads.") },
    { key: "analytics", scopes: ["threads_manage_insights"], built: "yes", label: ANALYTICS, whenBuilt: L("Threads insights.", "Statistiques Threads."), whenMissing: L("Reconnect Threads and grant insights.", "Reconnectez Threads et accordez les statistiques.") },
  ],
  google: [
    { key: "media_video", scopes: ["https://www.googleapis.com/auth/youtube.upload"], built: "no", label: VIDEO, whenBuilt: ROADMAP, whenMissing: L("Needs the youtube.upload scope (incremental authorization) and resumable upload (planned).", "Nécessite la portée youtube.upload (autorisation incrémentale) et le téléversement reprenable (prévu).") },
    { key: "analytics", scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"], built: "yes", label: ANALYTICS, whenBuilt: L("Channel and video analytics.", "Statistiques de la chaîne et des vidéos."), whenMissing: L("Reconnect YouTube and grant analytics.", "Reconnectez YouTube et accordez les statistiques.") },
  ],
  google_business: [
    { key: "publish", scopes: ["https://www.googleapis.com/auth/business.manage"], built: "no", label: L("Business posts", "Publications Google"), whenBuilt: ROADMAP, whenMissing: L("Local posts need the Business Profile posts adapter (planned).", "Les publications locales nécessitent l'adaptateur Business Profile (prévu).") },
    { key: "inbox", scopes: ["https://www.googleapis.com/auth/business.manage"], built: "yes", label: L("Review replies", "Réponses aux avis"), whenBuilt: L("Review replies publish through the Reputation workspace with a verified receipt.", "Les réponses aux avis se publient depuis l'espace Réputation avec un reçu vérifié."), whenMissing: L("Reconnect Google Business Profile.", "Reconnectez le profil Google Business.") },
    { key: "analytics", scopes: ["https://www.googleapis.com/auth/business.manage"], built: "yes", label: ANALYTICS, whenBuilt: L("Business Profile performance.", "Performance du profil d'entreprise."), whenMissing: L("Reconnect Google Business Profile.", "Reconnectez le profil Google Business.") },
  ],
  tiktok: [
    { key: "media_video", scopes: ["video.publish", "video.upload"], built: "review", label: VIDEO, whenBuilt: L("Direct video posting.", "Publication vidéo directe."), whenMissing: L("TikTok's Content Posting API needs the video.publish scope and TikTok's app audit; until approval, posts stay private.", "L'API de publication TikTok nécessite la portée video.publish et l'audit de l'application TikTok ; d'ici l'approbation, les publications restent privées.") },
    { key: "analytics", scopes: ["user.info.stats", "video.list"], built: "yes", label: ANALYTICS, whenBuilt: L("Profile and video statistics.", "Statistiques du profil et des vidéos."), whenMissing: L("Reconnect TikTok.", "Reconnectez TikTok.") },
  ],
  pinterest: [
    { key: "publish", scopes: ["pins:write", "boards:read"], built: "no", label: L("Pins", "Épingles"), whenBuilt: ROADMAP, whenMissing: L("Pin publishing adapter is planned; the scope is already granted.", "L'adaptateur de publication d'épingles est prévu ; la portée est déjà accordée.") },
    { key: "analytics", scopes: ["pins:read"], built: "no", label: ANALYTICS, whenBuilt: ROADMAP, whenMissing: ROADMAP },
  ],
  x: [
    { key: "publish", scopes: ["tweet.write"], built: "cost", label: PUBLISH, whenBuilt: L("Posting on X.", "Publication sur X."), whenMissing: L("X charges per request. Publishing stays off until the owner approves a budget (X_PAID_API_ENABLED) and grants tweet.write.", "X facture chaque requête. La publication reste désactivée jusqu'à ce que le propriétaire approuve un budget (X_PAID_API_ENABLED) et accorde tweet.write.") },
    { key: "analytics", scopes: ["tweet.read", "users.read"], built: "cost", label: ANALYTICS, whenBuilt: L("Profile and post reads.", "Lecture du profil et des publications."), whenMissing: L("Paid X reads are off until a budget is approved.", "Les lectures X payantes sont désactivées jusqu'à l'approbation d'un budget.") },
  ],
  bluesky: [
    { key: "publish", scopes: [], built: "no", label: PUBLISH, whenBuilt: ROADMAP, whenMissing: L("Bluesky posting needs no extra scope; the adapter is planned next (free, no app review).", "La publication Bluesky n'exige aucune portée supplémentaire ; l'adaptateur est prévu ensuite (gratuit, sans revue).") },
    { key: "analytics", scopes: [], built: "yes", label: ANALYTICS, whenBuilt: L("Profile statistics.", "Statistiques du profil."), whenMissing: L("Reconnect Bluesky.", "Reconnectez Bluesky.") },
  ],
  twitch: [
    { key: "publish", scopes: [], built: "unsupported", label: PUBLISH, whenBuilt: UNSUPPORTED, whenMissing: UNSUPPORTED },
    { key: "analytics", scopes: ["moderator:read:followers", "channel:read:subscriptions"], built: "yes", label: ANALYTICS, whenBuilt: L("Followers and subscriptions.", "Abonnés et abonnements."), whenMissing: L("Reconnect Twitch.", "Reconnectez Twitch.") },
  ],
  web: [{ key: "publish", scopes: [], built: "unsupported", label: PUBLISH, whenBuilt: UNSUPPORTED, whenMissing: L("A verified website is a traffic source, not a publishing target.", "Un site vérifié est une source de trafic, pas une destination de publication.") }],
  blog: [{ key: "publish", scopes: [], built: "unsupported", label: PUBLISH, whenBuilt: UNSUPPORTED, whenMissing: L("Blog connections are read-only.", "Les connexions de blogue sont en lecture seule.") }],
  meta_ads: [{ key: "analytics", scopes: ["ads_read"], built: "yes", label: L("Ads reporting", "Rapports publicitaires"), whenBuilt: L("Campaign insights.", "Statistiques des campagnes."), whenMissing: L("Reconnect Meta Ads.", "Reconnectez Meta Ads.") }],
  google_ads: [{ key: "analytics", scopes: [], built: "yes", label: L("Ads reporting", "Rapports publicitaires"), whenBuilt: L("Campaign reporting.", "Rapports de campagnes."), whenMissing: L("Reconnect Google Ads.", "Reconnectez Google Ads.") }],
  looker_studio: [{ key: "analytics", scopes: [], built: "yes", label: L("Reports", "Rapports"), whenBuilt: L("Linked Looker Studio report.", "Rapport Looker Studio lié."), whenMissing: L("Reconnect Looker Studio.", "Reconnectez Looker Studio.") }],
};

const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60_000;

export function assessTokenHealth(input: Pick<CapabilityProfileInput, "status" | "hasCredential" | "accessTokenExpiresAt" | "refreshTokenExpiresAt" | "lastErrorCode" | "now">): TokenHealth {
  if (input.status !== "connected") return input.lastErrorCode ? "error" : "missing";
  if (!input.hasCredential) return "missing";
  if (input.lastErrorCode) return "error";
  const expiry = input.accessTokenExpiresAt ? Date.parse(input.accessTokenExpiresAt) : NaN;
  const refresh = input.refreshTokenExpiresAt ? Date.parse(input.refreshTokenExpiresAt) : NaN;
  const now = input.now.getTime();
  if (Number.isFinite(expiry) && expiry <= now && !(Number.isFinite(refresh) && refresh > now)) return "expired";
  if (Number.isFinite(refresh) && refresh <= now) return "expired";
  if (Number.isFinite(expiry) && expiry - now < EXPIRING_WINDOW_MS && !(Number.isFinite(refresh) && refresh > now + EXPIRING_WINDOW_MS)) return "expiring_soon";
  return "healthy";
}

function hasScopes(granted: string[], required: string[]): boolean {
  return required.every((scope) => granted.includes(scope));
}

export function describeConnectionCapabilities(input: CapabilityProfileInput): ConnectionCapabilityProfile {
  const rules = RULES[input.provider] ?? [];
  const tokenHealth = assessTokenHealth(input);
  const connected = input.status === "connected" && input.hasCredential && tokenHealth !== "expired";
  const selected = input.accounts.filter((account) => account.status === "connected" && account.accessStatus === "selected");
  const identityVerified = Boolean(input.externalSubjectId) && input.status === "connected";
  const missing = new Set<string>();
  let reconnectRequired = tokenHealth === "expired" || tokenHealth === "error";

  const capabilities: ConnectionCapability[] = rules.map((rule) => {
    const missingScopes = rule.scopes.filter((scope) => !input.scopes.includes(scope));
    let state: CapabilityState;
    let action: CapabilityAction = "none";
    let detail = rule.whenMissing;

    if (rule.built === "unsupported") {
      state = "unsupported";
    } else if (rule.built === "cost") {
      state = "blocked_cost";
      action = "owner_budget";
    } else if (rule.built === "review") {
      state = "needs_app_review";
      action = "provider_review";
    } else if (rule.built === "no") {
      state = "not_built";
      action = "takatak_roadmap";
      missingScopes.forEach((scope) => missing.add(scope));
    } else if (!connected) {
      state = "needs_reconnect";
      action = "reconnect";
      reconnectRequired = true;
    } else if (!hasScopes(input.scopes, rule.scopes)) {
      state = "missing_scope";
      action = "reconnect";
      missingScopes.forEach((scope) => missing.add(scope));
      reconnectRequired = true;
    } else if ((rule.key === "publish" || rule.key === "schedule") && input.provider === "meta") {
      const page = selected.find((account) => account.platform === "facebook" && account.accountType === "facebook_page");
      if (!page) {
        state = "needs_reconnect";
        action = "select_account";
        detail = L("Select the Facebook Page to publish to.", "Choisissez la Page Facebook de destination.");
      } else if (page.canPublish === false) {
        state = "missing_scope";
        action = "reconnect";
        detail = L("This Page did not grant TAKATAK the CREATE_CONTENT task. Reconnect and allow publishing on the Page.", "Cette Page n'a pas accordé à TAKATAK la tâche CREATE_CONTENT. Reconnectez et autorisez la publication sur la Page.");
        reconnectRequired = true;
      } else {
        state = "available";
        detail = rule.whenBuilt;
      }
    } else {
      state = "available";
      detail = rule.whenBuilt;
    }

    return { key: rule.key, state, requiredScopes: rule.scopes, missingScopes, action, label: rule.label, detail };
  });

  const available = capabilities.filter((capability) => capability.state === "available").map((capability) => capability.label);
  const summary = !connected
    ? L("Not connected. Reconnect to use this account.", "Non connecté. Reconnectez pour utiliser ce compte.")
    : available.length
      ? L(`Ready: ${available.map((label) => label.en).join(", ")}.`, `Prêt : ${available.map((label) => label.fr).join(", ")}.`)
      : L("Connected for identity only.", "Connecté pour l'identité seulement.");

  return {
    provider: input.provider,
    tokenHealth,
    tokenExpiresAt: input.accessTokenExpiresAt,
    identityVerified,
    selectedAccountCount: selected.length,
    capabilities,
    missingScopes: [...missing],
    reconnectRequired,
    summary,
  };
}

export const CAPABILITY_STATE_LABELS: Record<CapabilityState, { en: string; fr: string }> = {
  available: L("Available", "Disponible"),
  missing_scope: L("Permission missing", "Permission manquante"),
  needs_reconnect: L("Reconnect", "Reconnexion requise"),
  needs_app_review: L("Provider review pending", "Revue du fournisseur en attente"),
  blocked_cost: L("Off (paid API)", "Désactivé (API payante)"),
  not_built: L("Coming to TAKATAK", "À venir dans TAKATAK"),
  unsupported: L("Not available", "Non disponible"),
};

export const TOKEN_HEALTH_LABELS: Record<TokenHealth, { en: string; fr: string }> = {
  healthy: L("Token healthy", "Jeton valide"),
  expiring_soon: L("Token expires within 7 days", "Jeton expire d'ici 7 jours"),
  expired: L("Token expired — reconnect", "Jeton expiré — reconnectez"),
  missing: L("No credential", "Aucun identifiant"),
  error: L("Last provider call failed", "Dernier appel au fournisseur échoué"),
};
