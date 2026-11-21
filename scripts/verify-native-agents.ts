// Native agent runner: agents run on the connected engines without the
// external gateway, within strict limits.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAgentPrompt, isNativeAgent, nativeMode } from "../src/lib/ai-agents/native-prompts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

const runner = readFileSync("src/lib/ai-agents/native-runner.ts", "utf8");
const cron = readFileSync("src/app/api/cron/growth-agents/route.ts", "utf8");
const action = readFileSync("src/app/dashboard/admin/ai/actions.ts", "utf8");

check("only agents whose whole job can be done here run natively", () => {
  assert.ok(isNativeAgent("chat_concierge") && isNativeAgent("social_autopilot"));
  for (const key of ["review_requester", "review_responder", "seo_watchdog", "ads_optimizer", "report_writer"]) {
    assert.ok(!isNativeAgent(key), key);
  }
  assert.match(runner, /"agentKey" IN \('chat_concierge', 'social_autopilot'\)/);
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

console.log(`${passed} native agent checks passed`);
