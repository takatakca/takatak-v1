#!/usr/bin/env node
"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const tarball = process.argv[2];
if (!tarball || !fs.existsSync(tarball)) {
  console.error("Usage: node scripts/artifact-startup-smoke.cjs <tarball>");
  process.exit(1);
}

const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "takatak-artifact-"));
const port = Number(process.env.ARTIFACT_SMOKE_PORT || 4010);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} failed`);
  }
}

run("tar", ["-xzf", path.resolve(tarball), "-C", extractRoot]);
const appRoot = fs.existsSync(path.join(extractRoot, "app", "server.js"))
  ? path.join(extractRoot, "app")
  : extractRoot;

if (fs.existsSync(path.join(appRoot, ".env"))) {
  throw new Error("Extracted artifact contains .env");
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  HOST: "127.0.0.1",
  DATABASE_URL: "postgresql://ci:ci@127.0.0.1:1/ci",
  DIRECT_URL: "postgresql://ci:ci@127.0.0.1:1/ci",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-anon-key-not-a-secret",
  SUPABASE_SECRET_KEY: "ci-secret-key-not-a-secret",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  HEALTH_DETAILS_ENABLED: "false",
};

delete env.WATCHPACK_POLLING;
delete env.CHOKIDAR_USEPOLLING;

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: pathname.startsWith("/api/auth/") ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: `http://127.0.0.1:${port}`,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"] ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (pathname.startsWith("/api/auth/")) {
      req.write("{}");
    }
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(timeoutMs) {
  const started = Date.now();
  const marker = path.join(appRoot, ".takatak-ready");
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(marker)) {
      return;
    }
    await wait(500);
  }
  throw new Error("Artifact server did not become ready");
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: appRoot,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString("utf8");
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString("utf8");
  process.stderr.write(chunk);
});

let failed = 0;
function assert(name, ok, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

(async () => {
  try {
    await waitForReady(120_000);
    assert("server.js starts using the artifact only", true);

    const prismaClient = path.join(appRoot, "node_modules", "@prisma", "client");
    const adapter = path.join(appRoot, "node_modules", "@prisma", "adapter-pg");
    assert("Prisma resolves normally", fs.existsSync(prismaClient));
    assert("@prisma/adapter-pg resolves normally", fs.existsSync(adapter));
    assert(
      "no symbolic compatibility aliases",
      !fs.existsSync(path.join(appRoot, "node_modules", "@prisma", "client-4e554655281e05c3")) &&
        !fs.existsSync(path.join(appRoot, "node_modules", "@prisma", "adapter-pg-2ab9e4e8f21aacc1")),
    );

    const health = await request("/api/health");
    assert("GET /api/health responds", health.status === 200);
    assert(
      "GET /api/health is JSON",
      health.contentType.includes("application/json"),
    );

    const ready = await request("/api/health/ready");
    assert(
      "GET /api/health/ready responds appropriately",
      ready.status === 200 || ready.status === 503,
    );
    assert(
      "GET /api/health/ready is JSON",
      ready.contentType.includes("application/json"),
    );

    const login = await request("/api/auth/login");
    assert(
      "authentication endpoints return application/json",
      login.contentType.includes("application/json") && login.status >= 400 && login.status < 500,
    );

    const pid = child.pid;
    child.kill("SIGTERM");
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    assert("the process terminates cleanly", exited);
    if (!exited && pid) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    assert(
      "no Passenger-style restart loop is created",
      !/restarting|EADDRINUSE/i.test(output),
    );
  } catch (error) {
    failed += 1;
    console.error(
      "  FAIL artifact startup",
      error instanceof Error ? error.message : error,
    );
    if (child.pid) {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        // ignore
      }
    }
  } finally {
    fs.rmSync(extractRoot, { recursive: true, force: true });
    process.exit(failed > 0 ? 1 : 0);
  }
})();
