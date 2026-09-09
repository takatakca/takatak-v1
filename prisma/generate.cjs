"use strict";

// Do not run this on MochaHost. CloudLinux nproc is already used by lsnode,
// so `prisma generate` dies with: fork: Resource temporarily unavailable.
// Generate during the Linux production build (or locally) and include the
// generated client in the versioned artifact.
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const initCwd = process.env.INIT_CWD || "";
const home = process.env.HOME || "";
const onMochaHost =
  process.env.PRISMA_SKIP_POSTINSTALL_GENERATE === "1" ||
  cwd.includes("/nodevenv/") ||
  initCwd.includes("/nodevenv/") ||
  cwd.includes("/home/takatakc/") ||
  initCwd.includes("/home/takatakc/") ||
  cwd.includes("/home/bolonca/") ||
  initCwd.includes("/home/bolonca/") ||
  home.includes("/home/takatakc") ||
  home.includes("/home/bolonca") ||
  fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js");

if (onMochaHost) {
  console.log(
    "[prisma-generate] skipped on MochaHost. Use the Linux-built artifact instead.",
  );
  process.exit(0);
}

function firstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const schemaFromHere = path.join(__dirname, "schema.prisma");
const schemaFromInitCwd = process.env.INIT_CWD
  ? path.join(process.env.INIT_CWD, "prisma", "schema.prisma")
  : null;
const schemaFromCwd = path.join(process.cwd(), "prisma", "schema.prisma");
const generatedSchema = path.join(__dirname, "generated", "schema.prisma");

const schema = firstExisting(
  [schemaFromHere, schemaFromInitCwd, schemaFromCwd].filter(Boolean),
);

if (!schema) {
  console.error("[prisma-generate] prisma/schema.prisma was not found.");
  process.exit(1);
}

if (path.resolve(schema) === path.resolve(generatedSchema)) {
  console.error(
    "[prisma-generate] Refusing to generate from prisma/generated/schema.prisma.",
  );
  process.exit(1);
}

const root = path.dirname(path.dirname(schema));
const binName = process.platform === "win32" ? "prisma.cmd" : "prisma";
const localBin = path.join(root, "node_modules", ".bin", binName);
const command = fs.existsSync(localBin) ? localBin : "prisma";

const result = spawnSync(command, ["generate", "--schema", schema], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("[prisma-generate] Failed to start prisma:", result.error.message);
  process.exit(1);
}

if (result.status === 0) {
  const schemaSource = fs.readFileSync(schema, "utf8");
  const checksum = crypto.createHash("sha256").update(schemaSource).digest("hex");
  const stampPath = path.join(root, "node_modules", ".prisma", "client", "takatak-schema.sha256");
  const stampDir = path.dirname(stampPath);
  if (fs.existsSync(stampDir)) {
    fs.writeFileSync(stampPath, `${checksum}\n`);
  }
  fs.writeFileSync(path.join(__dirname, ".generated-schema.sha256"), `${checksum}\n`);
}

process.exit(result.status === null ? 1 : result.status);
