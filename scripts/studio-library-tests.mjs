import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseStudioLibraryFilter, studioLibraryQuery, studioLibraryMetadata, listStudioLibrary } from '../src/lib/studio/library-policy.ts';
const source = 'takatakstudio_output';
const projectId = '22222222-2222-4222-8222-222222222222';
const parse = query => parseStudioLibraryFilter(new URLSearchParams(query));
const defaults = { offset: 0, query: '', track: null, projectId: null };
test('library filters have bounded canonical offsets and exact known formats', () => {
  assert.deepEqual(parse(''), defaults);
  assert.deepEqual(parse(`offset=40&q=Original+Forest&track=music&projectId=${projectId}`), { offset: 40, query: 'Original Forest', track: 'music', projectId });
  assert.equal(parse('offset=100000').offset, 100000);
  assert.equal(parse('q=' + 'a'.repeat(100)).query.length, 100);
  for (const invalid of ['offset=-1', 'offset=1.5', 'offset=1e3', 'offset=NaN', 'offset=01', 'offset=', 'offset=100001',
    'track=publish', 'track=Video', 'track=all', 'projectId=../other', 'q=' + 'x'.repeat(101), 'q=bad%00value',
    'offset=0&offset=20', 'track=video&track=social', 'q=a&q=b', `projectId=${projectId}&projectId=${projectId}`]) assert.equal(parse(invalid), null, invalid);
});
test('untrusted query fields cannot select a client, source, status or page size', () => {
  const filter = parse('clientId=tenant-b&source=takbot&status=archived&take=10000&accountId=forged');
  assert.deepEqual(filter, defaults);
  const query = studioLibraryQuery('tenant-a', filter, source);
  assert.equal(query.where.clientId, 'tenant-a'); assert.deepEqual(query.where.status, { not: 'archived' });
  assert.deepEqual(query.where.AND, [{ metadata: { path: ['source'], equals: source } }]);
  assert.equal(query.take, 21); assert.equal(query.skip, 0);
  assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(Object.keys(query.select).sort(), ['id', 'title', 'content', 'status', 'metadata', 'createdAt'].sort());
});
test('server search combines tenant, source, project and format with title/content insensitive matching', () => {
  const query = studioLibraryQuery('tenant-a', parse(`q=forest&track=video&projectId=${projectId}&offset=20`), source);
  assert.deepEqual(query.where, { clientId: 'tenant-a', status: { not: 'archived' }, AND: [
    { metadata: { path: ['source'], equals: source } }, { metadata: { path: ['track'], equals: 'video' } },
    { metadata: { path: ['projectId'], equals: projectId } },
    { OR: [{ title: { contains: 'forest', mode: 'insensitive' } }, { content: { contains: 'forest', mode: 'insensitive' } }] },
  ] });
  assert.equal(query.skip, 20); assert.equal(query.take, 21);
});
function repository() {
  const rows = Array.from({ length: 65 }, (_, index) => ({
    id: String(index).padStart(3, '0'), title: index === 2 ? 'Earlier Forest Production' : `Draft ${index}`, content: index === 1 ? 'A FOREST in the content' : `Original text ${index}`,
    clientId: 'tenant-a', status: 'draft', metadata: { source, projectId, track: index % 2 ? 'music' : 'video' }, createdAt: new Date('2026-11-05T12:00:00Z'),
  }));
  rows.push({ ...rows[2], id: 'foreign', clientId: 'tenant-b', title: 'FOREST foreign' },
    { ...rows[2], id: 'archived', status: 'archived', title: 'FOREST archived' },
    { ...rows[2], id: 'other-source', metadata: { ...rows[2].metadata, source: 'takbot' }, title: 'FOREST other source' });
  const queries = [];
  async function findMany(query) {
    queries.push(query);
    // Contract fixture; real Prisma/PostgreSQL search and authenticated HTTP are separate release gates.
    return rows.filter(row => row.clientId === query.where.clientId && row.status !== query.where.status.not && query.where.AND.every(condition => {
      if (condition.metadata) return row.metadata[condition.metadata.path[0]] === condition.metadata.equals;
      return condition.OR.some(part => Object.entries(part).some(([field, search]) => row[field].toLowerCase().includes(search.contains.toLowerCase())));
    })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(query.skip, query.skip + query.take);
  }
  return { rows, queries, findMany };
}
test('paging reaches every matching stored draft beyond the previous thirty-item window', async () => {
  const repo = repository(); const ids = []; let offset = 0; let pages = 0;
  do {
    const result = await listStudioLibrary(repo.findMany, 'tenant-a', { ...defaults, offset }, source);
    ids.push(...result.outputs.map(row => row.id)); pages++;
    assert.ok(result.outputs.length <= 20);
    if (!result.hasMore) { assert.equal(result.nextOffset, null); break; }
    offset = result.nextOffset;
  } while (pages < 10);
  assert.equal(pages, 4); assert.equal(ids.length, 65); assert.equal(new Set(ids).size, 65);
  assert.equal(ids[0], '064'); assert.equal(ids.at(-1), '000');
  assert.ok(!ids.includes('foreign') && !ids.includes('archived') && !ids.includes('other-source'));
  assert.deepEqual(repo.queries.map(q => q.skip), [0, 20, 40, 60]);
});
test('search finds older title and content matches across the stored library', async () => {
  const repo = repository();
  const result = await listStudioLibrary(repo.findMany, 'tenant-a', parse('q=forest'), source);
  assert.deepEqual(result.outputs.map(row => row.id), ['002', '001']); assert.equal(result.hasMore, false);
  const music = await listStudioLibrary(repo.findMany, 'tenant-a', parse('q=forest&track=music'), source);
  assert.deepEqual(music.outputs.map(row => row.id), ['001']);
  const foreign = await listStudioLibrary(repo.findMany, 'tenant-b', parse('q=forest'), source);
  assert.deepEqual(foreign.outputs.map(row => row.id), ['foreign']);
  const empty = await listStudioLibrary(repo.findMany, 'tenant-a', parse('q=absent'), source);
  assert.deepEqual(empty, { outputs: [], hasMore: false, nextOffset: null });
});
test('library metadata contains only bounded client-visible provenance', () => {
  const metadata = { source, projectId, track: 'social', engine: 'ollama', mode: 'write', trial: true, requestId: 'studio:stable-request',
    originSource: 'takbot', generatedBy: 'takbot', knowledge: 'not_retrieved', version: 1,
    providerResponse: { secret: 'synthetic-secret' }, actorId: 'internal-actor', clientId: 'forged', socialPostId: 'internal-post', approvalId: 'internal-approval', arbitrary: true };
  const safe = studioLibraryMetadata(metadata, source);
  assert.deepEqual(safe, { source, projectId, track: 'social', engine: 'ollama', mode: 'write', trial: true, requestId: 'studio:stable-request',
    originSource: 'takbot', generatedBy: 'takbot', knowledge: 'not_retrieved', version: 1 });
  assert.ok(!JSON.stringify(safe).includes('synthetic-secret'));
  assert.deepEqual(studioLibraryMetadata({ source: 'other', projectId: 'bad', track: 'publish', engine: 'x'.repeat(81), mode: 'bad\nmode',
    trial: 'true', requestId: 'x'.repeat(257), generatedBy: 'unknown', originSource: 'other', knowledge: 'private', version: 3 }, source), { source });
  for (const value of [null, [], 'unexpected']) assert.deepEqual(studioLibraryMetadata(value, source), { source });
});
test('page responses whitelist top-level fields and use the extra row only for pagination', async () => {
  const repo = repository(); repo.rows[64].internal = 'never-return'; repo.rows[64].metadata.actorId = 'internal-actor';
  const result = await listStudioLibrary(repo.findMany, 'tenant-a', defaults, source);
  assert.equal(result.outputs.length, 20); assert.equal(result.hasMore, true); assert.equal(result.nextOffset, 20);
  assert.deepEqual(Object.keys(result.outputs[0]).sort(), ['id', 'title', 'content', 'status', 'metadata', 'createdAt'].sort());
  assert.equal(result.outputs[0].createdAt, '2026-11-05T12:00:00.000Z');
  assert.ok(!JSON.stringify(result).includes('internal-actor')); assert.ok(!JSON.stringify(result).includes('never-return'));
});
test('library GET requires fresh workspace access and feature flag before reading data', () => {
  const route = readFileSync('src/app/api/studio/library/route.ts', 'utf8');
  assert.ok(route.includes('requireWorkspaceApiPermission("create_content")'));
  assert.ok(route.includes('if (!gate.ok) return gate.response'));
  assert.ok(route.includes('studioEnabled(process.env)'));
  assert.ok(route.includes('gate.access.activeClientId, filter, STUDIO_OUTPUT_SOURCE'));
  assert.ok(route.indexOf('requireWorkspaceApiPermission(') < route.indexOf('const db = getPrisma()'));
  assert.ok(!route.includes('searchParams.get("clientId")')); assert.ok(!route.includes('runTakbot'));
});
