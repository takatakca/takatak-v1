import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const artifact = readFileSync(".github/workflows/validate-production-artifact.yml", "utf8");
const staging = readFileSync(".github/workflows/release-staging.yml", "utf8");

assert.match(
  artifact,
  /group: takatak-production-artifact-validation-\$\{\{ github\.event\.workflow_run\.head_branch/,
);
assert.match(
  staging,
  /group: takatak-staging-release-\$\{\{ github\.event\.workflow_run\.head_branch/,
);
// A run that only skips must not share main's group: a new run cancels the
// in-progress one (staging) or replaces the pending one (all groups).
const migrations = readFileSync(".github/workflows/reconcile-staging-migrations.yml", "utf8");
const production = readFileSync(".github/workflows/coolify-production-deploy.yml", "utf8");
const skipGroup = "&& format('-skip-{0}', github.run_id) || '' }}";
assert.match(staging, /group: takatak-staging-release-.*github\.event\.workflow_run\.conclusion != 'success'/);
for (const [name, source] of [["staging", staging], ["migrations", migrations], ["production", production]]) {
  const group = source.split("\n").find((line) => line.trim().startsWith("group:")) ?? "";
  assert.ok(group.endsWith(skipGroup), `${name}: a skipped run gets its own concurrency group`);
}
assert.match(migrations, /group: takatak-staging-migrations\$\{\{[^\n]*head_branch != 'main'/);
assert.match(production, /group: takatak-coolify-production\$\{\{[^\n]*head_branch != 'main'/);
assert.match(migrations, /cancel-in-progress: false/);
assert.match(production, /cancel-in-progress: false/);
assert.equal(artifact.includes("group: takatak-staging-release\n"), false);
assert.equal(staging.includes("group: takatak-production-artifact-validation\n"), false);
assert.equal(artifact.includes("group: takatak-production-artifact-validation\n"), false);
assert.equal(staging.includes("group: takatak-staging-release\n"), false);

console.log("PASS workflow concurrency groups are isolated by triggering branch, and skipped runs cannot cancel main");
