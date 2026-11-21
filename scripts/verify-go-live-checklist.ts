// Go-live checklist (/dashboard/admin/go-live): the percentage the owner
// reads must follow the real settings, never a guess.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { goLiveChecklist, goLivePercent, type GoLiveFacts } from "../src/lib/admin/go-live";

const NOW = Date.parse("2026-11-21T12:00:00Z");
const facts = (over: Partial<GoLiveFacts> = {}): GoLiveFacts => ({
  databaseOk: true,
  lastAutomaticSyncAt: null,
  connectedEngines: 20,
  totalEngines: 21,
  anthropicConnected: false,
  now: NOW,
  ...over,
});
const status = (items: ReturnType<typeof goLiveChecklist>, id: string) => items.find((item) => item.id === id)?.status;

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("an empty environment is far from ready and says why", () => {
  const items = goLiveChecklist({}, facts({ databaseOk: false, connectedEngines: 0 }));
  assert.equal(goLivePercent(items), 0);
  assert.equal(status(items, "leads_intake"), "todo");
  for (const item of items) assert.ok(item.howTo.length > 10, item.id);
});

check("request intake needs both the switch and a valid workspace ID", () => {
  assert.equal(status(goLiveChecklist({ WEBSITE_LEADS_ENABLED: "true" }, facts()), "leads_intake"), "todo");
  const ok = goLiveChecklist(
    { WEBSITE_LEADS_ENABLED: "true", WEBSITE_LEADS_CLIENT_ID: "614c6e69-3006-422b-9aa8-00fba5f4ff94" },
    facts(),
  );
  assert.equal(status(ok, "leads_intake"), "done");
});

check("scheduled tasks are done only with the secret and a sync in the last 24 hours", () => {
  assert.equal(status(goLiveChecklist({}, facts()), "scheduled_tasks"), "todo");
  assert.equal(status(goLiveChecklist({ CRON_SECRET: "x" }, facts()), "scheduled_tasks"), "partial");
  const stale = new Date(NOW - 3 * 24 * 3600 * 1000).toISOString();
  assert.equal(status(goLiveChecklist({ CRON_SECRET: "x" }, facts({ lastAutomaticSyncAt: stale })), "scheduled_tasks"), "partial");
  const fresh = new Date(NOW - 3600 * 1000).toISOString();
  assert.equal(status(goLiveChecklist({ CRON_SECRET: "x" }, facts({ lastAutomaticSyncAt: fresh })), "scheduled_tasks"), "done");
});

check("AI credit sales need checkout, Stripe and the webhook secret", () => {
  assert.equal(status(goLiveChecklist({ AI_CREDITS_CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk" }, facts()), "ai_credit_sales"), "todo");
  assert.equal(
    status(goLiveChecklist({ AI_CREDITS_CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk", STRIPE_AI_CREDITS_WEBHOOK_SECRET: "wh" }, facts()), "ai_credit_sales"),
    "done",
  );
});

check("engines are partial until every key is present", () => {
  assert.equal(status(goLiveChecklist({}, facts()), "ai_engines"), "partial");
  assert.equal(status(goLiveChecklist({}, facts({ connectedEngines: 21, anthropicConnected: true })), "ai_engines"), "done");
});

check("manual items never count in the percentage; partial counts for half", () => {
  const items = [
    { status: "done" }, { status: "partial" }, { status: "todo" }, { status: "manual" },
  ] as ReturnType<typeof goLiveChecklist>;
  assert.equal(goLivePercent(items), 50);
});

check("the screen is admin-only and shows no setting value", () => {
  const page = readFileSync("src/app/dashboard/admin/go-live/page.tsx", "utf8");
  assert.match(page, /await requireAdminAccess\(\)/);
  assert.doesNotMatch(page, /process\.env\.[A-Z]/);
  const lib = readFileSync("src/lib/admin/go-live.ts", "utf8");
  assert.doesNotMatch(lib, /\$\{env\./);
});

console.log(`${passed} go-live checklist checks passed`);
