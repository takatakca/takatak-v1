#!/usr/bin/env tsx
import { readFileSync } from "node:fs";

const path = ".github/workflows/release-staging.yml";
const source = readFileSync(path, "utf8");

function requireText(needle: string, label: string) {
  if (!source.includes(needle)) {
    throw new Error(`Missing staging-release safeguard: ${label}`);
  }
}

function forbidText(needle: string, label: string) {
  if (source.includes(needle)) {
    throw new Error(`Forbidden staging-release coupling: ${label}`);
  }
}

requireText("workflows:\n      - CI", "deploy only after CI workflow");
requireText("head_branch == 'main'", "main-only automatic release");
requireText("utuvzrqvivqyziibobvu", "hard-pinned staging Supabase project ref");
requireText("TAKATAK_STAGING_SUPABASE_ANON_KEY", "staging-specific public Supabase key");
requireText('if [ "$STAGING_APP_URL" = "https://takatak.ca" ]', "build-time production URL refusal");
requireText('if [ "$TKT_URL" = "https://takatak.ca" ]', "deploy-time production URL refusal");
requireText("values.db.includes(requiredRef)", "database URL staging project isolation");
requireText("values.direct.includes(requiredRef)", "direct URL staging project isolation");
requireText("StrictHostKeyChecking yes", "strict SSH host verification");
requireText("sha256sum -c", "artifact checksum verification");
requireText("production-preflight.ts", "remote environment preflight");
requireText("check-module-load.ts", "remote module-load verification");
requireText("/api/health", "health smoke");
requireText("/api/health/ready", "readiness smoke");
requireText("Roll back failed staging activation", "automatic staging rollback");
requireText("Refuse stale release before staging activation", "stale-main activation guard");
forbidText("pcjfahhlozsseqqevimi", "production Supabase project ref");
forbidText("TAKATAK_PRODUCTION_", "production deployment secrets");

const productionUrlMentions = source.match(/https:\/\/takatak\.ca/g)?.length ?? 0;
if (productionUrlMentions !== 2) {
  throw new Error(
    `Expected exactly two production URL mentions, both refusal checks; found ${productionUrlMentions}`,
  );
}

console.log("TAKATAK staging release workflow safeguards: PASS");
