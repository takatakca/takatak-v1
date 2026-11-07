#!/usr/bin/env node
/**
 * Read-only public probe for takatak.ca.
 * No credentials, no request body, no customer data.
 * A blocking failure exits 1. Language drift is reported and does not hide an outage.
 */
import tls from "node:tls";
import { pathToFileURL } from "node:url";

const APEX = "takatak.ca";
const WWW = "www.takatak.ca";
const SHA = /^[0-9a-f]{40}$/;

export function assessLiveness(status, body) {
  if (status !== 200 || !body || typeof body !== "object") {
    return fail("apex_liveness", "P1", "health endpoint did not return JSON 200");
  }
  const unexpected = Object.keys(body).filter((key) => !["alive", "app", "status"].includes(key));
  if (unexpected.length) {
    return fail("apex_liveness", "P1", `health response exposes ${unexpected.join(", ")}`);
  }
  if (body.status !== "ok" || body.alive !== true) {
    return fail("apex_liveness", "P1", "health is not alive");
  }
  return pass("apex_liveness", "P1", "minimal health JSON");
}

export function assessReady(status, body, release) {
  const ready = status === 200
    && body?.ok === true
    && body.checks?.database === "ok"
    && body.checks?.supabase === "ok";
  const sha = String(release || "").trim().toLowerCase();
  return [
    ready
      ? pass("apex_ready", "P1", "database and Supabase ok")
      : fail("apex_ready", "P1", `readiness HTTP ${status}`),
    SHA.test(sha)
      ? pass("apex_release", "P1", sha)
      : fail("apex_release", "P1", "X-TAKATAK-Release is missing or not a full SHA"),
  ];
}

export function assessCertificate(host, observation) {
  const id = host === WWW ? "www_certificate" : "apex_certificate";
  if (!observation || observation.authorized !== true) {
    const reason = observation?.authorizationError || observation?.subjectCN || "untrusted";
    return fail(id, "P1", `certificate rejected (${reason})`);
  }
  const names = (observation.altNames || []).map((name) => name.toLowerCase());
  if (!names.includes(host)) {
    return fail(id, "P1", `certificate names ${names.join(", ") || "(none)"}`);
  }
  if (/traefik default cert/i.test(observation.subjectCN || "")) {
    return fail(id, "P1", "Traefik default certificate");
  }
  return pass(id, "P1", `trusted for ${host}`);
}

export function assessAuthGate(finalUrl) {
  let pathname = "";
  try {
    pathname = new URL(finalUrl).pathname;
  } catch {
    return fail("dashboard_gate", "P1", "dashboard response had no URL");
  }
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return pass("dashboard_gate", "P1", "anonymous dashboard returns to login");
  }
  return fail("dashboard_gate", "P1", `anonymous dashboard stayed on ${pathname}`);
}

export function assessPageStatus(id, status) {
  if (status === 200) return pass(id, "P1", "HTTP 200");
  if (!status) return fail(id, "P1", "no HTTP response before TLS or the network failed");
  return fail(id, "P1", `HTTP ${status}`);
}

export function assessLoginLanguage(html) {
  const source = String(html || "");
  if (/Welcome back/i.test(source)) {
    return fail("login_language", "P2", "login?lang=fr still renders Welcome back", false);
  }
  return pass("login_language", "P2", "French login marker not contradicted", false);
}

export function summarize(checks) {
  const flat = checks.flat();
  const blocking = flat.filter((check) => check.blocking && !check.ok).map((check) => check.id);
  return { ok: blocking.length === 0, blocking, checks: flat };
}

function pass(id, severity, detail, blocking = true) {
  return { id, ok: true, severity, blocking, detail };
}

function fail(id, severity, detail, blocking = true) {
  return { id, ok: false, severity, blocking, detail };
}

export async function probeCertificate(host, connect = tls.connect) {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: 10_000,
    }, () => {
      const cert = socket.getPeerCertificate();
      const alt = String(cert.subjectaltname || "");
      resolve({
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        subjectCN: cert.subject?.CN || "",
        altNames: [...alt.matchAll(/DNS:([^,]+)/g)].map((match) => match[1].trim()),
      });
      socket.end();
    });
    socket.on("error", reject);
  });
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function runLiveSmoke({ origin = `https://${APEX}`, fetchImpl = fetch, connect = tls.connect } = {}) {
  const base = origin.replace(/\/$/, "");
  const health = await fetchImpl(`${base}/api/health`, { redirect: "follow" });
  const ready = await fetchImpl(`${base}/api/health/ready`, { redirect: "follow" });
  const login = await fetchImpl(`${base}/login?lang=fr`, { redirect: "follow" });
  const dashboard = await fetchImpl(`${base}/dashboard`, { redirect: "follow" });
  const loginHtml = await login.text();
  const [apexCert, wwwCert] = await Promise.all([
    probeCertificate(APEX, connect),
    probeCertificate(WWW, connect),
  ]);
  let wwwStatus = 0;
  try {
    const www = await fetchImpl(`https://${WWW}/`, { redirect: "manual" });
    wwwStatus = www.status;
  } catch {
    wwwStatus = 0;
  }
  const readyChecks = assessReady(ready.status, await readJson(ready), ready.headers.get("x-takatak-release"));
  return summarize([
    assessLiveness(health.status, await readJson(health)),
    ...readyChecks,
    assessCertificate(APEX, apexCert),
    assessCertificate(WWW, wwwCert),
    assessPageStatus("login_page", login.status),
    assessAuthGate(dashboard.url),
    assessPageStatus("www_http", wwwStatus),
    assessLoginLanguage(loginHtml),
  ]);
}

function writeSummary(report) {
  const lines = [
    "# TAKATAK GUARDIAN — sonde publique",
    "",
    `Résultat : ${report.ok ? "aucune défaillance bloquante" : "défaillance bloquante"}`,
    "",
    "| Contrôle | Gravité | Résultat | Détail |",
    "| --- | --- | --- | --- |",
    ...report.checks.map((check) => `| ${check.id} | ${check.severity} | ${check.ok ? "ok" : "échec"} | ${check.detail} |`),
    "",
  ];
  const markdown = lines.join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    return import("node:fs").then((fs) => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown));
  }
  return Promise.resolve();
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  if (!process.argv.includes("--live")) {
    console.error("Refusing to call production without --live. Unit tests cover the decisions.");
    process.exit(2);
  }
  const report = await runLiveSmoke();
  report.checkedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
  await writeSummary(report);
  process.exit(report.ok ? 0 : 1);
}
