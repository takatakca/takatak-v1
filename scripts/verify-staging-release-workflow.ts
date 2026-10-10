#!/usr/bin/env tsx
import { readFileSync } from "node:fs";

const path = ".github/workflows/release-staging.yml";
const source = readFileSync(path, "utf8");
const migrationWorkflowPath = ".github/workflows/reconcile-staging-migrations.yml";
const migrationSource = readFileSync(migrationWorkflowPath, "utf8");

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

requireText(
  "workflows:\n      - Reconcile TAKATAK staging migrations",
  "deploy only after staging migration workflow",
);
requireText("head_branch == 'main'", "main-only automatic release");
requireText(
  "Checkout exact migration-verified release",
  "migration-verified checkout gate",
);
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
requireText(
  "Human approval accepted for staging apply",
  "staging app release only after an approved migration apply",
);
requireText(
  "node scripts/staging-release-approval.mjs",
  "shared approval evidence check",
);
requireText("migration_run_id", "manual release points at an approved migration run");
requireText(
  '[ "$decision" = "skip" ]',
  "an audit release is skipped instead of deployed",
);
requireText(
  "ERROR: Staging release refused.",
  "a manual release without approval evidence fails",
);
forbidText(
  'if [ "${{ github.event_name }}" = "workflow_run" ]; then',
  "approval evidence must not be limited to automatic releases",
);
requireText("Refuse stale release before staging activation", "stale-main activation guard");
forbidText("pcjfahhlozsseqqevimi", "production Supabase project ref");
forbidText("TAKATAK_PRODUCTION_", "production deployment secrets");

const productionUrlMentions = source.match(/https:\/\/takatak\.ca/g)?.length ?? 0;
if (productionUrlMentions !== 2) {
  throw new Error(
    `Expected exactly two production URL mentions, both refusal checks; found ${productionUrlMentions}`,
  );
}

for (const needle of [
  "workflows:\n      - CI",
  "TAKATAK_STAGING_DATABASE_URL",
  "utuvzrqvivqyziibobvu",
  "RECONCILE_MODE:",
  "node scripts/reconcile-staging-migrations.mjs",
]) {
  if (!migrationSource.includes(needle)) {
    throw new Error(`Missing staging migration workflow safeguard: ${needle}`);
  }
}

for (const forbidden of [
  "pcjfahhlozsseqqevimi",
  "TAKATAK_PRODUCTION_DATABASE_URL",
]) {
  if (migrationSource.includes(forbidden)) {
    throw new Error(`Forbidden production coupling in staging migration workflow: ${forbidden}`);
  }
}

if (!migrationSource.includes("github.event.workflow_run.head_branch == 'main'")) {
  throw new Error("Automatic staging audit must stay limited to green main CI.");
}
if (!migrationSource.includes("github.event.workflow_run.conclusion == 'success'")) {
  throw new Error("Staging migrations must require green upstream CI.");
}
if (migrationSource.includes("github.event_name == 'workflow_run' && 'apply'")) {
  throw new Error("A green main CI run must not select staging apply mode.");
}
if (!migrationSource.includes("inputs.approval == 'approve-staging-migrations'")) {
  throw new Error("Staging apply must require the approval phrase approve-staging-migrations.");
}
if (!migrationSource.includes("Human approval accepted for staging apply")) {
  throw new Error("Staging apply must record an explicit approval step.");
}
if (!migrationSource.includes("|| 'audit'")) {
  throw new Error("Staging reconciliation must default to audit.");
}

if (!migrationSource.includes("node scripts/reconcile-staging-migrations.mjs")) {
  throw new Error("Staging migration workflow must execute the guarded reconciler.");
}

const reconcilerSource = readFileSync("scripts/reconcile-staging-migrations.mjs", "utf8");
for (const needle of [
  "approvedRepoMigrations",
  "Unrelated repo migrations intentionally outside this AHMV staging gate",
  "Refusing global prisma migrate deploy because unrelated repo migrations are outside this staging gate",
]) {
  if (!reconcilerSource.includes(needle)) {
    throw new Error(`Missing AHMV-scoped staging reconciliation safeguard: ${needle}`);
  }
}
if (
  reconcilerSource.includes('runPrisma(["deploy"]') &&
  !/if \(canDeployApprovedPending\(\{ pendingAfterResolve, unrelatedPending \}\)\) \{[^}]*runPrisma\(\["deploy"\]/.test(reconcilerSource)
) {
  throw new Error("Staging prisma migrate deploy must be guarded by canDeployApprovedPending.");
}
if (reconcilerSource.split('runPrisma(["deploy"]').length > 2) {
  throw new Error("Staging reconciliation may call prisma migrate deploy only once, behind its guard.");
}
if (!reconcilerSource.includes("migrationHistorySlug(migration)")) {
  throw new Error("Staging history lookup must use the real numeric-prefix slug.");
}
if (!reconcilerSource.includes("supabaseHistorySql(history.statements)")) {
  throw new Error("Staging history SQL must join statements with a real newline.");
}
if (reconcilerSource.includes("replace(/^\\\\d+_/") || reconcilerSource.includes('join("\\\\n")')) {
  throw new Error("Staging reconciler still contains the escaped prefix or newline bug.");
}

console.log("TAKATAK staging migration + release workflow safeguards: PASS");
