#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const required = [
  "src/lib/auth/otp/reservation.ts",
  "src/lib/auth/parse-auth-response.ts",
  "src/lib/ops/compiled-modules.ts",
  "src/lib/ops/env-preflight.ts",
  "src/lib/security/authenticated-identity.ts",
  "scripts/identity-isolation-tests.ts",
  "scripts/pack-production-artifact.cjs",
  "server.js",
  "package-lock.json",
  "prisma/schema.prisma",
];

let failed = 0;

function assert(name, ok, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

console.log("[required-sources] auth/deploy repair files");

for (const relative of required) {
  const full = path.join(root, relative);
  assert(`${relative} exists`, fs.existsSync(full));
  if (process.env.CHECK_GIT_TRACKED === "1" && fs.existsSync(full)) {
    try {
      execFileSync("git", ["ls-files", "--error-unmatch", relative], {
        cwd: root,
        stdio: "pipe",
      });
      assert(`${relative} is tracked`, true);
    } catch {
      assert(
        `${relative} is tracked`,
        false,
        "untracked required source would be omitted from CI checkout",
      );
    }
  }
}

if (failed > 0) {
  process.exit(1);
}
