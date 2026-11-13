import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { assessLiveReadiness } from "./readiness-contract.mjs";

const healthy = {
  ok: true,
  checks: { process: "ok", database: "ok", supabase: "ok" },
};

test("readiness must verify status and every mandatory dependency", () => {
  assert.equal(assessLiveReadiness({ status: 200, json: healthy }).ok, true);
  for (const status of [0, 301, 401, 500, 503]) {
    assert.equal(
      assessLiveReadiness({ status, json: healthy }).ok,
      false,
      `HTTP ${status} must fail even with a forged ok payload`,
    );
  }
  assert.equal(assessLiveReadiness({ status: 200, json: null }).ok, false);
  assert.equal(assessLiveReadiness({ status: 200, json: { ok: true } }).ok, false);
  for (const key of ["process", "database", "supabase"]) {
    for (const state of ["unavailable", "not_configured", undefined]) {
      assert.equal(
        assessLiveReadiness({
          status: 200,
          json: { ok: true, checks: { ...healthy.checks, [key]: state } },
        }).ok,
        false,
        `${key}=${state} must fail closed`,
      );
    }
  }
});

const dir = mkdtempSync(join(tmpdir(), "takatak-passive-health-"));
const fixture = join(dir, "mock-fetch.mjs");
const mock = `
const failStatus = Number(process.env.READINESS_TEST_HTTP_STATUS || "200");
globalThis.fetch = async (input, init = {}) => {
  const target = new URL(input);
  const method = init.method || "GET";
  console.log("MOCK_FETCH", method, target.pathname);
  const path = target.pathname;
  if (path === "/api/health/ready") {
    return new Response(JSON.stringify({
      ok: true,
      checks: { process: "ok", database: "ok", supabase: "ok" },
    }), {
      status: failStatus,
      headers: {
        "Content-Type": "application/json",
        ...(process.env.READINESS_TEST_RELEASE_SHA
          ? { "X-TAKATAK-Release": process.env.READINESS_TEST_RELEASE_SHA }
          : {}),
      },
    });
  }
  if (path === "/api/auth/login")
    return new Response(JSON.stringify({ code: "email_not_found" }), { status: 404 });
  if (path === "/takatak-analytics.js")
    return new Response("console.log('mock');", { status: 200 });
  if (path === "/api/ai/credits/balance" || path === "/api/cron/growth-agents")
    return new Response("{}", { status: 401 });
  if (path.startsWith("/api/billing/"))
    return new Response("{}", { status: 400 });
  return new Response("<html><body>mock login</body></html>", { status: 200 });
};
`;
writeFileSync(fixture, mock);

function probe(extraArgs = [], env = {}) {
  return spawnSync(
    process.execPath,
    [
      "--import", pathToFileURL(fixture).href,
      resolve(process.cwd(), "scripts/ops/live-readiness.mjs"),
      "--origin", "https://takatak.ca", ...extraArgs,
    ],
    {
      encoding: "utf8",
      timeout: 12_000,
      env: { ...process.env, ...env },
    },
  );
}

try {
  test("default live probe uses no POST and reports health strictly", () => {
    const run = probe();
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /OK\s+health/);
    assert.doesNotMatch(run.stdout, /MOCK_FETCH POST /);
    assert.match(run.stdout, /login POST skipped/);
    assert.match(run.stdout, /active endpoint probes skipped/);
  });

  test("HTTP 503 with ok=true fails the passive probe", () => {
    const run = probe([], { READINESS_TEST_HTTP_STATUS: "503" });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stdout, /FAIL\s+health.*HTTP 503/);
  });

  test("explicit active probe opt-in can exercise synthetic POST checks", () => {
    const run = probe(["--active-probes"]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /MOCK_FETCH POST \/api\/auth\/login/);
    assert.match(run.stdout, /MOCK_FETCH POST \/api\/billing\/growth\/webhook/);
  });

  test("expect-sha fails closed on absent or mismatched attestation", () => {
    const sha = "a".repeat(40);
    const match = probe(["--expect-sha", sha], {
      READINESS_TEST_RELEASE_SHA: sha,
    });
    assert.equal(match.status, 0, match.stdout + match.stderr);
    assert.match(match.stdout, /OK\s+release SHA.*exact/);
    assert.doesNotMatch(match.stdout, /MOCK_FETCH POST /);

    const mismatch = probe(["--expect-sha", sha], {
      READINESS_TEST_RELEASE_SHA: "b".repeat(40),
    });
    assert.equal(mismatch.status, 1, mismatch.stdout + mismatch.stderr);
    assert.match(mismatch.stdout, /FAIL\s+release SHA/);

    const missing = probe(["--expect-sha", sha]);
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.match(missing.stdout, /release header missing/);

    const malformed = probe(["--expect-sha", "bad"]);
    assert.equal(malformed.status, 2, malformed.stdout + malformed.stderr);
    assert.doesNotMatch(malformed.stdout, /MOCK_FETCH/);
  });

  test("script must not silently enable active mode", () => {
    const code = readFileSync(
      resolve(process.cwd(), "scripts/ops/live-readiness.mjs"), "utf8",
    );
    assert.match(code, /process\.argv\.includes\("--active-probes"\)/);
    assert.match(code, /assessLiveReadiness\(ready\)/);
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/health/ready/route.ts"), "utf8",
    );
    assert.ok(route.includes("process.env.SOURCE_COMMIT"));
    assert.ok(route.includes('"X-TAKATAK-Release"'));
  });
} finally {
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
}
