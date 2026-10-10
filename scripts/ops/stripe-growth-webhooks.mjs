#!/usr/bin/env node
// Stripe webhook endpoints for the Growth Suite (AI credit packs + plans).
//
// Read-only by default: lists matching endpoints and the events they send.
// With --apply it creates any missing endpoint with exactly the events the
// app handles. Stripe returns a signing secret only once, at creation: it is
// written to --secrets-file (mode 600), never printed, so it can be copied to
// the server environment (STRIPE_AI_CREDITS_WEBHOOK_SECRET /
// STRIPE_GROWTH_WEBHOOK_SECRET).
//
//   STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for a dry run in test mode)
//   node scripts/ops/stripe-growth-webhooks.mjs --origin https://takatak.ca
//   node scripts/ops/stripe-growth-webhooks.mjs --origin https://takatak.ca --apply --secrets-file ~/growth-webhooks.env

import { chmodSync, writeFileSync } from "node:fs";

const ENDPOINTS = [
  {
    path: "/api/billing/ai-credits/webhook",
    envName: "STRIPE_AI_CREDITS_WEBHOOK_SECRET",
    description: "TAKATAK Growth: AI credit packs",
    events: ["checkout.session.completed"],
  },
  {
    path: "/api/billing/growth/webhook",
    envName: "STRIPE_GROWTH_WEBHOOK_SECRET",
    description: "TAKATAK Growth: monthly plans",
    events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
    ],
  },
];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(message) {
  console.error(`[stripe-growth-webhooks] ${message}`);
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
if (!/^(sk|rk)_(live|test)_/.test(key)) fail("STRIPE_SECRET_KEY is not set (sk_live_… or sk_test_…).");
const originRaw = arg("--origin") ?? "";
let origin;
try {
  origin = new URL(originRaw);
} catch {
  fail("Pass --origin https://your-domain");
}
if (origin.protocol !== "https:") fail("The origin must be https.");
const apply = process.argv.includes("--apply");
const secretsFile = arg("--secrets-file");
if (apply && !secretsFile) fail("Pass --secrets-file <path> so the signing secrets are saved (they are shown only once).");

const auth = { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` };

async function stripe(method, path, form) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { ...auth, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? form.toString() : undefined,
  });
  const json = await response.json();
  if (!response.ok) fail(`${method} ${path}: HTTP ${response.status} ${json?.error?.message ?? ""}`);
  return json;
}

const mode = key.includes("_live_") ? "LIVE" : "TEST";
const existing = (await stripe("GET", "/webhook_endpoints?limit=100")).data;
const secrets = [];

for (const endpoint of ENDPOINTS) {
  const url = `${origin.origin}${endpoint.path}`;
  const match = existing.find((e) => e.url === url);
  if (match) {
    const missing = endpoint.events.filter((ev) => !match.enabled_events.includes(ev) && !match.enabled_events.includes("*"));
    console.log(`[${mode}] ${url}: exists (${match.status})${missing.length ? `, MISSING events: ${missing.join(", ")}` : ", events OK"}`);
    if (missing.length && apply) {
      const form = new URLSearchParams();
      for (const ev of new Set([...match.enabled_events, ...endpoint.events])) form.append("enabled_events[]", ev);
      await stripe("POST", `/webhook_endpoints/${match.id}`, form);
      console.log("  events updated");
    }
    continue;
  }
  console.log(`[${mode}] ${url}: not found${apply ? "; creating" : ""}`);
  if (!apply) continue;
  const form = new URLSearchParams({ url, description: endpoint.description });
  for (const ev of endpoint.events) form.append("enabled_events[]", ev);
  const created = await stripe("POST", "/webhook_endpoints", form);
  secrets.push(`${endpoint.envName}=${created.secret}`);
  console.log(`  created ${created.id}; signing secret saved for ${endpoint.envName}`);
}

if (secrets.length) {
  writeFileSync(secretsFile, `${secrets.join("\n")}\n`, { mode: 0o600 });
  chmodSync(secretsFile, 0o600);
  console.log(`\nSigning secrets written to ${secretsFile} (mode 600). Copy them to the server environment, then delete the file.`);
}
if (!apply) console.log("\nRead-only. Re-run with --apply --secrets-file <path> to create what is missing.");
