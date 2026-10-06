// Growth Suite safeguards: catalog integrity, honest status vocabulary and the
// site-audit SSRF guard. Pure checks, no network and no database.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { AI_AGENTS, AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, AI_PROVIDERS } from "../src/lib/growth/ai-engine";
import { CONNECTORS, CONNECTOR_CATEGORY_ORDER, connectorByKey } from "../src/lib/growth/connectors";
import { GROWTH_MODULES } from "../src/lib/growth/modules";
import { GROWTH_STAGES, SERVICE_PLANS } from "../src/lib/growth/plans";
import { getAiEngineStatus, getConnectorStatuses } from "../src/lib/growth/status";
import { normalizeAuditUrl } from "../src/lib/seo/site-audit";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function routeExists(href: string): boolean {
  const clean = href.split("?")[0].replace(/\/$/, "");
  return fs.existsSync(path.join("src/app", clean, "page.tsx"));
}

function unique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} keys must be unique`);
}

function verifyCatalog(): void {
  unique(CONNECTORS.map((c) => c.key), "connector");
  unique(AI_PROVIDERS.map((p) => p.key), "AI provider");
  unique(AI_AGENTS.map((a) => a.key), "agent");
  unique(AI_CREDIT_ACTIONS.map((a) => a.key), "credit action");
  unique(SERVICE_PLANS.map((p) => p.key), "service plan");
  pass("catalog keys are unique");

  for (const c of CONNECTORS) {
    assert.ok(CONNECTOR_CATEGORY_ORDER.includes(c.category), `${c.key} has an ordered category`);
    if (c.kind === "external") assert.ok(c.env.length > 0, `${c.key} external connector lists env vars`);
    else assert.equal(c.env.length, 0, `${c.key} non-external connector needs no env`);
    for (const name of c.env) assert.match(name, /^[A-Z][A-Z0-9_]+$/, `${c.key} env name ${name}`);
    if (c.managedIn) assert.ok(routeExists(c.managedIn), `${c.key} managedIn route ${c.managedIn} exists`);
    if (c.docsUrl) assert.ok(c.docsUrl.startsWith("https://"), `${c.key} docs url is https`);
  }
  pass("connectors are well-formed and link to real routes");

  assert.equal(AI_PROVIDERS.length, 13, "AI roster has 13 engines");
  for (const agent of AI_AGENTS) {
    for (const key of agent.connectorKeys) assert.ok(connectorByKey(key), `${agent.key} uses known connector ${key}`);
    for (const key of agent.creditActionKeys) {
      assert.ok(AI_CREDIT_ACTIONS.some((a) => a.key === key), `${agent.key} uses known credit action ${key}`);
    }
  }
  for (const stage of GROWTH_STAGES) {
    assert.ok(routeExists(stage.href), `stage ${stage.key} route exists`);
    for (const key of stage.connectorKeys) assert.ok(connectorByKey(key), `stage ${stage.key} uses known connector ${key}`);
  }
  for (const m of GROWTH_MODULES) assert.ok(routeExists(m.href), `module route ${m.href} exists`);
  pass("agents, stages and modules reference real connectors and routes");

  for (const a of AI_CREDIT_ACTIONS) assert.ok(Number.isInteger(a.credits) && a.credits > 0, `${a.key} credits`);
  for (const p of AI_CREDIT_PACKS) assert.ok(p.credits > 0 && p.priceCad > 0, `${p.key} pack`);
  for (const p of SERVICE_PLANS) {
    assert.ok(p.monthlyCad > 0, `${p.key} price`);
    assert.ok(GROWTH_STAGES.some((s) => s.key === p.stage), `${p.key} stage`);
  }
  pass("credits and prices are positive and staged");
}

function verifyHonestStatuses(): void {
  const saved = { ...process.env };
  try {
    for (const c of CONNECTORS) for (const name of c.env) delete process.env[name];
    for (const p of AI_PROVIDERS) delete process.env[p.env];
    delete process.env.TAKATAK_AI_GATEWAY_URL;
    delete process.env.TAKATAK_AI_GATEWAY_TOKEN;

    const empty = getConnectorStatuses();
    for (const s of empty) {
      if (s.kind === "external") {
        assert.equal(s.state, "not_configured", `${s.key} not configured without env`);
        assert.deepEqual(s.missing, s.env);
      }
    }
    assert.equal(getAiEngineStatus().configuredCount, 0);
    assert.equal(getAiEngineStatus().gateway.configured, false);

    process.env.SEMRUSH_API_KEY = "   ";
    assert.equal(getConnectorStatuses().find((s) => s.key === "semrush")?.state, "not_configured", "whitespace is not a credential");
    process.env.SEMRUSH_API_KEY = "x";
    assert.equal(getConnectorStatuses().find((s) => s.key === "semrush")?.state, "configured_untested");

    const states = new Set(getConnectorStatuses().map((s) => s.state as string));
    assert.ok(!states.has("connected"), "presence checks never claim connected");
    pass("statuses are presence-only and never claim connected");
  } finally {
    process.env = saved;
  }
}

function rejects(raw: string): void {
  assert.throws(() => normalizeAuditUrl(raw), Error, `should reject ${raw}`);
}

function verifyAuditUrlGuard(): void {
  assert.equal(normalizeAuditUrl("example.com").toString(), "https://example.com/");
  assert.equal(normalizeAuditUrl("http://example.com/a#frag").toString(), "http://example.com/a");
  assert.equal(normalizeAuditUrl("https://example.com:443/").hostname, "example.com");
  pass("audit accepts public http(s) URLs and strips fragments");

  for (const raw of [
    "",
    "ftp://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost",
    "http://localhost:3000",
    "http://intranet",
    "http://printer.local",
    "http://db.internal",
    "http://user:pass@example.com",
    "http://example.com:8080",
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://172.16.3.4",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://[::1]",
    "http://[fd00::1]",
    "http://[fe80::1]",
    "http://[::ffff:127.0.0.1]",
  ]) {
    rejects(raw);
  }
  pass("audit rejects private, local, credentialed and non-web targets");
}

verifyCatalog();
verifyHonestStatuses();
verifyAuditUrlGuard();
console.log("\nGrowth Suite safeguards: all checks passed.");
