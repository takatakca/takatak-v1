import type { Prisma } from "@prisma/client";
import type { Scene } from "./agent-policy";

type SceneInput = { clientId: string; projectId: string; scenes: Scene[]; revision: number };
type ScenePolicy = { projectSource: string; sceneSource: string; recordId(seed: string): string };
/** Save within the caller's transaction; the project lock also serializes initial scene creation. */
export async function saveStudioScenes(tx: Prisma.TransactionClient, input: SceneInput, policy: ScenePolicy) {
  const { clientId, projectId, scenes, revision } = input;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
    return { ok: false as const, statusCode: 400, code: "invalid_scenes" };
  }
  await tx.$queryRaw`SELECT id FROM saved_ai_outputs WHERE id=${projectId}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
  const project = await tx.savedAiOutput.findFirst({
    where: { id: projectId, clientId, status: { not: "archived" }, metadata: { path: ["source"], equals: policy.projectSource } },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false as const, statusCode: 404, code: "project_not_found" };
  const id = policy.recordId(`${clientId}:${project.id}:scenes`);
  const next = revision + 1;
  const metadata = { source: policy.sceneSource, projectId: project.id, revision: next };
  if (revision === 0) {
    // ON CONFLICT DO NOTHING keeps this transaction usable after a concurrent initial save.
    const created = await tx.savedAiOutput.createMany({ data: { id, clientId, kind: "creative_brief", title: `Scenes · ${project.title}`,
      content: JSON.stringify(scenes), origin: "manual", status: "draft", metadata }, skipDuplicates: true });
    if (created.count !== 1) return { ok: false as const, statusCode: 409, code: "scene_revision_conflict", message: "A scene plan was saved elsewhere. Reload before editing." };
  } else {
    const saved = await tx.savedAiOutput.updateMany({ where: { id, clientId, status: { not: "archived" }, AND: [
      { metadata: { path: ["source"], equals: policy.sceneSource } },
      { metadata: { path: ["projectId"], equals: project.id } },
      { metadata: { path: ["revision"], equals: revision } },
    ] }, data: { content: JSON.stringify(scenes), metadata } });
    if (saved.count !== 1) return { ok: false as const, statusCode: 409, code: "scene_revision_conflict", message: "The scene plan changed. Reload before saving." };
  }
  return { ok: true as const, statusCode: 200, revision: next };
}
