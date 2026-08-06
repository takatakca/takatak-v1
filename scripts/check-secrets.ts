// Phase 14 — Secret scan over git-tracked files. Prints file:line + pattern
// name with the match MASKED; never the full value. Exit 1 on credible finds.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "postgres_url_with_password", re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s"']+/g },
  { name: "openai_key", re: /sk-[a-zA-Z0-9_-]{20,}/g },
  { name: "supabase_service_jwt", re: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g },
  { name: "private_key_block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "bearer_literal", re: /Bearer [A-Za-z0-9._~+\/=-]{25,}/g },
  { name: "aws_access_key", re: /AKIA[0-9A-Z]{16}/g },
];

const EXCLUDE = [/^node_modules\//, /^\.next\//, /^\.git\//, /^prisma\/migrations\//, /\.(png|jpg|ico|svg|zip|lock)$/];
const PLACEHOLDER_FILES = [".env.example"];

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
let findings = 0;
for (const file of files) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const isPlaceholderFile = PLACEHOLDER_FILES.includes(file);
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) {
        if (isPlaceholderFile && m[0].length < 30) continue; // placeholder names
        const masked = m[0].slice(0, 8) + "…[MASKED]";
        console.error(`SECRET? ${file}:${i + 1} [${name}] ${masked}`);
        findings++;
      }
    }
  });
}
if (findings > 0) {
  console.error(`\n${findings} credible finding(s). Failing.`);
  process.exit(1);
}
console.log(`Secret scan clean: ${files.length} tracked files, 0 credible findings.`);
