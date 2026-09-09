"use strict";

// Do not run this on MochaHost. CloudLinux nproc is already used by lsnode,
// so `prisma generate` dies with: fork: Resource temporarily unavailable.
// Generate on your Mac (`pnpm db:generate`) and upload prisma/generated.
const { spawnSync } = require("child_process");
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
  home.includes("/home/takatakc") ||
  fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js");

if (onMochaHost) {
  console.log(
    "[prisma-generate] skipped on MochaHost. Upload prisma/generated from your Mac instead.",
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

const schema = firstExisting(
  [schemaFromHere, schemaFromInitCwd, schemaFromCwd].filter(Boolean),
);

if (!schema) {
  console.error("[prisma-generate] prisma/schema.prisma was not found.");
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
  // Prisma emits `//# sourceMappingURL=client.js.map` without the file.
  // Next.js then logs "Invalid source map ... payload ... null" on errors.
  const runtimeDir = path.join(root, "prisma", "generated", "runtime");
  if (fs.existsSync(runtimeDir)) {
    for (const name of fs.readdirSync(runtimeDir)) {
      if (!name.endsWith(".js")) continue;
      const file = path.join(runtimeDir, name);
      const source = fs.readFileSync(file, "utf8");
      const next = source.replace(/\/\/[#@]\s*sourceMappingURL=.*$/gm, "");
      if (next !== source) {
        fs.writeFileSync(file, next);
      }
    }
  }
}

process.exit(result.status === null ? 1 : result.status);
