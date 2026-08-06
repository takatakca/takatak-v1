// Phase 14 — Route inventory discovered from src/app (never a stale list).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = "src/app";
const pages: string[] = [];
const apis: string[] = [];

function walk(dir: string, route: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, route + "/" + entry);
    } else if (entry === "page.tsx") {
      pages.push(route === "" ? "/" : route);
    } else if (entry === "route.ts") {
      apis.push(route === "" ? "/" : route);
    }
  }
}
walk(APP, "");
console.log("PAGES (" + pages.length + "):");
for (const p of pages.sort()) console.log("  " + p);
console.log("ROUTE HANDLERS (" + apis.length + "):");
for (const a of apis.sort()) console.log("  " + a);
