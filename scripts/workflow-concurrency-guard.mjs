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
assert.equal(artifact.includes("group: takatak-staging-release\n"), false);
assert.equal(staging.includes("group: takatak-production-artifact-validation\n"), false);
assert.equal(artifact.includes("group: takatak-production-artifact-validation\n"), false);
assert.equal(staging.includes("group: takatak-staging-release\n"), false);

console.log("PASS workflow concurrency groups are isolated by triggering branch");
