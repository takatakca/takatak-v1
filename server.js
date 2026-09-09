"use strict";

// MochaHost / cPanel Node.js Selector + Phusion Passenger entry.
// cPanel runs `node <startup file>`. Do not spawn extra servers or watchers.
const path = require("path");
const fs = require("fs");

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

function hasEnv(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function validateEssentialEnv() {
  const missing = [];
  if (!hasEnv("DATABASE_URL")) missing.push("DATABASE_URL");
  if (!hasEnv("NEXT_PUBLIC_SUPABASE_URL")) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!hasEnv("SUPABASE_SECRET_KEY") && !hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    missing.push("SUPABASE_SECRET_KEY");
  }
  return missing;
}

function sanitizeFatal(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DB_URL]")
    .replace(/eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g, "[REDACTED]")
    .slice(0, 300);
}

const appDir = __dirname;
loadDotEnv(path.join(appDir, ".env"));
process.env.NODE_ENV = "production";
process.env.DATABASE_URL = forceNoVerifySsl(process.env.DATABASE_URL);
process.env.DIRECT_URL = forceNoVerifySsl(process.env.DIRECT_URL);
if (process.env.PGSSL_REJECT_UNAUTHORIZED === undefined) {
  process.env.PGSSL_REJECT_UNAUTHORIZED = "false";
}

const passenger =
  typeof PhusionPassenger !== "undefined" ? PhusionPassenger : null;
if (passenger && typeof passenger.configure === "function") {
  passenger.configure({ autoInstall: false });
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = passenger ? "passenger" : Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";
const buildDir = path.join(appDir, ".next");
const readyMarker = path.join(appDir, ".takatak-ready");

try {
  fs.unlinkSync(readyMarker);
} catch {
  // First boot has no marker.
}

console.error(
  "[server] database url set:",
  Boolean(process.env.DATABASE_URL),
  "sslmode:",
  sslModeOf(process.env.DATABASE_URL),
  "passenger:",
  Boolean(passenger),
);

const missing = validateEssentialEnv();
if (missing.length > 0) {
  console.error("[server] Missing essential environment variables:", missing.join(", "));
}

if (!fs.existsSync(buildDir)) {
  console.error(
    "[server] Missing .next. Deploy the complete Linux production artifact, not a Mac .next folder.",
  );
  process.exit(1);
}

if (process.env.WATCHPACK_POLLING || process.env.CHOKIDAR_USEPOLLING) {
  delete process.env.WATCHPACK_POLLING;
  delete process.env.CHOKIDAR_USEPOLLING;
}

const app = next({
  dev: false,
  dir: appDir,
  hostname: passenger ? undefined : hostname,
  port: passenger ? undefined : port,
});
const handle = app.getRequestHandler();

let server;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(`[server] ${signal} received, shutting down`);
  try {
    fs.unlinkSync(readyMarker);
  } catch {
    // ignore
  }
  const finish = () => {
    process.exit(0);
  };
  if (server) {
    server.close(finish);
    setTimeout(finish, 8_000).unref();
  } else {
    finish();
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  console.error("[server] uncaughtException", sanitizeFatal(error));
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (error) => {
  console.error("[server] unhandledRejection", sanitizeFatal(error));
});

app
  .prepare()
  .then(() => {
    server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    const listenArgs = passenger
      ? ["passenger"]
      : [port, hostname];

    server.listen(...listenArgs, () => {
      fs.writeFileSync(readyMarker, `${Date.now()}\n`);
      console.error(
        passenger
          ? "[server] TAKATAK ready behind Phusion Passenger"
          : `[server] TAKATAK ready on ${hostname}:${port}`,
      );
    });
  })
  .catch((error) => {
    console.error("[server] Failed to start Next.js", sanitizeFatal(error));
    process.exit(1);
  });
