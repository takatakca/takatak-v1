import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { validateReleaseRequest, validateCiEvidence, validateBuildMetadata, validateArtifactFiles, validateTransport } from "./production-release-policy.mjs";
import { verifyProductionRelease } from "./production-release-smoke.mjs";

const sha = "a".repeat(40);
const ciRunId = 42;
const evidence = () => ({
  releaseSha: sha, currentMain: sha, ciRunId, repository: "takatakca/takatak-v1",
  run: { id: ciRunId, head_sha: sha, head_branch: "main", repository: { full_name: "takatakca/takatak-v1" }, head_repository: { full_name: "takatakca/takatak-v1" }, path: ".github/workflows/ci.yml", event: "push", status: "completed", conclusion: "success" },
  artifact: { id: 17, name: `takatak-ci-${sha}`, expired: false, size_in_bytes: 100, digest: `sha256:${"c".repeat(64)}`, workflow_run: { id: ciRunId, head_sha: sha } },
});
const metadata = () => ({ buildId: `ci-${sha}`, createdAt: "2026-10-06T12:00:00Z", node: "v22.23.2", platform: "linux", arch: "x64", nextBuild: "webpack", prismaGenerator: "prisma-client-js engineType=client" });

async function cleanupFixture(root) {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}takatak-`));
  await rm(resolved, { recursive: true, force: true });
}

test("only exact production origin and explicit supported modes are accepted", () => {
  const request = { releaseSha: sha, ciRunId, origin: "https://takatak.ca", mode: "validate" };
  assert.doesNotThrow(() => validateReleaseRequest(request));
  for (const patch of [{ releaseSha: "short" }, { ciRunId: "42;touch /tmp/no" }, { origin: "https://attacker.example" }, { mode: "automatic" }]) assert.throws(() => validateReleaseRequest({ ...request, ...patch }));
});

test("stale, PR, failed, cross-repository and expired artifact evidence is refused", () => {
  assert.equal(validateCiEvidence(evidence()), 17);
  for (const mutate of [
    (row) => { row.currentMain = "b".repeat(40); },
    (row) => { row.run.head_branch = "feature"; },
    (row) => { row.run.event = "pull_request"; },
    (row) => { row.run.conclusion = "failure"; },
    (row) => { row.run.repository.full_name = "other/repo"; },
    (row) => { row.artifact.expired = true; },
    (row) => { row.artifact.workflow_run.head_sha = "b".repeat(40); },
    (row) => { row.artifact.digest = ""; },
  ]) { const row = evidence(); mutate(row); assert.throws(() => validateCiEvidence(row)); }
});

test("artifact provenance includes build ID, Linux, Node and Prisma runtime", () => {
  assert.doesNotThrow(() => validateBuildMetadata(metadata(), sha, `ci-${sha}\n`));
  for (const patch of [{ buildId: `ci-${"b".repeat(40)}` }, { platform: "darwin" }, { node: "v20.0.0" }, { nextBuild: "turbopack" }, { prismaGenerator: "native" }]) assert.throws(() => validateBuildMetadata({ ...metadata(), ...patch }, sha, `ci-${sha}`));
});

test("tarball integrity and checksum filename cannot be substituted", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "takatak-policy-"));
  const filename = `takatak-ci-${sha}.tar.gz`;
  try {
    const body = "synthetic artifact bytes";
    const hash = createHash("sha256").update(body).digest("hex");
    await writeFile(path.join(root, filename), body);
    await writeFile(path.join(root, `${filename}.sha256`), `${hash}  ${filename}\n`);
    await writeFile(path.join(root, "build-metadata.json"), JSON.stringify(metadata()));
    await validateArtifactFiles(root, sha);
    await writeFile(path.join(root, filename), "tampered");
    await assert.rejects(validateArtifactFiles(root, sha), /checksum mismatch/);
    await writeFile(path.join(root, `${filename}.sha256`), `${hash}  ../../other.tar.gz\n`);
    await assert.rejects(validateArtifactFiles(root, sha), /expected tarball/);
  } finally { await cleanupFixture(root); }
});

test("unsafe transport paths and missing pins fail with names-only errors", () => {
  const settings = { TKT_HOST: "host.example", TKT_PORT: "22", TKT_USER: "takatak", TKT_APP_ROOT: "/home/operator/apps/takatak", TKT_PRIVATE_KEY: "synthetic-private-key", TKT_KNOWN_HOSTS: "synthetic-pin", TKT_RESTART_COMMAND: "approved restart" };
  assert.doesNotThrow(() => validateTransport(settings));
  for (const patch of [{ TKT_APP_ROOT: "/" }, { TKT_APP_ROOT: "/home/operator" }, { TKT_APP_ROOT: "/home/operator/apps/../other" }, { TKT_KNOWN_HOSTS: "" }, { TKT_USER: "user;echo unsafe" }]) assert.throws(() => validateTransport({ ...settings, ...patch }));
});

test("startup release marker is a SHA only and survives a later disk marker change", async () => {
  const { readReleaseSha } = createRequire(import.meta.url)("./server-release.cjs");
  const root = await mkdtemp(path.join(os.tmpdir(), "takatak-marker-"));
  try {
    await writeFile(path.join(root, "BUILD_ID"), `ci-${sha}\n`);
    const running = readReleaseSha(root);
    await writeFile(path.join(root, "BUILD_ID"), `ci-${"b".repeat(40)}`);
    assert.equal(running, sha);
    assert.equal(readReleaseSha(root), "b".repeat(40));
    await writeFile(path.join(root, "BUILD_ID"), "not-a-release");
    assert.equal(readReleaseSha(root), null);
  } finally { await cleanupFixture(root); }
});

test("public smoke is GET-only and rejects stale runtime, HTML overlays and missing DB", async () => {
  const mockedFetch = (options = {}) => async (input, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, undefined);
    if (String(input).endsWith("/api/health")) return Response.json({ status: "ok" }, { headers: { "x-takatak-release": options.stale ? "b".repeat(40) : sha } });
    if (String(input).endsWith("/api/health/ready")) return Response.json({ ok: true, checks: { database: options.noDatabase ? "not_configured" : "ok", supabase: "ok" } });
    if (options.html) return new Response("Not found", { status: 404, headers: { "content-type": "text/html" } });
    return Response.json({ ok: false }, { status: init.headers["X-AHMV-Tenant"] ? 401 : 403 });
  };
  assert.equal((await verifyProductionRelease(sha, mockedFetch())).release, sha);
  for (const options of [{ stale: true }, { html: true }, { noDatabase: true }]) await assert.rejects(verifyProductionRelease(sha, mockedFetch(options)));
});
