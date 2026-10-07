import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const PRODUCTION_ORIGIN = "https://takatak.ca";

function requireCondition(value, message) {
  if (!value) throw new Error(message);
}

export function validateReleaseRequest({ releaseSha, ciRunId, origin, mode }) {
  requireCondition(/^[a-f0-9]{40}$/.test(releaseSha ?? ""), "release_sha must be a complete Git SHA");
  requireCondition(/^\d+$/.test(String(ciRunId)) && Number.isSafeInteger(Number(ciRunId)) && Number(ciRunId) > 0, "ci_run_id is invalid");
  requireCondition(origin === PRODUCTION_ORIGIN, "Production origin must be https://takatak.ca");
  requireCondition(mode === "validate" || mode === "promote", "Promotion mode is invalid");
}

export function validateCiEvidence({ releaseSha, ciRunId, currentMain, repository, run, artifact }) {
  requireCondition(releaseSha === currentMain, "Refusing a stale main release");
  requireCondition(run.id === Number(ciRunId), "CI run ID does not match");
  requireCondition(run.head_sha === releaseSha && run.head_branch === "main", "CI must attest this exact main SHA");
  requireCondition(run.repository?.full_name === repository && run.head_repository?.full_name === repository, "CI repository does not match");
  requireCondition(run.path === ".github/workflows/ci.yml" && run.event === "push", "Release must come from the main push CI workflow");
  requireCondition(run.status === "completed" && run.conclusion === "success", "CI is not successfully completed");
  requireCondition(artifact?.name === `takatak-ci-${releaseSha}` && artifact.expired === false, "Matching non-expired CI artifact is required");
  requireCondition(artifact.workflow_run?.id === Number(ciRunId) && artifact.workflow_run?.head_sha === releaseSha, "Artifact provenance does not match the CI run");
  requireCondition(Number.isSafeInteger(artifact.id) && artifact.id > 0 && artifact.size_in_bytes > 0, "Artifact metadata is invalid");
  requireCondition(/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ""), "Artifact digest is missing");
  return artifact.id;
}

export function validateBuildMetadata(metadata, releaseSha, buildId) {
  requireCondition(metadata.buildId === `ci-${releaseSha}` && buildId.trim() === metadata.buildId, "Artifact BUILD_ID does not match the exact CI SHA");
  requireCondition(metadata.platform === "linux" && metadata.arch === "x64", "Artifact must be the Linux x64 CI build");
  requireCondition(/^v22\./.test(metadata.node ?? ""), "Artifact must use Node 22");
  requireCondition(metadata.nextBuild === "webpack" && metadata.prismaGenerator === "prisma-client-js engineType=client", "Artifact runtime profile does not match MochaHost");
  requireCondition(Number.isFinite(Date.parse(metadata.createdAt)), "Artifact creation time is invalid");
}

export async function validateArtifactFiles(directory, releaseSha) {
  const filename = `takatak-ci-${releaseSha}.tar.gz`;
  const checksum = (await readFile(path.join(directory, `${filename}.sha256`), "utf8")).trim();
  const match = checksum.match(/^([a-f0-9]{64}) {2}([^\r\n]+)$/);
  requireCondition(match && match[2] === filename, "Artifact checksum must name only the expected tarball");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(directory, filename))) hash.update(chunk);
  requireCondition(hash.digest("hex") === match[1], "Artifact tarball checksum mismatch");
  return JSON.parse(await readFile(path.join(directory, "build-metadata.json"), "utf8"));
}

export function validateTransport(settings) {
  const required = ["TKT_HOST", "TKT_PORT", "TKT_USER", "TKT_APP_ROOT", "TKT_PRIVATE_KEY", "TKT_KNOWN_HOSTS", "TKT_RESTART_COMMAND"];
  const missing = required.filter((name) => !settings[name]?.trim());
  requireCondition(missing.length === 0, `Missing transport configuration: ${missing.join(", ")}`);
  requireCondition(/^[a-zA-Z0-9.-]+$/.test(settings.TKT_HOST), "TKT_HOST format is invalid");
  requireCondition(/^[a-zA-Z0-9_-]+$/.test(settings.TKT_USER), "TKT_USER format is invalid");
  requireCondition(/^\d+$/.test(settings.TKT_PORT) && Number(settings.TKT_PORT) >= 1 && Number(settings.TKT_PORT) <= 65535, "TKT_PORT format is invalid");
  const root = settings.TKT_APP_ROOT;
  requireCondition(/^\/[a-zA-Z0-9._/-]+$/.test(root) && !root.endsWith("/") && !root.includes("//") && root.split("/").filter(Boolean).length >= 3 && !root.split("/").some((part) => part === "." || part === ".."), "TKT_APP_ROOT must be a confined absolute application wrapper directory");
  requireCondition(!/[\r\n\0]/.test(settings.TKT_RESTART_COMMAND), "Approved restart command must be one line");
}
