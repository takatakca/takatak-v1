#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const appRoot = fs.existsSync(path.join(root, "server.js"))
  ? root
  : path.join(root, "app");
const metadataFile = fs.existsSync(path.join(root, "build-metadata.json"))
  ? path.join(root, "build-metadata.json")
  : path.join(path.dirname(appRoot), "build-metadata.json");

let failed = 0;
const manifest = [];

function assert(name, ok, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

function walk(dir, prefix = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") {
      const stat = fs.statSync(path.join(dir, entry.name));
      manifest.push({
        path: path.join(prefix, entry.name).replace(/\\/g, "/"),
        bytes: stat.size,
        kind: "dir",
      });
      continue;
    }
    const full = path.join(dir, entry.name);
    const relative = path.join(prefix, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walk(full, relative);
      continue;
    }
    const stat = fs.statSync(full);
    manifest.push({ path: relative, bytes: stat.size, kind: "file" });
  }
}

console.log(`[artifact-audit] ${appRoot}`);
walk(appRoot, "");
if (fs.existsSync(metadataFile)) {
  const stat = fs.statSync(metadataFile);
  manifest.push({
    path: "build-metadata.json",
    bytes: stat.size,
    kind: "file",
  });
}

const paths = new Set(manifest.map((item) => item.path));
const has = (relative) =>
  paths.has(relative) || fs.existsSync(path.join(appRoot, relative));

assert("server.js", has("server.js"));
assert("package.json", has("package.json"));
assert("package-lock.json", has("package-lock.json"));
assert(".next production output", fs.existsSync(path.join(appRoot, ".next")));
assert(".next/static", fs.existsSync(path.join(appRoot, ".next", "static")));
assert("public", fs.existsSync(path.join(appRoot, "public")));
assert(
  "generated Prisma runtime",
  fs.existsSync(path.join(appRoot, "node_modules", ".prisma", "client")) ||
    fs.existsSync(path.join(appRoot, "node_modules", "@prisma", "client")),
);
assert(
  "required production node_modules",
  fs.existsSync(path.join(appRoot, "node_modules", "@prisma", "adapter-pg")) &&
    fs.existsSync(path.join(appRoot, "node_modules", "next")),
);
assert("prisma/schema.prisma", has("prisma/schema.prisma"));
assert(
  "required deployment/preflight scripts",
  fs.existsSync(path.join(appRoot, "scripts", "production-preflight.ts")),
);
assert("BUILD_ID", has("BUILD_ID"));
assert("build-metadata.json", fs.existsSync(metadataFile));

const forbiddenNames = manifest.filter((item) => {
  const base = path.basename(item.path);
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    item.path === ".git" ||
    item.path.startsWith(".git/") ||
    item.path.includes("/.git/") ||
    item.path.startsWith(".next/cache") ||
    item.path.startsWith(".next/dev")
  );
});
assert(
  "excludes env files, git history, and dev caches",
  forbiddenNames.length === 0,
  forbiddenNames
    .slice(0, 5)
    .map((item) => item.path)
    .join(", "),
);

const hashedPrisma = manifest.some((item) =>
  /@prisma\/(?:client|adapter-pg)-[0-9a-f]{8,}/i.test(item.path),
);
assert("no hashed Prisma package folders", !hashedPrisma);

const secretNamed = manifest.filter((item) =>
  /(credentials|otp-secret|service_role|api[-_]?key)/i.test(item.path),
);
assert(
  "no credential filenames",
  secretNamed.length === 0,
  secretNamed
    .slice(0, 5)
    .map((item) => item.path)
    .join(", "),
);

console.log("--- artifact manifest (paths and sizes only) ---");
const printable = manifest
  .filter((item) => item.kind === "file" && !item.path.startsWith("node_modules/"))
  .sort((a, b) => a.path.localeCompare(b.path));
for (const item of printable) {
  console.log(`${item.bytes}\t${item.path}`);
}
const nodeModules = manifest.find((item) => item.path === "node_modules");
if (nodeModules) {
  console.log(`${nodeModules.bytes}\tnode_modules`);
}
console.log(`--- ${printable.length} app files, sizes in bytes ---`);

if (failed > 0) {
  process.exit(1);
}
