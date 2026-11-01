import assert from "node:assert/strict";

import { TAKBOT_ENGINES } from "../src/lib/takbot/catalog";
import { modelFor, relayPrompt } from "../src/lib/takbot/relay";
import { TRIAL_DEFAULT_CREDITS, TRIAL_ECONOMY_ORDER, readTrialConfig, routeForWorkspace, trialEngineKey, trialGrantKey } from "../src/lib/takbot/trial";
import { TRIAL_LEAD_SOURCE, recordTrialLead, type TrialLeadDb } from "../src/lib/takbot/trial-lead";

// Config: 50 credits by default, owner can change or switch it off.
const def = readTrialConfig({});
assert.equal(def.credits, TRIAL_DEFAULT_CREDITS);
assert.equal(def.credits, 50);
assert.ok(def.enabled);
assert.equal(readTrialConfig({ TAKBOT_TRIAL_CREDITS: "20" }).credits, 20);
assert.equal(readTrialConfig({ TAKBOT_TRIAL_CREDITS: "abc" }).credits, 50, "a bad value falls back to the default");
assert.equal(readTrialConfig({ TAKBOT_TRIAL_CREDITS: "5000" }).credits, 50, "a huge value is refused");
assert.equal(readTrialConfig({ TAKBOT_TRIAL_CREDITS: "0" }).enabled, false, "0 credits = no trial");
assert.equal(readTrialConfig({ TAKBOT_TRIAL_ENABLED: "false" }).enabled, false);

// Every economy engine is a real inline engine that does chat, write and research.
for (const key of TRIAL_ECONOMY_ORDER) {
  const e = TAKBOT_ENGINES.find((x) => x.key === key);
  assert.ok(e && e.relay !== "studio", `${key} relays inline`);
  for (const m of ["chat", "write", "research"] as const) assert.ok(e!.modes.includes(m), `${key} does ${m}`);
}

// The trial engine is the cheapest one connected; a pinned engine must be connected.
assert.equal(trialEngineKey(def, new Set(["anthropic", "gemini", "groq"])), "groq");
assert.equal(trialEngineKey(def, new Set(["anthropic", "deepseek"])), "deepseek");
assert.equal(trialEngineKey(def, new Set(["anthropic", "perplexity"])), null, "premium engines are never used for the trial");
const pinned = readTrialConfig({ TAKBOT_TRIAL_ENGINE: "Gemini", TAKBOT_TRIAL_MODEL: "gemini-2.5-flash-lite" });
assert.equal(trialEngineKey(pinned, new Set(["gemini"])), "gemini");
assert.equal(trialEngineKey(pinned, new Set(["groq"])), null);
assert.equal(pinned.model, "gemini-2.5-flash-lite");

// Routing: before any purchase, the workspace runs on the trial engine; after, on the normal routing.
const connected = new Set(["anthropic", "openai", "groq"]);
assert.deepEqual(routeForWorkspace({ premiumUnlocked: false, config: def, connected }), { kind: "trial", engineKey: "groq", model: null });
assert.deepEqual(routeForWorkspace({ premiumUnlocked: true, config: def, connected }), { kind: "premium" });
assert.deepEqual(routeForWorkspace({ premiumUnlocked: false, config: def, connected: new Set(["anthropic"]) }), { kind: "unavailable" });
assert.deepEqual(routeForWorkspace({ premiumUnlocked: false, config: readTrialConfig({ TAKBOT_TRIAL_ENABLED: "false" }), connected }), { kind: "premium" });

// One grant key per workspace, so the ledger refuses a second trial.
assert.equal(trialGrantKey("abc"), "takbot-trial:abc");
assert.equal(trialGrantKey("abc"), trialGrantKey("abc"));

// The model override is only used when given.
const groq = TAKBOT_ENGINES.find((e) => e.key === "groq")!;
assert.equal(modelFor(groq, {}), groq.defaultModel);

// CRM card: one per address, name and email from the profile, never a marketing consent.
type Row = { id: string; clientId: string; leadSourceId: string; email: string; name: string | null; metadata: Record<string, unknown> };
const rows: Row[] = [];
const audits: string[] = [];
let source: { id: string } | null = null;
let locks = 0;
const tx = {
  leadSource: {
    findFirst: async ({ where }: { where: { name: string } }) => (where.name === TRIAL_LEAD_SOURCE ? source : null),
    create: async () => (source = { id: "src-trial" }),
  },
  lead: {
    findFirst: async ({ where }: { where: { email: string } }) => rows.find((r) => r.email === where.email) ?? null,
    create: async ({ data }: { data: Omit<Row, "id"> }) => {
      const row = { ...data, id: `lead-${rows.length + 1}` } as Row;
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data),
  },
  auditLog: { create: async ({ data }: { data: { action: string } }) => void audits.push(data.action) },
  $executeRaw: async () => {
    locks += 1;
    return 0;
  },
};
const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as TrialLeadDb;

async function leadTests() {
  // The trial model override reaches the engine request.
  let body = "";
  await relayPrompt({ engine: groq, mode: "chat", apiKey: "k", prompt: "x", model: "llama-3.1-8b-instant" }, async (_u, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  });
  assert.equal(JSON.parse(body).model, "llama-3.1-8b-instant");
  await relayPrompt({ engine: groq, mode: "chat", apiKey: "k", prompt: "x" }, async (_u, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  });
  assert.equal(JSON.parse(body).model, groq.defaultModel);

  const base = { agencyClientId: "agency", workspaceClientId: "ws-1", name: "  Marie   Tremblay ", language: "fr" as const, sourcePage: "/", credits: 50 };
  const first = await recordTrialLead(db, { ...base, email: " Marie@Exemple.CA " });
  assert.deepEqual(first, { id: "lead-1", created: true });
  assert.equal(rows[0].email, "marie@exemple.ca");
  assert.equal(rows[0].name, "Marie Tremblay");
  assert.equal(rows[0].metadata.marketingConsent, false, "a trial is never a newsletter consent");
  assert.equal(locks, 1);
  const again = await recordTrialLead(db, { ...base, email: "marie@exemple.ca" });
  assert.deepEqual(again, { id: "lead-1", created: false });
  assert.equal(rows.length, 1, "one card per address");
  assert.equal(await recordTrialLead(db, { ...base, email: "pas-un-courriel" }), null);
  assert.deepEqual(audits, ["takbot_trial_lead_recorded"]);
  console.log("takbot trial tests: OK");
}

leadTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
