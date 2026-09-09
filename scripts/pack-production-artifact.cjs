#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createHash } = require("crypto");

const root = process.cwd();

if (process.platform === "darwin" && process.env.ALLOW_DARWIN_ARTIFACT !== "1") {
  throw new Error(
    "Refusing to pack a macOS production artifact. Use Linux CI (Node 22.23.x) or set ALLOW_DARWIN_ARTIFACT=1 for a local diagnostic pack.",
  );
}

const buildId =
  process.env.TAKATAK_BUILD_ID ||
  new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const outRoot = path.join(root, "var", "artifacts", buildId);
const stage = path.join(outRoot, "app");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function copy(from, to, options = {}) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    filter(src) {
      const name = path.basename(src);
      if (name === ".git") return false;
      if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) {
        return false;
      }
      if (options.excludeNextCaches) {
        const relative = path.relative(from, src);
        const top = relative.split(path.sep)[0];
        if (top === "cache" || top === "dev") return false;
      }
      return true;
    },
  });
}

function mustExist(file, label) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${label}: ${file}`);
  }
}

function failIfSecret(file) {
  if (fs.existsSync(file)) {
    throw new Error(`Refusing to pack secret file ${file}`);
  }
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

mustExist(path.join(root, "package.json"), "package.json");
mustExist(path.join(root, "package-lock.json"), "package-lock.json");
mustExist(path.join(root, "prisma", "schema.prisma"), "canonical Prisma schema");
mustExist(path.join(root, ".next"), "compiled Next.js output");
mustExist(path.join(root, "server.js"), "Passenger entry");
mustExist(path.join(root, "public"), "public assets");

failIfSecret(path.join(root, ".env"));
failIfSecret(path.join(root, ".env.production"));
failIfSecret(path.join(root, ".env.local"));

const include = [
  ".next",
  "public",
  "prisma/schema.prisma",
  "prisma/migrations",
  "prisma/generate.cjs",
  "prisma/.generated-schema.sha256",
  "server.js",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "scripts/production-preflight.ts",
  "scripts/check-module-load.ts",
  "scripts/check-compiled-modules.ts",
  "scripts/smoke-auth-json.ts",
  "scripts/audit-production-artifact.cjs",
];

for (const relative of include) {
  const from = path.join(root, relative);
  if (!fs.existsSync(from)) continue;
  copy(from, path.join(stage, relative), {
    excludeNextCaches: relative === ".next",
  });
}

copy(path.join(root, "node_modules"), path.join(stage, "node_modules"));

const metadata = {
  buildId,
  createdAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  nextBuild: "webpack",
  prismaGenerator: "prisma-client-js engineType=client",
};
fs.writeFileSync(
  path.join(outRoot, "build-metadata.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
fs.writeFileSync(path.join(stage, "BUILD_ID"), `${buildId}\n`);

const packedEnv = path.join(stage, ".env");
if (fs.existsSync(packedEnv)) {
  throw new Error("Artifact unexpectedly contains .env");
}

const hashedScan = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(root, "scripts/check-compiled-modules.ts")],
  { cwd: stage, encoding: "utf8" },
);
if (hashedScan.status !== 0) {
  throw new Error("Artifact compiled-module check failed");
}

const tarball = path.join(outRoot, `takatak-${buildId}.tar.gz`);
run("tar", [
  "-czf",
  tarball,
  "-C",
  outRoot,
  "app",
  "build-metadata.json",
]);

const sha = createHash("sha256");
sha.update(fs.readFileSync(tarball));
fs.writeFileSync(`${tarball}.sha256`, `${sha.digest("hex")}  ${path.basename(tarball)}\n`);

const audit = spawnSync(
  process.execPath,
  [path.join(root, "scripts/audit-production-artifact.cjs"), outRoot],
  { cwd: root, stdio: "inherit" },
);
if (audit.status !== 0) {
  throw new Error("Artifact content audit failed");
}

console.log(`Packed ${tarball}`);
