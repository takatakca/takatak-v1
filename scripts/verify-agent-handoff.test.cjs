"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DOCUMENTS, verifyAgentContinuity } = require("./verify-agent-handoff.cjs");

const FIXTURE_HEADINGS = Object.freeze({
  "PROJECT_STATUS.md": ["# TAKATAK V1 — Project Status", "## Source of truth", "## Release / live status"],
  "TASK_QUEUE.md": ["# TAKATAK V1 — Executable Task Queue", "## Safe work cycle"],
  "AGENT_HANDOFF.md": ["## Repository and immutable baseline", "## Last completed task and current task", "## Files modified", "## Verification performed", "## Known blockers", "## Exact next action", "## Restart model"],
  "DEPLOYMENT.md": ["## Verified architecture and constraints", "## Operator prerequisites", "## Authorized promotion procedure"],
  "DECISIONS.md": ["## Technical constraints", "## Decisions pending"],
});

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "takatak-handoff-"));
  const docs = path.join(root, "docs");
  fs.mkdirSync(docs);
  for (const name of Object.keys(DOCUMENTS)) {
    fs.writeFileSync(
      path.join(docs, name),
      FIXTURE_HEADINGS[name].join("\n") + "\n" + "Continuity notes. ".repeat(25),
    );
  }
  return root;
}

test("repository continuity docs are complete", () => {
  assert.deepEqual(verifyAgentContinuity(process.cwd()), []);
});

test("the guard catches missing and short documents", (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(verifyAgentContinuity(root), []);
  fs.rmSync(path.join(root, "docs", "AGENT_HANDOFF.md"));
  assert.ok(verifyAgentContinuity(root).some((x) => x.includes("AGENT_HANDOFF.md")));
  fs.writeFileSync(path.join(root, "docs", "AGENT_HANDOFF.md"), "stub");
  assert.ok(verifyAgentContinuity(root).some((x) => x.includes("incomplete")));
});

test("the guard catches missing essential handoff sections", (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const name = path.join(root, "docs", "AGENT_HANDOFF.md");
  fs.writeFileSync(name, "Generic status without headings. ".repeat(30));
  assert.ok(verifyAgentContinuity(root).some((x) => x.includes("required section")));
});
