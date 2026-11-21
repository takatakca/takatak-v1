// Prompts for the native agent runner. Pure functions, so they are tested
// without a database. Every prompt forbids inventing facts, prices or
// promotions: the business's own instructions, the run's input and the facts
// the runner measured (report numbers, site checks) are the only sources.

export const NATIVE_AGENT_KEYS = new Set(["chat_concierge", "social_autopilot", "report_writer", "seo_watchdog"] as const);
export type NativeAgentKey = "chat_concierge" | "social_autopilot" | "report_writer" | "seo_watchdog";

export function isNativeAgent(key: string): key is NativeAgentKey {
  return (NATIVE_AGENT_KEYS as Set<string>).has(key);
}

/** TAK-TAK mode used for each agent. */
export function nativeMode(agentKey: NativeAgentKey): "chat" | "write" | "research" {
  if (agentKey === "chat_concierge") return "chat";
  if (agentKey === "seo_watchdog") return "research";
  return "write";
}

/**
 * Credit action billed for one run when it differs from the mode's default, so
 * the receipt names the task and the price is the one in the published table.
 */
export function nativeActionKey(agentKey: NativeAgentKey): string | undefined {
  return agentKey === "report_writer" ? "monthly_report_summary" : undefined;
}

/** One-line summary shown on the approval card, French first. */
export function nativeSummary(agentKey: NativeAgentKey): string {
  switch (agentKey) {
    case "chat_concierge":
      return "Réponse au clavardage prête à relire · Chat reply ready for review";
    case "social_autopilot":
      return "Publications de la semaine prêtes à relire · This week's posts ready for review";
    case "report_writer":
      return "Résumé du rapport mensuel prêt à relire · Monthly report summary ready for review";
    case "seo_watchdog":
      return "Liste de correctifs SEO prête à relire · SEO fix list ready for review";
  }
}

const clip = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const RULES =
  "Rules: use only facts given here or in the business instructions. Never invent prices, hours, availability, promotions, discounts or reviews. If a fact is missing, say a team member will confirm it.";

const NUMBER_RULES =
  "Use only the numbers listed above, exactly as written. Never invent a number, a percentage or a cause. When a number is 0, say no activity was recorded instead of guessing why.";

/** The month numbers the Report Writer may use. */
export interface ReportFacts {
  monthLabel: string;
  monthToDate: boolean;
  current: ReportFactNumbers;
  previous: ReportFactNumbers;
}

export interface ReportFactNumbers {
  visits: number;
  pageviews: number;
  conversions: number;
  leads: number;
  ratings: number;
  averageRating: number | null;
  requestsSent: number;
  conversations: number;
  aiRunsCompleted: number;
}

export function reportFactLines(facts: ReportFacts): string[] {
  const { current: c, previous: p } = facts;
  const pair = (label: string, now: number, before: number) => `- ${label}: ${now} (previous month: ${before})`;
  const lines = [
    `Period: ${clip(facts.monthLabel, 40)}${facts.monthToDate ? " (month to date, not finished)" : ""}`,
    pair("Website visits", c.visits, p.visits),
    pair("Pages viewed", c.pageviews, p.pageviews),
    pair("Contact actions (calls, forms, WhatsApp)", c.conversions, p.conversions),
    pair("New leads", c.leads, p.leads),
    pair("New customer ratings", c.ratings, p.ratings),
  ];
  if (c.averageRating !== null) lines.push(`- Average rating this period: ${c.averageRating.toFixed(1)} / 5`);
  lines.push(
    pair("Review requests sent", c.requestsSent, p.requestsSent),
    pair("Chat conversations", c.conversations, p.conversations),
    pair("Tasks done by AI agents", c.aiRunsCompleted, p.aiRunsCompleted),
  );
  return lines;
}

/** One website the SEO Watchdog checked on this run. */
export interface SiteCheckFacts {
  url: string;
  score: number;
  previousScore: number | null;
  issues: Array<{ label: string; status: "warn" | "fail"; detail: string }>;
  /** Checks that passed last time and do not pass now. */
  regressions: string[];
}

export function seoFactLines(sites: SiteCheckFacts[]): string[] {
  const lines: string[] = [];
  for (const site of sites.slice(0, 3)) {
    const trend = site.previousScore === null ? "first check" : `previous check: ${site.previousScore}/100`;
    lines.push(`Site ${clip(site.url, 200)}: score ${site.score}/100 (${trend})`);
    if (site.regressions.length) lines.push(`  Newly failing since last check: ${site.regressions.slice(0, 8).map((r) => clip(r, 80)).join("; ")}`);
    const issues = [...site.issues].sort((a, b) => (a.status === b.status ? 0 : a.status === "fail" ? -1 : 1)).slice(0, 12);
    for (const issue of issues) lines.push(`  - [${issue.status}] ${clip(issue.label, 80)}: ${clip(issue.detail, 200)}`);
    if (!issues.length) lines.push("  - Every automated check passed.");
  }
  return lines;
}

export function buildAgentPrompt(
  agentKey: NativeAgentKey,
  context: { businessName: string; instructions: string | null; input: Record<string, unknown>; facts?: string[] },
): string {
  const business = clip(context.businessName, 80) || "the business";
  const instructions = clip(context.instructions, 1500);
  const brief = clip(context.input.brief, 2000);
  const facts = (context.facts ?? []).slice(0, 60).join("\n").slice(0, 6000);
  const lines: string[] = [];

  if (agentKey === "chat_concierge") {
    const message = clip(context.input.message, 2000);
    lines.push(
      `You answer the website chat for ${business}.`,
      `A visitor wrote: "${message}"`,
      "Write one short, warm and useful reply (90 words at most), in the visitor's language (French or English).",
      "Offer to pass the conversation to a person when you cannot fully answer.",
      RULES,
    );
  } else if (agentKey === "social_autopilot") {
    lines.push(
      `You are the social media assistant of ${business}.`,
      "Write the posts for the coming week: one per day, 7 posts.",
      "For each post give: the day, a caption of 220 characters at most, 3 to 5 hashtags, and the best network (Facebook, Instagram or Google Business).",
      "Write each caption in Canadian French, then its English version on the next line.",
      RULES,
    );
  } else if (agentKey === "report_writer") {
    lines.push(
      `You write the monthly report summary of ${business}, for the owner, in plain language.`,
      "Numbers measured by TAKATAK for this period:",
      facts || "(no numbers recorded)",
      "Write: (1) a summary of the period in 3 sentences, (2) what went up or down compared with the previous month, (3) three concrete next steps the business can take.",
      "Write it in Canadian French first, then the same text in English.",
      NUMBER_RULES,
      RULES,
    );
  } else {
    lines.push(
      `You are the SEO watchdog of ${business}'s website.`,
      "Results of this week's automated checks:",
      facts || "(no results)",
      "Write a prioritized fix list of 5 items at most, most important first. Put anything newly failing since the last check first.",
      "For each item: the problem in plain words, why it matters for customers or Google, and the exact fix.",
      "Write it in Canadian French first, then the same list in English.",
      "Use only the check results above; do not claim rankings, traffic or competitor facts you were not given.",
      RULES,
    );
  }
  if (brief) lines.push(`Brief from the business: ${brief}`);
  if (instructions) lines.push(`Standing instructions from the business: ${instructions}`);
  lines.push("Reply with the text only, no preamble.");
  return lines.join("\n");
}

/**
 * Period the Report Writer covers: in the first week of a month, the month that
 * just ended (complete numbers); later, the current month to date. A run may ask
 * for a specific past month (YYYY-MM).
 */
export function reportPeriod(now: Date, requested?: unknown): { key: string; monthToDate: boolean } {
  const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const current = ym(now);
  if (typeof requested === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) && requested <= current) {
    return { key: requested, monthToDate: requested === current };
  }
  if (now.getUTCDate() <= 7) return { key: ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))), monthToDate: false };
  return { key: current, monthToDate: true };
}

type CheckStatus = "pass" | "warn" | "fail";

/** Compares this run's site check with the last saved one for the same page. */
export function compareSiteCheck(
  report: { requestedUrl: string; score: number; checks: Array<{ id: string; label: string; status: CheckStatus; detail: string }> },
  previous: { score: number; checks: Array<{ id: string; status: CheckStatus }> } | null,
): SiteCheckFacts {
  const passedBefore = new Set((previous?.checks ?? []).filter((c) => c.status === "pass").map((c) => c.id));
  const failing = report.checks.filter((c): c is typeof c & { status: "warn" | "fail" } => c.status !== "pass");
  return {
    url: report.requestedUrl,
    score: report.score,
    previousScore: previous ? previous.score : null,
    issues: failing.map((c) => ({ label: c.label, status: c.status, detail: c.detail })),
    regressions: failing.filter((c) => passedBefore.has(c.id)).map((c) => c.label),
  };
}

/** True when the external AI Gateway settings are present (it then owns every run). */
export function externalGatewayConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TAKATAK_AI_GATEWAY_URL?.trim() && env.TAKATAK_AI_GATEWAY_TOKEN?.trim());
}

/**
 * True when a queued run of this agent will actually be worked on: by the
 * external gateway when configured, otherwise by the native runner. Review
 * replies queued by the Reviews screen (workflow v2) have their own runner.
 */
export function agentRunsHere(agentKey: string, gatewayConfigured: boolean, context?: Record<string, unknown>): boolean {
  if (gatewayConfigured || isNativeAgent(agentKey)) return true;
  return agentKey === "review_responder" && context?.reviewWorkflowVersion === 2;
}
