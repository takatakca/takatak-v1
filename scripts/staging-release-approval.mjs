/**
 * Decide whether a staging app release has verified migration-approval evidence.
 *
 * An audit never records "Human approval accepted for staging apply" with
 * conclusion success, so it cannot satisfy this check. A skipped step does
 * not count. Manual and automatic releases use the same evidence.
 */

export const APPROVAL_STEP = "Human approval accepted for staging apply";
export const RECONCILE_WORKFLOW = "Reconcile TAKATAK staging migrations";
export const APPROVAL_PHRASE = "approve-staging-migrations";

export function reconcileMode({ eventName, mode, approval }) {
  if (
    eventName === "workflow_dispatch" &&
    mode === "apply" &&
    approval === APPROVAL_PHRASE
  ) {
    return "apply";
  }
  return "audit";
}

export function approvalEvidence(run) {
  const reasons = [];
  if (run?.name !== RECONCILE_WORKFLOW) reasons.push("workflow");
  if (run?.conclusion !== "success") reasons.push("run-conclusion");
  if (run?.event !== "workflow_dispatch") reasons.push("run-event");
  if (run?.headBranch !== "main") reasons.push("branch");
  if (!run?.headSha || run.headSha !== run.releaseSha) reasons.push("sha");
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  const accepted = steps.some(
    (step) => step?.name === APPROVAL_STEP && step?.conclusion === "success",
  );
  if (!accepted) reasons.push("approval-step");
  return { accepted: reasons.length === 0, reasons };
}

export function releaseDecision({ eventName, evidenceAccepted }) {
  if (evidenceAccepted) return { ready: true, exitCode: 0, word: "accepted" };
  if (eventName === "workflow_run") {
    return { ready: false, exitCode: 0, word: "skip" };
  }
  return { ready: false, exitCode: 1, word: "refuse" };
}

function flattenSteps(jobsPayload) {
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const steps = [];
  for (const job of jobs) {
    if (Array.isArray(job?.steps)) steps.push(...job.steps);
  }
  return steps;
}

export function evidenceFromActionsPayloads({ run, jobs, releaseSha }) {
  return approvalEvidence({
    name: run?.name,
    conclusion: run?.conclusion,
    event: run?.event,
    headBranch: run?.head_branch,
    headSha: run?.head_sha,
    releaseSha,
    steps: flattenSteps(jobs),
  });
}

function readFixture(raw) {
  const parsed = JSON.parse(raw);
  return approvalEvidence({
    ...parsed,
    releaseSha: process.env.RELEASE_SHA,
  });
}

async function main() {
  const eventName = process.env.EVENT_NAME ?? "";
  const releaseSha = process.env.RELEASE_SHA ?? "";
  let evidence;
  if (process.env.STAGING_APPROVAL_FIXTURE) {
    evidence = readFixture(process.env.STAGING_APPROVAL_FIXTURE);
  } else {
    const runId =
      eventName === "workflow_run"
        ? process.env.UPSTREAM_RUN_ID
        : process.env.MIGRATION_RUN_ID;
    if (!/^[0-9]+$/.test(String(runId ?? ""))) {
      evidence = approvalEvidence({ releaseSha });
    } else {
      const { spawnSync } = await import("node:child_process");
      const repo = process.env.GITHUB_REPOSITORY;
      const runResult = spawnSync(
        "gh",
        ["api", `repos/${repo}/actions/runs/${runId}`],
        { encoding: "utf8" },
      );
      const jobsResult = spawnSync(
        "gh",
        ["api", `repos/${repo}/actions/runs/${runId}/jobs`],
        { encoding: "utf8" },
      );
      if (runResult.status !== 0 || jobsResult.status !== 0) {
        console.error("Could not read the migration workflow run.");
        evidence = approvalEvidence({ releaseSha });
      } else {
        evidence = evidenceFromActionsPayloads({
          run: JSON.parse(runResult.stdout),
          jobs: JSON.parse(jobsResult.stdout),
          releaseSha,
        });
      }
    }
  }

  const decision = releaseDecision({
    eventName,
    evidenceAccepted: evidence.accepted,
  });
  if (!decision.ready) {
    console.error(
      "Staging release evidence was not accepted: " + evidence.reasons.join(", "),
    );
  }
  console.log(decision.word);
  process.exit(decision.exitCode);
}

const invokedDirectly = process.argv[1]?.endsWith("staging-release-approval.mjs");
if (invokedDirectly) {
  main();
}
