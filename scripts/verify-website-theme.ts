// Every theme colour class the public website uses (bg-primary,
// text-muted-foreground, …) must be registered in the Tailwind entry
// stylesheet, otherwise Tailwind silently generates nothing for it.
// Run: npm run qa:website-theme
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TOKENS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground", "border", "input", "ring",
  "success", "warning",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx|ts)$/.test(name) ? [path] : [];
  });
}

const globals = readFileSync("src/app/globals.css", "utf8");
const registered = new Set([...globals.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));

const used = new Set<string>();
const pattern = new RegExp(
  `(?:^|[\\s"'\`:])(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow)-(${TOKENS.join("|")})(?=[\\s"'\`/]|$)`,
  "gm",
);
for (const file of [...files("src/components/website"), ...files("src/app/(website)"), ...files("src/components/auth")]) {
  for (const match of readFileSync(file, "utf8").matchAll(pattern)) used.add(match[1]);
}

const missing = [...used].filter((token) => !registered.has(token)).sort();
assert.ok(used.size > 5, "expected the website to use theme colour classes");
assert.deepEqual(missing, [], `theme colours used but not registered in globals.css: ${missing.join(", ")}`);
const website = readFileSync("src/app/(website)/website.css", "utf8");
assert.doesNotMatch(website, /@theme\s+(inline\s*)?\{/, "declare theme tokens in globals.css, not website.css");
console.log(`Website theme: ${used.size} colour tokens used, all registered in globals.css.`);
