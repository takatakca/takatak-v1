import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HASHED_PRISMA_PATTERN =
  /@prisma\/(?:client|adapter-pg)-[0-9a-f]{8,}/gi;

const CRITICAL_ROUTE_HINTS = [
  "api/auth/login",
  "api/auth/verify-otp",
  "api/auth/register",
  "api/billing/stripe/webhook",
  "api/social/callback",
];

export function findHashedPrismaAliases(source: string): string[] {
  return [...new Set(source.match(HASHED_PRISMA_PATTERN) ?? [])];
}

export function scanDirectoryForHashedPrismaAliases(
  root: string,
): { file: string; aliases: string[] }[] {
  const hits: { file: string; aliases: string[] }[] = [];
  if (!fs.existsSync(root)) {
    return hits;
  }

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        if (
          entry === "node_modules" ||
          entry === "cache" ||
          entry === "dev" ||
          entry === "types"
        ) {
          continue;
        }
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (!/\.(js|mjs|cjs|json)$/.test(current)) continue;
    const source = fs.readFileSync(current, "utf8");
    const aliases = findHashedPrismaAliases(source);
    if (aliases.length > 0) {
      hits.push({ file: path.relative(root, current), aliases });
    }
  }
  return hits;
}

export function schemaChecksum(schemaPath: string): string {
  return createHash("sha256")
    .update(fs.readFileSync(schemaPath))
    .digest("hex")
    .trim();
}

export { CRITICAL_ROUTE_HINTS };
