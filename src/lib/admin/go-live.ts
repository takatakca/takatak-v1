// Go-live checklist for the platform owner (/dashboard/admin/go-live).
// Each item is detected from the live server settings and production
// evidence; nothing here is a guess. The percentage only counts items that
// can be detected, and "who" says whether the owner or the TAKATAK team
// closes it. Setting names only, never values.
import { readAiStudioConfig } from "@/lib/ai/generation/config";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";

type Env = Record<string, string | undefined>;

export type GoLiveStatus = "done" | "partial" | "todo" | "manual";

export interface GoLiveItem {
  id: string;
  area: "sales" | "automation" | "ai" | "communication" | "providers" | "accounts";
  title: string;
  status: GoLiveStatus;
  /** What is true right now, in plain words. */
  now: string;
  /** What to do to close it. */
  howTo: string;
  /** Server settings involved (names only). */
  settings: string[];
  who: "owner" | "team";
}

export interface GoLiveFacts {
  databaseOk: boolean;
  /** Last successful automatic social sync, proof that scheduled tasks run. */
  lastAutomaticSyncAt: string | null;
  connectedEngines: number;
  totalEngines: number;
  anthropicConnected: boolean;
  now: number;
}

export const AREA_LABELS: Record<GoLiveItem["area"], string> = {
  sales: "Ventes · Sales",
  automation: "Automatisation · Automation",
  ai: "Intelligence artificielle · AI",
  communication: "Communication",
  providers: "Fournisseurs · Providers",
  accounts: "Comptes · Accounts",
};

const set = (env: Env, name: string) => Boolean(env[name]?.trim());
const DAY_MS = 24 * 60 * 60 * 1000;

export function goLiveChecklist(env: Env, facts: GoLiveFacts): GoLiveItem[] {
  const leads = readWebsiteLeadsConfig(env).enabled;
  const stripe = set(env, "STRIPE_SECRET_KEY");
  const studio = readAiStudioConfig(env);
  const cronSecret = set(env, "CRON_SECRET");
  const syncFresh = facts.lastAutomaticSyncAt !== null && facts.now - Date.parse(facts.lastAutomaticSyncAt) < DAY_MS;

  return [
    {
      id: "leads_intake",
      area: "sales",
      title: "Requests from the website reach you",
      status: leads ? "done" : "todo",
      now: leads
        ? "On: contact, project, order, transfer, hosting and TAK-TAK requests are recorded in your leads inbox."
        : "Off: every request from the website is refused (visitors are offered an email instead).",
      howTo: "In Coolify, set WEBSITE_LEADS_ENABLED to true and WEBSITE_LEADS_CLIENT_ID to the TAKATAK workspace ID (in the Drive note), then redeploy.",
      settings: ["WEBSITE_LEADS_ENABLED", "WEBSITE_LEADS_CLIENT_ID"],
      who: "owner",
    },
    {
      id: "leads_alert",
      area: "sales",
      title: "Email alert for each new request",
      status: set(env, "WEBSITE_LEADS_NOTIFY_EMAIL") ? "done" : "todo",
      now: set(env, "WEBSITE_LEADS_NOTIFY_EMAIL") ? "On." : "Off: new requests only appear in the dashboard.",
      howTo: "Set WEBSITE_LEADS_NOTIFY_EMAIL to the address that should receive each new request.",
      settings: ["WEBSITE_LEADS_NOTIFY_EMAIL"],
      who: "owner",
    },
    {
      id: "stripe",
      area: "sales",
      title: "Card payments (Stripe)",
      status: stripe ? "done" : "todo",
      now: stripe ? "A Stripe key is set." : "No Stripe key: no card payment can be taken.",
      howTo: "Set STRIPE_SECRET_KEY from the Stripe dashboard (Developers → API keys).",
      settings: ["STRIPE_SECRET_KEY"],
      who: "owner",
    },
    {
      id: "ai_credit_sales",
      area: "sales",
      title: "Clients can buy AI credits",
      status: env.AI_CREDITS_CHECKOUT_ENABLED === "true" && stripe && set(env, "STRIPE_AI_CREDITS_WEBHOOK_SECRET") ? "done" : "todo",
      now:
        env.AI_CREDITS_CHECKOUT_ENABLED === "true" && stripe
          ? set(env, "STRIPE_AI_CREDITS_WEBHOOK_SECRET")
            ? "On."
            : "Checkout is on, but without the webhook secret paid credits are never added."
          : "Off: credits can only be granted by you.",
      howTo:
        "In Stripe, add a webhook to https://takatak.ca/api/billing/ai-credits/webhook and copy its signing secret into STRIPE_AI_CREDITS_WEBHOOK_SECRET; then set AI_CREDITS_CHECKOUT_ENABLED to true.",
      settings: ["AI_CREDITS_CHECKOUT_ENABLED", "STRIPE_AI_CREDITS_WEBHOOK_SECRET"],
      who: "owner",
    },
    {
      id: "scheduled_tasks",
      area: "automation",
      title: "Scheduled tasks run (publishing, syncs, agents)",
      status: cronSecret && syncFresh ? "done" : cronSecret ? "partial" : "todo",
      now:
        cronSecret && syncFresh
          ? "Running: an automatic sync succeeded in the last 24 hours."
          : cronSecret
            ? "CRON_SECRET is set, but no automatic sync in the last 24 hours: the scheduler does not call the app yet."
            : "Off: production has no scheduler, so planned posts, syncs and agents never start on their own.",
      howTo:
        "In Coolify (Scheduled tasks), call with Authorization: Bearer $CRON_SECRET: every minute /api/cron/social-sync-jobs, every 15 minutes /api/cron/growth-agents and /api/cron/studio-agent, every hour /api/cron/growth-reviews-sync.",
      settings: ["CRON_SECRET"],
      who: "owner",
    },
    {
      id: "ai_engines",
      area: "ai",
      title: "AI engine keys",
      status: facts.connectedEngines >= facts.totalEngines ? "done" : facts.connectedEngines > 0 ? "partial" : "todo",
      now: `${facts.connectedEngines} of ${facts.totalEngines} TAK-TAK engines have a key.`,
      howTo: "Add the missing keys on Admin → AI provider keys (each key is tested there).",
      settings: [],
      who: "owner",
    },
    {
      id: "anthropic",
      area: "ai",
      title: "Claude (Anthropic) connected",
      status: facts.anthropicConnected ? "done" : "todo",
      now: facts.anthropicConnected ? "Connected." : "Missing: long-form writing and the Claude option are unavailable.",
      howTo: "Enter the Anthropic API key on Admin → AI provider keys, or set ANTHROPIC_API_KEY.",
      settings: ["ANTHROPIC_API_KEY"],
      who: "owner",
    },
    {
      id: "key_storage",
      area: "ai",
      title: "Keys can be saved from the dashboard",
      status: set(env, "GROWTH_TOKEN_ENCRYPTION_KEY_V1") ? "done" : "todo",
      now: set(env, "GROWTH_TOKEN_ENCRYPTION_KEY_V1") ? "On: keys are encrypted and stored." : "Off: keys can only come from server variables.",
      howTo: "Set GROWTH_TOKEN_ENCRYPTION_KEY_V1 to 32 random bytes in Base64 (generate once, keep it safe, never change it).",
      settings: ["GROWTH_TOKEN_ENCRYPTION_KEY_V1"],
      who: "owner",
    },
    {
      id: "ai_studio",
      area: "ai",
      title: "AI Studio writes drafts for clients",
      status: studio.enabled ? "done" : "todo",
      now: studio.enabled ? `On (${studio.provider}).` : "Off: clients see the team page instead of the generator.",
      howTo: "Set AI_STUDIO_GENERATION_ENABLED to true (the OpenAI key is already there; the model defaults to the one TAK-TAK uses). Optional: AI_STUDIO_PROVIDER=anthropic once the Claude key is in.",
      settings: ["AI_STUDIO_GENERATION_ENABLED"],
      who: "owner",
    },
    {
      id: "agents",
      area: "ai",
      title: "Autopilot agents can run",
      // Chat Concierge and Social Autopilot run natively on the connected engines;
      // they need connected engines and the scheduler (or the owner's "run now" button).
      status: facts.connectedEngines > 0 ? (cronSecret && syncFresh ? "done" : "partial") : "todo",
      now:
        facts.connectedEngines > 0
          ? cronSecret && syncFresh
            ? "Chat Concierge and Social Autopilot run on the connected engines every 15 minutes."
            : "Chat Concierge and Social Autopilot run on the connected engines when you press \"Run waiting agents now\" (AI Control Center); automatic runs start with the scheduler."
          : "No engine is connected, so no agent can run.",
      howTo: "Turn on the scheduler (item above). SMS, SEO, ads and report agents also need their own connections.",
      settings: ["CRON_SECRET"],
      who: "owner",
    },
    {
      id: "newsletter",
      area: "communication",
      title: "Newsletter sign-ups",
      status: set(env, "NEWSLETTER_TOKEN_SECRET") && set(env, "NEWSLETTER_SENDER_ADDRESS") && leads ? "done" : "todo",
      now:
        set(env, "NEWSLETTER_TOKEN_SECRET") && set(env, "NEWSLETTER_SENDER_ADDRESS")
          ? leads
            ? "On."
            : "Keys set, but sign-ups also need website requests switched on."
          : "Off: the sign-up form shows \"opening soon\".",
      howTo: "Set NEWSLETTER_TOKEN_SECRET (random, 32+ characters) and NEWSLETTER_SENDER_ADDRESS (the sending address), with website requests on.",
      settings: ["NEWSLETTER_TOKEN_SECRET", "NEWSLETTER_SENDER_ADDRESS"],
      who: "owner",
    },
    {
      id: "push",
      area: "communication",
      title: "Browser alerts for promotions",
      status: set(env, "PUSH_VAPID_PUBLIC_KEY") && set(env, "PUSH_VAPID_PRIVATE_KEY") ? "done" : "todo",
      now: set(env, "PUSH_VAPID_PUBLIC_KEY") && set(env, "PUSH_VAPID_PRIVATE_KEY") ? "On." : "Off.",
      howTo: "Generate one VAPID key pair (npx web-push generate-vapid-keys) and set both values.",
      settings: ["PUSH_VAPID_PUBLIC_KEY", "PUSH_VAPID_PRIVATE_KEY"],
      who: "owner",
    },
    {
      id: "upmind",
      area: "providers",
      title: "Domains and hosting (Upmind)",
      status: set(env, "UPMIND_API_BASE_URL") && (set(env, "UPMIND_API_KEY") || set(env, "UPMIND_KEY")) ? "done" : "todo",
      now: set(env, "UPMIND_API_BASE_URL") ? "Upmind settings present." : "Not connected: domains and hosting are handled by hand.",
      howTo: "Set UPMIND_API_BASE_URL and UPMIND_API_KEY from your Upmind account, then run the live test on Admin → Integrations → Upmind.",
      settings: ["UPMIND_API_BASE_URL", "UPMIND_API_KEY"],
      who: "owner",
    },
    {
      id: "qmaps",
      area: "providers",
      title: "Local listings (QMAPS)",
      status: set(env, "QMAPS_FUNCTIONS_BASE_URL") && set(env, "QMAPS_INTEGRATION_SECRET") ? "done" : "todo",
      now: set(env, "QMAPS_FUNCTIONS_BASE_URL") ? "QMAPS settings present." : "Not connected.",
      howTo: "Set QMAPS_FUNCTIONS_BASE_URL and QMAPS_INTEGRATION_SECRET (shared with the QMAPS app).",
      settings: ["QMAPS_FUNCTIONS_BASE_URL", "QMAPS_INTEGRATION_SECRET"],
      who: "owner",
    },
    {
      id: "google_business",
      area: "providers",
      title: "Google reviews (Google Business Profile)",
      status: set(env, "GOOGLE_BUSINESS_PROFILE_CLIENT_ID") && set(env, "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET") ? "done" : "todo",
      now: set(env, "GOOGLE_BUSINESS_PROFILE_CLIENT_ID") ? "Google Business settings present." : "Not connected: reviews cannot be imported or answered.",
      howTo: "Create a Google Cloud OAuth client with the Business Profile API and set its ID and secret.",
      settings: ["GOOGLE_BUSINESS_PROFILE_CLIENT_ID", "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"],
      who: "owner",
    },
    {
      id: "mimt",
      area: "providers",
      title: "Business phone (MIMT)",
      status: set(env, "MIMT_API_URL") && set(env, "MIMT_API_KEY") ? "done" : "todo",
      now: set(env, "MIMT_API_URL") ? "MIMT settings present." : "Not connected.",
      howTo: "Set MIMT_API_URL (https) and MIMT_API_KEY once the MIMT service is ready.",
      settings: ["MIMT_API_URL", "MIMT_API_KEY"],
      who: "owner",
    },
    {
      id: "database",
      area: "accounts",
      title: "Database and sign-in",
      status: facts.databaseOk && set(env, "NEXT_PUBLIC_SUPABASE_URL") ? "done" : "todo",
      now: facts.databaseOk ? "Database answers; sign-in is configured." : "The database does not answer.",
      howTo: "Check DATABASE_URL and the Supabase settings in Coolify.",
      settings: ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
      who: "owner",
    },
    {
      id: "auth_emails",
      area: "accounts",
      title: "Sign-in email and Google return address",
      status: "manual",
      now: "Cannot be read from here: the Magic Link email template and allowed return addresses live in Supabase.",
      howTo: "In Supabase → Authentication: fix the Magic Link template (link to /auth/callback) and allow https://takatak.ca/auth/callback.",
      settings: [],
      who: "owner",
    },
  ];
}

/** Share of detectable items that are done (a partial item counts for half). */
export function goLivePercent(items: GoLiveItem[]): number {
  const counted = items.filter((item) => item.status !== "manual");
  if (!counted.length) return 0;
  const score = counted.reduce((total, item) => total + (item.status === "done" ? 1 : item.status === "partial" ? 0.5 : 0), 0);
  return Math.round((score / counted.length) * 100);
}
