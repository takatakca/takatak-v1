import assert from "node:assert/strict";
import test from "node:test";

import {
  assessAuthGate,
  assessCertificate,
  assessLiveness,
  assessLoginLanguage,
  assessPageStatus,
  assessReady,
  summarize,
} from "./guardian-public-smoke.mjs";

const SHA = "6488d57e24885011034ff95b3578646f39d86ce6";

test("production health stays minimal", () => {
  assert.equal(assessLiveness(200, { status: "ok", app: "TAKATAK", alive: true }).ok, true);
  const leaked = assessLiveness(200, { status: "ok", alive: true, checks: { database: "ok" } });
  assert.equal(leaked.ok, false);
  assert.match(leaked.detail, /exposes/);
});

test("readiness requires both dependencies and a full release SHA", () => {
  const ok = assessReady(200, { ok: true, checks: { database: "ok", supabase: "ok" } }, SHA);
  assert.equal(ok.every((check) => check.ok), true);
  const degraded = assessReady(503, { ok: false, checks: { database: "unavailable", supabase: "ok" } }, SHA);
  assert.equal(degraded.find((check) => check.id === "apex_ready").ok, false);
  assert.equal(degraded.find((check) => check.id === "apex_release").ok, true);
  const missing = assessReady(200, { ok: true, checks: { database: "ok", supabase: "ok" } }, "");
  assert.equal(missing.some((check) => check.id === "apex_release" && !check.ok), true);
});

test("www must present a trusted certificate for that exact name", () => {
  const traefik = assessCertificate("www.takatak.ca", {
    authorized: false,
    authorizationError: "self signed certificate",
    subjectCN: "TRAEFIK DEFAULT CERT",
    altNames: ["39bbddf.traefik.default"],
  });
  assert.equal(traefik.ok, false);
  assert.equal(traefik.blocking, true);
  const apexOnly = assessCertificate("www.takatak.ca", {
    authorized: true,
    subjectCN: "takatak.ca",
    altNames: ["takatak.ca"],
  });
  assert.equal(apexOnly.ok, false);
  const trusted = assessCertificate("takatak.ca", {
    authorized: true,
    subjectCN: "takatak.ca",
    altNames: ["takatak.ca"],
  });
  assert.equal(trusted.ok, true);
});

test("anonymous dashboard must land on login", () => {
  assert.equal(assessAuthGate("https://takatak.ca/login?next=%2Fdashboard").ok, true);
  assert.equal(assessAuthGate("https://takatak.ca/dashboard").ok, false);
});

test("English login on a French URL is visible but not an outage", () => {
  const language = assessLoginLanguage("<h1>Welcome back</h1>");
  assert.equal(language.ok, false);
  assert.equal(language.blocking, false);
  const report = summarize([
    { id: "apex_liveness", ok: true, severity: "P1", blocking: true, detail: "ok" },
    language,
  ]);
  assert.equal(report.ok, true);
  assert.deepEqual(report.blocking, []);
});

test("a missing HTTP status stays blocking and readable", () => {
  const missing = assessPageStatus("www_http", 0);
  assert.equal(missing.ok, false);
  assert.match(missing.detail, /TLS/);
});

test("a blocking failure fails the run", () => {
  const report = summarize([
    { id: "www_certificate", ok: false, severity: "P1", blocking: true, detail: "default cert" },
  ]);
  assert.equal(report.ok, false);
  assert.deepEqual(report.blocking, ["www_certificate"]);
});
