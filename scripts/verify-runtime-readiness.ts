import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isRuntimeReady,
  type RequiredReadinessState,
} from "../src/lib/ops/runtime-readiness";

const states: RequiredReadinessState[] = [
  "ok",
  "unavailable",
  "not_configured",
];

for (const database of states) {
  for (const supabase of states) {
    assert.equal(
      isRuntimeReady({ database, supabase }),
      database === "ok" && supabase === "ok",
      `database=${database}, supabase=${supabase} must fail closed`,
    );
  }
}

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/health/ready/route.ts"),
  "utf8",
);
const dockerCheck = readFileSync(
  resolve(process.cwd(), "scripts/container-healthcheck.cjs"),
  "utf8",
);
assert.match(route, /isRuntimeReady\(\{ database, supabase \}\)/);
assert.match(route, /\{ status: ok \? 200 : 503 \}/);
assert.match(route, /"Cache-Control", "no-store"/);
assert.match(dockerCheck, /data\?\.checks\?\.database !== "ok"/);
assert.match(dockerCheck, /data\?\.checks\?\.supabase !== "ok"/);

console.log("PASS 9 strict database/Auth readiness combinations and Coolify container contract");
