"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const workflow = fs.readFileSync(".github/workflows/release-production.yml", "utf8");
const lines = workflow.split(/\r?\n/);
const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
const scripts = [fs.readFileSync("deploy/linux/promote-production.sh", "utf8")];
for (let index = 0; index < lines.length; index += 1) {
  const match = lines[index].match(/^(\s*)run: (.*)$/);
  if (!match) continue;
  if (match[2] !== "|") { scripts.push(match[2]); continue; }
  const indent = match[1].length + 2;
  const block = [];
  while (index + 1 < lines.length && (!lines[index + 1].trim() || lines[index + 1].startsWith(" ".repeat(indent)))) {
    index += 1;
    block.push(lines[index].slice(indent));
  }
  scripts.push(block.join("\n"));
}
if (!workflow.includes("default: validate") || !workflow.includes("if: github.ref == 'refs/heads/main'") || !workflow.includes("environment: production") || !workflow.includes("cancel-in-progress: false")) throw new Error("Manual production safety contract is missing");
if (/^\s{2}(push|workflow_run|schedule):/m.test(workflow)) throw new Error("Production promotion must never run automatically");
if (/StrictHostKeyChecking\s+no|set -x|prisma migrate|npm install|npm ci/.test(workflow)) throw new Error("Production promotion contains a forbidden shortcut");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "takatak-workflow-"));
try {
  for (const [index, script] of scripts.entries()) {
    const file = path.join(temporary, `script-${index}.sh`);
    fs.writeFileSync(file, script);
    const result = spawnSync(bash, ["--noprofile", "--norc", "-n", file.replaceAll("\\", "/")], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Bash syntax failed for promotion script ${index}: ${result.stderr || result.error?.message || "unknown failure"}`);
  }
  console.log(`Manual production contract and ${scripts.length} Bash scripts passed syntax checks.`);
} finally {
  const resolved = path.resolve(temporary);
  if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}takatak-workflow-`)) throw new Error("Refusing unrelated temporary cleanup");
  fs.rmSync(resolved, { recursive: true, force: true });
}
