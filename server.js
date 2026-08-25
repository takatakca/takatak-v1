"use strict";

// MochaHost / cPanel Node.js Selector entry.
// cPanel runs `node <startup file>` — it does not run `pnpm start`.
const path = require("path");
const fs = require("fs");
const venvModules = "/home/takatakc/nodevenv/app/takatak/22/lib/node_modules";
if (!module.paths.includes(venvModules)) {
  module.paths.unshift(venvModules);
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function forceNoVerifySsl(url) {
  if (!url) return url;
  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]*/gi, "sslmode=no-verify");
  }
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

function sslModeOf(url) {
  const match = String(url || "").match(/sslmode=([^&"]+)/i);
  return match ? match[1] : "unset";
}

const appDir = __dirname;
loadDotEnv(path.join(appDir, ".env"));
process.env.DATABASE_URL = forceNoVerifySsl(process.env.DATABASE_URL);
process.env.DIRECT_URL = forceNoVerifySsl(process.env.DIRECT_URL);
process.env.PGSSL_REJECT_UNAUTHORIZED = "false";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";
const buildDir = path.join(appDir, ".next");

console.error(
  "[server] database url set:",
  Boolean(process.env.DATABASE_URL),
  "sslmode:",
  sslModeOf(process.env.DATABASE_URL),
);

if (!fs.existsSync(buildDir)) {
  console.error(
    "[server] Missing .next. Build on your Mac with `pnpm build`, then upload the .next folder.",
  );
  process.exit(1);
}

const app = next({
  dev: false,
  dir: appDir,
  hostname,
  port,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.error(`[server] TAKATAK ready on ${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("[server] Failed to start Next.js", error);
    process.exit(1);
  });
