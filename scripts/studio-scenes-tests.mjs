import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { saveStudioScenes } from '../src/lib/studio/scene-service.ts';
const scene = { title: 'Opening', visual: 'An original forest', narration: 'Hello', seconds: 10 };
const input = { clientId: 'tenant-a', projectId: 'project-a', scenes: [scene], revision: 0 };
const policy = { projectSource: 'takatakstudio_project', sceneSource: 'takatakstudio_scenes_v1', recordId: () => 'scene-a' };
function fixture() {
  const state = { project: { id: 'project-a', clientId: 'tenant-a', title: 'Original production', status: 'draft', metadata: { source: policy.projectSource } },
    scene: null, events: [], afterLock: null };
  const clone = value => value == null ? null : structuredClone(value);
  const tx = {
    $queryRaw: async (strings, ...values) => { state.events.push({ action: 'lock', values }); if (state.afterLock) state.afterLock(state); return []; },
    savedAiOutput: {
      findFirst: async ({ where }) => { state.events.push({ action: 'project-read', where }); const p = state.project;
        return clone(p && p.id === where.id && p.clientId === where.clientId && p.status !== where.status.not && p.metadata.source === where.metadata.equals ? p : null); },
      createMany: async ({ data, skipDuplicates }) => { state.events.push({ action: 'create', data, skipDuplicates }); assert.equal(skipDuplicates, true);
        if (state.scene) return { count: 0 }; state.scene = clone(data); return { count: 1 }; },
      updateMany: async ({ where, data }) => { state.events.push({ action: 'update', where }); const row = state.scene;
        if (!row || row.id !== where.id || row.clientId !== where.clientId || row.status === where.status.not ||
          !where.AND.every(condition => row.metadata[condition.metadata.path[0]] === condition.metadata.equals)) return { count: 0 };
        Object.assign(row, clone(data)); return { count: 1 }; },
    },
  };
  // Serialized transaction contract fixture, not evidence of real database locking.
  let tail = Promise.resolve();
  async function transaction(fn) { const previous = tail; let release; tail = new Promise(r => { release = r; }); await previous;
    try { return await fn(tx); } finally { release(); } }
  return { state, run: (change = {}) => transaction(tx => saveStudioScenes(tx, { ...input, ...change }, policy)) };
}
test('scene create and revision save retain the owned project and manual scene authority', async () => {
  const f = fixture(); assert.deepEqual(await f.run(), { ok: true, statusCode: 200, revision: 1 });
  assert.equal(f.state.scene.clientId, 'tenant-a'); assert.equal(f.state.scene.origin, 'manual');
  assert.deepEqual(f.state.scene.metadata, { source: policy.sceneSource, projectId: 'project-a', revision: 1 });
  assert.deepEqual(f.state.events[0], { action: 'lock', values: ['project-a', 'tenant-a'] });
  assert.equal(f.state.events[1].action, 'project-read');
  assert.deepEqual(await f.run({ revision: 1, scenes: [{ ...scene, narration: 'Revised' }] }), { ok: true, statusCode: 200, revision: 2 });
  assert.equal(JSON.parse(f.state.scene.content)[0].narration, 'Revised');
});
test('foreign, archived and relabeled projects cannot create scenes after the project lock', async () => {
  for (const change of [state => state.project.status = 'archived', state => state.project.metadata.source = 'takbot', state => state.project.clientId = 'tenant-b', state => state.project = null]) {
    const f = fixture(); f.state.afterLock = change;
    assert.equal((await f.run()).statusCode, 404); assert.equal(f.state.scene, null);
    assert.ok(!f.state.events.some(event => event.action === 'create' || event.action === 'update'));
  }
});
test('concurrent first saves create once and return conflicts without aborting the transaction', async () => {
  const f = fixture(); const results = await Promise.all(Array.from({ length: 10 }, () => f.run()));
  assert.equal(results.filter(result => result.ok).length, 1); assert.equal(results.filter(result => result.statusCode === 409).length, 9);
  assert.equal(f.state.scene.metadata.revision, 1); assert.ok(f.state.events.filter(event => event.action === 'create').every(event => event.skipDuplicates));
});
test('stale revisions refuse concurrent overwrites', async () => {
  const f = fixture(); await f.run();
  const results = await Promise.all(['First revision', 'Second revision'].map(narration => f.run({ revision: 1, scenes: [{ ...scene, narration }] })));
  assert.equal(results.filter(result => result.ok).length, 1); assert.equal(results.filter(result => result.statusCode === 409).length, 1);
  assert.equal(f.state.scene.metadata.revision, 2); assert.equal(JSON.parse(f.state.scene.content)[0].narration, 'First revision');
});
test('archived, relabeled, moved or foreign scene records cannot be overwritten through a valid project', async () => {
  for (const change of [row => row.status = 'archived', row => row.metadata.source = 'other', row => row.metadata.projectId = 'project-b', row => row.clientId = 'tenant-b']) {
    const f = fixture(); await f.run(); change(f.state.scene); const before = structuredClone(f.state.scene);
    assert.equal((await f.run({ revision: 1, scenes: [{ ...scene, narration: 'Must not overwrite' }] })).statusCode, 409);
    assert.deepEqual(f.state.scene, before);
  }
});
test('unsafe revisions and route inputs are rejected before persistence', async () => {
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER, Infinity]) {
    const f = fixture(); assert.equal((await f.run({ revision })).statusCode, 400); assert.equal(f.state.events.length, 0);
  }
  const route = readFileSync('src/app/api/studio/scenes/route.ts', 'utf8');
  assert.ok(route.includes('parseScenes(raw?.scenes)')); assert.ok(route.includes('requireWorkspaceApiPermission("create_content")'));
  assert.ok(route.includes('db.$transaction(tx=>saveStudioScenes(')); assert.ok(route.includes('clientId:gate.access.activeClientId'));
});
