// Native agent runner: agents run on the connected engines without the
// external gateway, within strict limits.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  adsFactLines,
  buildAgentPrompt,
  compareSiteCheck,
  isNativeAgent,
  nativeActionKey,
  nativeMode,
  nativeSummary,
  reportFactLines,
  reportPeriod,
  seoFactLines,
} from "../src/lib/ai-agents/native-prompts";
import { AI_CREDIT_ACTIONS } from "../src/lib/growth/ai-engine";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

const runner = readFileSync("src/lib/ai-agents/native-runner.ts", "utf8");
const cron = readFileSync("src/app/api/cron/growth-agents/route.ts", "utf8");
const action = readFileSync("src/app/dashboard/admin/ai/actions.ts", "utf8");
const takbotServer = readFileSync("src/lib/takbot/server.ts", "utf8");
const service = readFileSync("src/lib/ai-agents/service.ts", "utf8");

check("only agents whose whole job can be done here run natively", () => {
  for (const key of ["chat_concierge", "social_autopilot", "report_writer", "seo_watchdog", "ads_optimizer"]) assert.ok(isNativeAgent(key), key);
  // SMS review requests need a messaging connector this runner does not have;
  // review replies run through the Reputation cockpit's own native workflow.
  for (const key of ["review_requester", "review_responder"]) assert.ok(!isNativeAgent(key), key);
  assert.match(runner, /"agentKey" IN \(\$\{Prisma\.join\(nativeKeys\)\}\)/);
});

check("prompts forbid invented facts and carry the visitor's words", () => {
  const chat = buildAgentPrompt("chat_concierge", {
    businessName: "Café Test",
    instructions: "Open 7-17",
    input: { message: "Avez-vous des options véganes ?" },
  });
  assert.match(chat, /Café Test/);
  assert.match(chat, /Avez-vous des options véganes/);
  assert.match(chat, /Never invent prices/);
  assert.match(chat, /Open 7-17/);
  const social = buildAgentPrompt("social_autopilot", { businessName: "Café Test", instructions: null, input: { brief: "Soupe du jour" } });
  assert.match(social, /7 posts/);
  assert.match(social, /Never invent prices/);
  assert.match(social, /Soupe du jour/);
  const long = buildAgentPrompt("chat_concierge", { businessName: "x", instructions: null, input: { message: "a".repeat(5000) } });
  assert.ok(long.length < 3500);
});

check("credits: each run is billed at most once through the TAK-TAK ledger", () => {
  assert.equal(nativeMode("chat_concierge"), "chat");
  assert.equal(nativeMode("social_autopilot"), "write");
  assert.equal(nativeMode("report_writer"), "write");
  assert.equal(nativeMode("seo_watchdog"), "research");
  // The Report Writer is billed as the published "monthly report summary" action.
  assert.equal(nativeActionKey("report_writer"), "monthly_report_summary");
  assert.ok(AI_CREDIT_ACTIONS.some((a) => a.key === nativeActionKey("report_writer")));
  for (const key of ["chat_concierge", "social_autopilot", "seo_watchdog", "ads_optimizer"] as const) assert.equal(nativeActionKey(key), undefined);
  // The Ads Optimizer bills the published "Ad copy set" action through the write mode.
  assert.equal(nativeMode("ads_optimizer"), "write");
  assert.match(runner, /actionKey: nativeActionKey\(run\.agentKey\)/);
  // runTakbot refuses an unknown billed action instead of billing it.
  assert.match(takbotServer, /code: "unknown_action"/);
  assert.match(takbotServer, /actionKey: action \? action\.key : decision\.mode\.actionKey/);
  assert.match(runner, /requestId: `agent-\$\{run\.runId\}`/);
  assert.match(runner, /runTakbot\(/);
});

check("nothing is published without approval, except a chat reply the workspace set to auto", () => {
  assert.match(runner, /run\.agentKey === "chat_concierge" && !run\.requireApproval/);
  // Social Autopilot never publishes: the approved draft stays in the library.
  assert.doesNotMatch(runner, /publish(Post|Now|ToNetwork)|createSocialPost/i);
});

check("the external gateway, when configured, owns every run", () => {
  assert.match(runner, /export function nativeRunnerEnabled/);
  assert.match(cron, /nativeRunnerEnabled\(\) \? await runNativeAgentBatch/);
  assert.match(action, /getPlatformAdminAccess\(\)/);
  assert.match(action, /access\.mode !== "authorized"/);
});

check("Report Writer uses only the measured numbers, for the right period", () => {
  assert.deepEqual(reportPeriod(new Date("2026-11-03T12:00:00Z")), { key: "2026-10", monthToDate: false });
  assert.deepEqual(reportPeriod(new Date("2026-01-05T12:00:00Z")), { key: "2025-12", monthToDate: false });
  assert.deepEqual(reportPeriod(new Date("2026-11-21T12:00:00Z")), { key: "2026-11", monthToDate: true });
  assert.deepEqual(reportPeriod(new Date("2026-11-21T12:00:00Z"), "2026-09"), { key: "2026-09", monthToDate: false });
  // A future or malformed month falls back to the default period.
  assert.deepEqual(reportPeriod(new Date("2026-11-21T12:00:00Z"), "2027-01"), { key: "2026-11", monthToDate: true });
  assert.deepEqual(reportPeriod(new Date("2026-11-21T12:00:00Z"), "2026-13"), { key: "2026-11", monthToDate: true });
  const numbers = { visits: 120, pageviews: 300, conversions: 9, leads: 4, ratings: 3, averageRating: 4.7, requestsSent: 10, conversations: 6, aiRunsCompleted: 2 };
  const zero = { visits: 0, pageviews: 0, conversions: 0, leads: 0, ratings: 0, averageRating: null, requestsSent: 0, conversations: 0, aiRunsCompleted: 0 };
  const lines = reportFactLines({ monthLabel: "novembre 2026", monthToDate: true, current: numbers, previous: zero });
  assert.ok(lines.some((l) => l.includes("Website visits: 120 (previous month: 0)")));
  assert.ok(lines.some((l) => l.includes("4.7 / 5")));
  assert.match(lines[0], /month to date/);
  const prompt = buildAgentPrompt("report_writer", { businessName: "Café Test", instructions: null, input: {}, facts: lines });
  assert.match(prompt, /Website visits: 120/);
  assert.match(prompt, /Never invent a number/);
  assert.match(prompt, /Canadian French first/);
  assert.match(runner, /getGrowthReport\(run\.clientId, period\.key\)/);
});

check("SEO Watchdog re-checks real sites, flags what newly fails, never debits when nothing was checked", () => {
  const facts = compareSiteCheck(
    {
      requestedUrl: "https://example.ca/",
      score: 70,
      checks: [
        { id: "title", label: "Title tag", status: "pass", detail: "ok" },
        { id: "meta", label: "Meta description", status: "fail", detail: "missing" },
        { id: "h1", label: "One H1", status: "warn", detail: "two H1" },
      ],
    },
    { score: 85, checks: [{ id: "title", status: "pass" }, { id: "meta", status: "pass" }, { id: "h1", status: "warn" }] },
  );
  assert.equal(facts.previousScore, 85);
  assert.deepEqual(facts.regressions, ["Meta description"]);
  assert.equal(facts.issues.length, 2);
  const first = compareSiteCheck({ requestedUrl: "https://example.ca/", score: 90, checks: [] }, null);
  assert.equal(first.previousScore, null);
  const lines = seoFactLines([facts, first]);
  assert.ok(lines.some((l) => l.includes("score 70/100 (previous check: 85/100)")));
  assert.ok(lines.some((l) => l.includes("Newly failing since last check: Meta description")));
  assert.ok(lines.some((l) => l.includes("[fail] Meta description")));
  assert.ok(lines.some((l) => l.includes("Every automated check passed")));
  const prompt = buildAgentPrompt("seo_watchdog", { businessName: "Café Test", instructions: null, input: {}, facts: lines });
  assert.match(prompt, /prioritized fix list/);
  assert.match(prompt, /newly failing/);
  // Same SSRF-guarded check as the SEO screen; result joins the score history.
  assert.match(runner, /runSiteAudit\(url\)/);
  assert.match(runner, /recordSeoScore\(prisma/);
  // Facts are gathered before any debit; a failure there reports the run without billing.
  assert.ok(runner.indexOf("const facts = await gatherFacts(run)") < runner.indexOf("const result = await runTakbot("));
  assert.match(runner, /no_website_on_file/);
});

check("Ads Optimizer works on real TAKATAK ADS numbers and never spends", () => {
  const lines = adsFactLines({
    campaigns: [{ name: "Hiver", status: "active", budgetCents: 50000, spentCents: 12000, startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: null }],
    totals: { impressions: 2000, clicks: 50, leads: 4, conversions: 1 },
  });
  assert.ok(lines.some((l) => l.includes('Campaign "Hiver" (active): budget 500.00 CAD, spent 120.00 CAD')));
  assert.ok(lines.some((l) => l.includes("CTR 2.50%") && l.includes("cost per lead 30.00 CAD")));
  const prompt = buildAgentPrompt("ads_optimizer", { businessName: "Garage Test", instructions: null, input: {}, facts: lines });
  assert.match(prompt, /Never say money was moved or spent/);
  assert.match(prompt, /5 headlines/);
  assert.match(runner, /no_ad_campaign/);
  assert.match(runner, /getAdsWorkspaceSnapshot\(run\.clientId\)/);
});

check("the approval card shows what the agent wrote", () => {
  assert.match(service, /key === "preview" \? record\.draft/);
  assert.match(runner, /summary: nativeSummary\(run\.agentKey\)/);
  for (const key of ["chat_concierge", "social_autopilot", "report_writer", "seo_watchdog", "ads_optimizer"] as const) assert.match(nativeSummary(key), / · /);
});

console.log(`${passed} native agent checks passed`);
