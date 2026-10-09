import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPROVAL_STEP,
  approvalEvidence,
  reconcileMode,
  releaseDecision,
} from "./staging-release-approval.mjs";

const approvedRun = {
  name: "Reconcile TAKATAK staging migrations",
  conclusion: "success",
  event: "workflow_dispatch",
  headBranch: "main",
  headSha: "abc123",
  releaseSha: "abc123",
  steps: [{ name: APPROVAL_STEP, conclusion: "success" }],
};

test("a green CI run cannot select apply", () => {
  assert.equal(
    reconcileMode({
      eventName: "workflow_run",
      mode: "apply",
      approval: "approve-staging-migrations",
    }),
    "audit",
  );
  assert.equal(
    reconcileMode({
      eventName: "workflow_dispatch",
      mode: "apply",
      approval: "",
    }),
    "audit",
  );
  assert.equal(
    reconcileMode({
      eventName: "workflow_dispatch",
      mode: "audit",
      approval: "approve-staging-migrations",
    }),
    "audit",
  );
  assert.equal(
    reconcileMode({
      eventName: "workflow_dispatch",
      mode: "apply",
      approval: "approve-staging-migrations",
    }),
    "apply",
  );
});

test("an audit or a skipped approval step cannot authorize a release", () => {
  const audit = approvalEvidence({
    ...approvedRun,
    event: "workflow_run",
    steps: [{ name: APPROVAL_STEP, conclusion: "skipped" }],
  });
  assert.equal(audit.accepted, false);
  assert.equal(
    releaseDecision({ eventName: "workflow_run", evidenceAccepted: false }).word,
    "skip",
  );

  const skipped = approvalEvidence({
    ...approvedRun,
    steps: [{ name: APPROVAL_STEP, conclusion: "skipped" }],
  });
  assert.equal(skipped.accepted, false);
  assert.equal(
    releaseDecision({ eventName: "workflow_dispatch", evidenceAccepted: false })
      .word,
    "refuse",
  );
  assert.equal(
    releaseDecision({ eventName: "workflow_dispatch", evidenceAccepted: false })
      .exitCode,
    1,
  );
});

test("approval evidence must match this main SHA and a successful step", () => {
  assert.equal(approvalEvidence(approvedRun).accepted, true);
  assert.equal(
    approvalEvidence({ ...approvedRun, headSha: "other" }).accepted,
    false,
  );
  assert.equal(
    approvalEvidence({ ...approvedRun, conclusion: "failure" }).accepted,
    false,
  );
  assert.equal(approvalEvidence({ ...approvedRun, steps: [] }).accepted, false);
});

test("the reconciler exits audit before it can record or apply SQL", () => {
  const source = readFileSync("scripts/reconcile-staging-migrations.mjs", "utf8");
  const mode = source.indexOf('process.env.RECONCILE_MODE === "apply" ? "apply" : "audit"');
  const auditExit = source.indexOf("AUDIT PASS. No staging mutation performed.");
  const resolve = source.indexOf('["resolve", "--applied"');
  assert.ok(mode >= 0 && auditExit > mode && resolve > auditExit);
  const deploy = source.indexOf('runPrisma(["deploy"]');
  const guard = source.indexOf("canDeployApprovedPending({ pendingAfterResolve, unrelatedPending })");
  assert.ok(deploy > auditExit && guard > auditExit && deploy > guard);
  assert.equal(source.indexOf('runPrisma(["deploy"]', deploy + 1), -1);
});

test("release workflow cannot skip the evidence check", () => {
  const workflow = readFileSync(".github/workflows/release-staging.yml", "utf8");
  const migration = readFileSync(
    ".github/workflows/reconcile-staging-migrations.yml",
    "utf8",
  );
  const scriptAt = workflow.indexOf("node scripts/staging-release-approval.mjs");
  const readyAt = workflow.indexOf('echo "ready=true"');
  assert.ok(scriptAt >= 0 && readyAt > scriptAt);
  assert.equal(
    workflow.includes('if [ "${{ github.event_name }}" = "workflow_run" ]; then'),
    false,
  );
  assert.equal(workflow.includes("migration_run_id"), true);
  assert.equal(
    migration.includes(
      "github.event_name == 'workflow_dispatch' && inputs.mode == 'apply' && inputs.approval == 'approve-staging-migrations' && 'apply' || 'audit'",
    ),
    true,
  );
  assert.equal(
    migration.includes("github.event_name == 'workflow_run' && 'apply'"),
    false,
  );
});

function runCli(env) {
  return spawnSync("node", ["scripts/staging-release-approval.mjs"], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("cli skips a workflow_run audit and refuses a manual run without evidence", () => {
  const fixture = JSON.stringify({
    name: "Reconcile TAKATAK staging migrations",
    conclusion: "success",
    event: "workflow_run",
    headBranch: "main",
    headSha: "abc123",
    steps: [{ name: APPROVAL_STEP, conclusion: "skipped" }],
  });
  const skipped = runCli({
    EVENT_NAME: "workflow_run",
    RELEASE_SHA: "abc123",
    STAGING_APPROVAL_FIXTURE: fixture,
  });
  assert.equal(skipped.status, 0);
  assert.equal(skipped.stdout.trim(), "skip");

  const manual = runCli({
    EVENT_NAME: "workflow_dispatch",
    RELEASE_SHA: "abc123",
    STAGING_APPROVAL_FIXTURE: fixture,
  });
  assert.equal(manual.status, 1);
  assert.equal(manual.stdout.trim(), "refuse");

  const accepted = runCli({
    EVENT_NAME: "workflow_dispatch",
    RELEASE_SHA: "abc123",
    STAGING_APPROVAL_FIXTURE: JSON.stringify({
      ...approvedRun,
      steps: approvedRun.steps,
    }),
  });
  assert.equal(accepted.status, 0);
  assert.equal(accepted.stdout.trim(), "accepted");
});
