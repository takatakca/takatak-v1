// Admin screens in French first: every text the server builds for an admin
// screen (go-live checklist, status labels, AI providers, agents, invoice
// queue, Metricool and Upmind) must have French in src/lib/admin/admin-fr.ts,
// and every admin page must read the account language.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { ADMIN_FR, adminFr } from "../src/lib/admin/admin-fr";
import { AREA_LABELS, goLiveChecklist, type GoLiveFacts } from "../src/lib/admin/go-live";
import {
  ADMIN_ROLE_LABELS,
  EVENT_STATUS_LABELS,
  JOB_LOG_LEVEL_LABELS,
  JOB_STATUS_LABELS,
  NOTIFICATION_STATUS_LABELS,
} from "../src/lib/admin/status";
import { AI_PROVIDER_CATALOG, CATEGORY_LABELS, OUTCOME_MESSAGES } from "../src/lib/ai-providers/catalog";
import { INVOICE_REQUEST_STATUS_LABELS } from "../src/lib/billing/invoices/request-policy";
import { AI_AGENTS } from "../src/lib/growth/ai-engine";
import { METRICOOL_STATE_LABELS } from "../src/lib/integrations/metricool/status";
import { UPMIND_STATE_LABELS, UPMIND_STATE_MESSAGES } from "../src/lib/integrations/upmind/status";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

function hasFrench(text: string, where: string) {
  assert.notEqual(adminFr(text, true), text, `no French for ${where}: "${text}"`);
  assert.equal(adminFr(text, false), text, `English changed for ${where}`);
}

check("English stays English and unknown text is shown unchanged", () => {
  assert.equal(adminFr("Planned", false), "Planned");
  assert.equal(adminFr("Planned", true), "Planifiée");
  assert.equal(adminFr("Some client name", true), "Some client name");
});

check("every go-live item has French, in every state", () => {
  const facts = (over: Partial<GoLiveFacts> = {}): GoLiveFacts => ({
    databaseOk: true,
    lastAutomaticSyncAt: null,
    connectedEngines: 0,
    totalEngines: 21,
    anthropicConnected: false,
    now: Date.parse("2026-11-27T12:00:00Z"),
    ...over,
  });
  const full: Record<string, string> = {
    WEBSITE_LEADS_ENABLED: "true",
    WEBSITE_LEADS_CLIENT_ID: "00000000-0000-4000-8000-000000000000",
    WEBSITE_LEADS_NOTIFY_EMAIL: "alerts@example.com",
    STRIPE_SECRET_KEY: "sk_test_x",
    AI_CREDITS_CHECKOUT_ENABLED: "true",
    STRIPE_AI_CREDITS_WEBHOOK_SECRET: "whsec_x",
    CRON_SECRET: "x",
    GROWTH_TOKEN_ENCRYPTION_KEY_V1: "x",
    NEWSLETTER_TOKEN_SECRET: "x",
    NEWSLETTER_SENDER_ADDRESS: "news@example.com",
    PUSH_VAPID_PUBLIC_KEY: "x",
    PUSH_VAPID_PRIVATE_KEY: "x",
    UPMIND_API_BASE_URL: "https://example.com",
    UPMIND_API_KEY: "x",
    QMAPS_FUNCTIONS_BASE_URL: "https://example.com",
    QMAPS_INTEGRATION_SECRET: "x",
    GOOGLE_BUSINESS_PROFILE_CLIENT_ID: "x",
    GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET: "x",
    MIMT_API_URL: "https://example.com",
    MIMT_API_KEY: "x",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  };
  const partial = { ...full, STRIPE_AI_CREDITS_WEBHOOK_SECRET: "", NEWSLETTER_SENDER_ADDRESS: "", WEBSITE_LEADS_ENABLED: "" };
  const studio = { ...full, AI_STUDIO_GENERATION_ENABLED: "true", AI_STUDIO_PROVIDER: "openai", OPENAI_API_KEY: "sk-x" };
  const runs = [
    goLiveChecklist({}, facts({ databaseOk: false })),
    goLiveChecklist({}, facts({ connectedEngines: 5 })),
    goLiveChecklist(full, facts({ connectedEngines: 21, anthropicConnected: true, lastAutomaticSyncAt: "2026-11-27T11:00:00Z" })),
    goLiveChecklist(full, facts({ connectedEngines: 3 })),
    goLiveChecklist(partial, facts({ connectedEngines: 3 })),
    goLiveChecklist(studio, facts({ connectedEngines: 3 })),
  ];
  for (const items of runs) {
    for (const item of items) {
      hasFrench(item.title, `${item.id}.title`);
      hasFrench(item.now, `${item.id}.now`);
      hasFrench(item.howTo, `${item.id}.howTo`);
    }
  }
  for (const label of Object.values(AREA_LABELS)) assert.ok(label.length > 0);
});

check("every status and role label has French", () => {
  for (const map of [JOB_STATUS_LABELS, JOB_LOG_LEVEL_LABELS, EVENT_STATUS_LABELS, NOTIFICATION_STATUS_LABELS, ADMIN_ROLE_LABELS]) {
    for (const label of Object.values(map)) {
      if (label === "Info") continue; // same word in both languages
      hasFrench(label, "status label");
    }
  }
});

check("AI provider categories, test results, notes and check reasons have French", () => {
  for (const label of Object.values(CATEGORY_LABELS)) if (label !== "Images") hasFrench(label, "category");
  for (const message of Object.values(OUTCOME_MESSAGES)) hasFrench(message, "key test result");
  for (const entry of AI_PROVIDER_CATALOG) {
    const withText = entry as { key: string; note?: string; check: { kind: string; reason?: string } };
    if (withText.note) hasFrench(withText.note, `${entry.key}.note`);
    if (withText.check.kind === "none" && withText.check.reason) hasFrench(withText.check.reason, `${entry.key}.reason`);
  }
});

check("agent missions, invoice states, Metricool and Upmind states have French", () => {
  for (const agent of AI_AGENTS) hasFrench(agent.mission, `${agent.key}.mission`);
  for (const label of Object.values(INVOICE_REQUEST_STATUS_LABELS)) hasFrench(label, "invoice request status");
  for (const label of [...Object.values(METRICOOL_STATE_LABELS), ...Object.values(UPMIND_STATE_LABELS)]) hasFrench(label, "provider state");
  for (const message of Object.values(UPMIND_STATE_MESSAGES)) hasFrench(message, "Upmind state message");
});

check("text built with numbers or names gets French", () => {
  assert.equal(adminFr("3 of 21 TAK-TAK engines have a key.", true), "3 des 21 moteurs TAK-TAK ont une clé.");
  assert.equal(adminFr("On: 50 free credits per new workspace, on the trial engine.", true), "Allumé : 50 crédits gratuits par nouvel espace, sur le moteur d’essai.");
  assert.equal(adminFr("An API key is 16 to 512 characters.", true), "Une clé API compte de 16 à 512 caractères.");
  assert.equal(
    adminFr("RENTAUTO.CA access is now active for Café Test.", true),
    "L’accès RENTAUTO.CA est maintenant « actif » pour Café Test.",
  );
  assert.match(adminFr("Live Upmind API test failed with HTTP 401. Verify the endpoint and credentials.", true), /^Le test en direct/);
});

check("the French never uses a straight apostrophe or English quotes", () => {
  for (const [english, french] of Object.entries(ADMIN_FR)) {
    assert.ok(!/[a-zà-ÿ]'[a-zà-ÿ]/i.test(french), `straight apostrophe in French for "${english}"`);
    assert.ok(!/"/.test(french), `English quotes in French for "${english}"`);
  }
});

check("every admin page reads the account language", () => {
  const root = join(process.cwd(), "src/app/dashboard/admin");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx$/.test(name)) files.push(path);
    }
  };
  walk(root);
  // French-only screens (no English text on them) and the access gate.
  const frenchOnly = ["layout.tsx", "products/ahmv/page.tsx", "qmaps/page.tsx", "qmaps/link-form.tsx"];
  for (const file of files) {
    const relative = file.slice(root.length + 1);
    if (frenchOnly.includes(relative)) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(/getDashboardLanguage|useDashboardLanguage/.test(source), `${relative} does not read the account language`);
  }
});

console.log(`\n${passed} admin French checks passed`);
