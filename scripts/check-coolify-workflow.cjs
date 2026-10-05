"use strict";

const fs = require("node:fs");

const source = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const dockerfile = fs.readFileSync("Dockerfile", "utf8");
let failed = 0;

function assert(name, ok) {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}`);
}

const qualityAt = source.indexOf("linux-quality-and-artifact:");
const coolifyAt = source.indexOf("coolify-deploy-gate:");
const coolify = coolifyAt === -1 ? "" : source.slice(coolifyAt);

assert("quality job exists", qualityAt !== -1);
assert("coolify gate exists after the quality job", coolifyAt > qualityAt);
assert("coolify gate needs the quality job", coolify.includes("needs: linux-quality-and-artifact"));
assert("coolify gate requires success", coolify.includes("success()"));
assert("coolify gate is push to main only", coolify.includes("refs/heads/main"));
assert("install is npm ci", source.includes("npm ci --ignore-scripts=false"));
assert("prisma generate is in CI", source.includes("npm run db:generate"));
assert("typecheck is in CI", source.includes("npm run typecheck"));
assert("lint is in CI", source.includes("npm run lint"));
assert("queue QA is in CI", source.includes("npm run qa:queue"));
assert("production build is in CI", source.includes("npm run build"));
assert(
  "build step is before the coolify gate",
  source.indexOf("npm run build") !== -1 && source.indexOf("npm run build") < coolifyAt,
);
assert("missing Coolify secrets do not fail the gate", coolify.includes("exit 0"));
assert("coolify job does not hardcode a webhook URL", !coolify.includes("https://"));
assert("dockerfile pins Node 22.23.2", dockerfile.includes("node:22.23.2-bookworm-slim"));
assert("dockerfile installs from the lockfile", dockerfile.includes("npm ci --ignore-scripts=false"));
assert("dockerfile generates Prisma", dockerfile.includes("npm run db:generate"));
assert("dockerfile builds Next", dockerfile.includes("npm run build"));
assert("dockerfile runs as node", dockerfile.includes("USER node"));
assert("dockerfile health check is the role script", dockerfile.includes("scripts/container-healthcheck.cjs"));
assert("dockerfile refuses a copied env file", dockerfile.includes("test ! -e .env"));
assert("dockerfile does not bake a production app URL", !dockerfile.includes("https://takatak.ca"));

if (failed > 0) {
  console.error(`[workflow] ${failed} failed`);
  process.exit(1);
}
console.log("[workflow] passed");
