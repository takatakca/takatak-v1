"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DOCUMENTS = Object.freeze({
  "PROJECT_STATUS.md": [
    /#\s+TAKATAK V1\s+—\s+Project Status/i,
    /## Source of truth/i,
    /## Release \/ live status/i,
  ],
  "TASK_QUEUE.md": [
    /#\s+TAKATAK V1\s+—\s+Executable Task Queue/i,
    /## Safe work cycle/i,
  ],
  "AGENT_HANDOFF.md": [
    /## Repository and immutable baseline/i,
    /## Last completed task and current task/i,
    /## Files modified/i,
    /## Verification performed/i,
    /## Known blockers/i,
    /## Exact next action/i,
    /## Restart model/i,
  ],
  "DEPLOYMENT.md": [
    /## Verified architecture and constraints/i,
    /## Operator prerequisites/i,
    /## Authorized promotion procedure/i,
  ],
  "DECISIONS.md": [
    /## Technical constraints/i,
    /## Decisions pending/i,
  ],
});

function verifyAgentContinuity(root) {
  const errors = [];

  for (const [name, patterns] of Object.entries(DOCUMENTS)) {
    const target = path.join(root, "docs", name);
    let contents;
    try {
      contents = fs.readFileSync(target, "utf8");
    } catch {
      errors.push(`docs/${name} is missing or unreadable`);
      continue;
    }

    if (contents.trim().length < 300) {
      errors.push(`docs/${name} is incomplete (less than 300 characters)`);
    }
    for (const heading of patterns) {
      if (!heading.test(contents)) {
        errors.push(`docs/${name} lacks a required section: ${heading}`);
      }
    }
  }

  return errors;
}

if (require.main === module) {
  const errors = verifyAgentContinuity(process.cwd());
  for (const error of errors) console.error(`FAIL ${error}`);
  if (errors.length) {
    process.exitCode = 1;
  } else {
    console.log("PASS TAKATAK agent continuity files are present and structured");
  }
}

module.exports = { DOCUMENTS, verifyAgentContinuity };
