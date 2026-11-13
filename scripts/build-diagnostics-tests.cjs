"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { classifyBuildLog, resourceSnapshot } = require("./report-build-diagnostics.cjs");

test("classifies former build diagnostics and resource failures without exposing log text", () => {
  const cases = [
    ["Failed to fetch font from fonts.googleapis.com", "font"],
    ["Error occurred prerendering page /private", "prerender"],
    ["Module not found: private-module", "module"],
    ["Type error: invalid private value", "type"],
    ["NEXT_PUBLIC_SUPABASE_URL is required", "configuration"],
    ["Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.", "configuration"],
    ["supabaseKey is required.", "configuration"],
    ["FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory", "oom"],
    ["spawn ENOMEM", "oom"],
    ["ENOSPC: no space left on device /private", "disk"],
    ["disk quota exceeded", "disk"],
    ["Next.js build worker exited with code: null and signal: SIGKILL", "worker"],
    ["Next.js build worker exited with code: null and signal: SIGABRT", "worker"],
    ["SIGSEGV", "worker"],
    ["PrismaClientInitializationError: private database URL", "native_engine"],
    ["Failed to load SWC binary for linux/x64", "native_engine"],
    ["ERR_DLOPEN_FAILED: private path", "native_engine"],
    ["fetch failed EAI_AGAIN", "network"],
    ["Unable to acquire lock at private path", "task_lock"],
    ["spawn EAGAIN", "task_lock"],
    ["Failed to compile.", "compile"],
    ["Private error unrecognized", "unknown"],
  ];
  for (const [log, expected] of cases) assert.equal(classifyBuildLog(log).category, expected);
});

test("reports only the latest fixed build phase and known exit signals", () => {
  const result = classifyBuildLog("Compiled successfully\nCollecting page data\nGenerating static pages\nCollecting build traces\nSIGKILL");
  assert.deepEqual(result, { category: "worker", phase: "traces", signal: "SIGKILL", code: "none" });
  assert.equal(classifyBuildLog("", 137).signal, "SIGKILL");
  assert.equal(classifyBuildLog("", 134).signal, "SIGABRT");
  assert.equal(classifyBuildLog("", 139).signal, "SIGSEGV");
  assert.equal(classifyBuildLog("Creating an optimized production build\nCompiled successfully\nRunning TypeScript").phase, "typecheck");
  assert.equal(classifyBuildLog(null).phase, "unknown");
});

test("CLI output cannot forward secrets, filenames, workflow commands or arbitrary exit text", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "build-diagnostic-test-"));
  try {
    const log = path.join(directory, "private-log.txt");
    fs.writeFileSync(log, "secret-marker=DO-NOT-PRINT\n::warning::injected\nCollecting page data\nspawn ENOMEM /private/account\n");
    const result = spawnSync(process.execPath, [path.join(__dirname, "report-build-diagnostics.cjs"), log, "1\n::warning::bad"], { encoding: "utf8" });
    assert.equal(result.status, 0, "reporter does not replace the workflow's build exit code");
    assert.match(result.stdout, /category=oom; phase=page_data; build_exit=1; worker_signal=none; code=ENOMEM/);
    assert.doesNotMatch(result.stdout + result.stderr, /DO-NOT-PRINT|private|::warning::|injected/);
    const missing = spawnSync(process.execPath, [path.join(__dirname, "report-build-diagnostics.cjs"), path.join(directory, "missing"), "137"], { encoding: "utf8" });
    assert.equal(missing.status, 0);
    assert.match(missing.stdout, /category=worker.*worker_signal=SIGKILL/);
    assert.doesNotMatch(missing.stdout + missing.stderr, /missing|ENOENT/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("resource snapshots contain only fixed fields and numeric values", () => {
  const result = resourceSnapshot("attacker supplied label");
  assert.equal(result.phase, "after");
  for (const [key, value] of Object.entries(result)) {
    assert.match(key, /^(phase|total_kib|available_kib|cgroup_(current_bytes|max_bytes|oom|oom_kill)|disk_(total_bytes|available_bytes))$/);
    if (key !== "phase") assert.ok(value === null || (Number.isFinite(value) && value >= 0));
  }
  const cli = spawnSync(process.execPath, [path.join(__dirname, "report-build-diagnostics.cjs"), "--resources", "before"], { encoding: "utf8" });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /^::notice title=Build runner resources::\{"phase":"before",/);
  assert.equal(JSON.parse(cli.stdout.split("::")[2]).phase, "before");
});
