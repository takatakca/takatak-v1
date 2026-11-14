import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processStudioAgentTick, parseStudioWorkerTask, recoverStudioLeases } from '../src/lib/studio/worker.ts';
const source = 'takatakstudio_agent_v1';
const ids = {
  job: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  actor: '33333333-3333-4333-8333-333333333333',
  operation: '44444444-4444-4444-8444-444444444444',
};
const metadata = { source, version: 1, operation: ids.operation, fingerprint: 'a'.repeat(64),
  actorId: ids.actor, projectId: ids.project, track: 'video', day: 0, engine: 'ollama', creditCeiling: 2, budgetCredits: 4 };
function harness(change = {}) {
  const row = { id: ids.job, clientId: 'tenant-a', attempts: 0, maxAttempts: 1, metadata: { ...metadata }, status: 'queued', ...change };
  const calls = [], finishes = [];
  const deps = {
    source,
    findDue: async () => row.status === 'queued' ? { ...row } : null,
    claim: async job => {
      if (row.status !== 'queued' || row.attempts !== 0 || row.maxAttempts !== 1 || job.id !== row.id) return null;
      row.status = 'running'; row.attempts++; row.lease = 'lease-a'; return row.lease;
    },
    actorAllowed: async (clientId, actorId) => { calls.push({ authorization: { clientId, actorId } }); return clientId === 'tenant-a' && actorId === ids.actor; },
    currentPrice: () => 2,
    markDispatched: async (job, lease, next) => { calls.push({ dispatched: true }); if (row.lease !== lease || row.status !== 'running') return false; row.metadata = next; return true; },
    generate: async (clientId, input) => { calls.push({ generation: { clientId, ...input } }); return { ok: true, savedId: 'saved-a', text: 'Original draft', linked: true }; },
    finish: async (job, lease, outcome) => {
      finishes.push({ job, lease, outcome });
      if (row.lease !== lease || row.status !== 'running') return false;
      Object.assign(row, outcome); row.lease = null; return true;
    },
  };
  return { row, calls, finishes, deps, run: () => processStudioAgentTick(deps), generations: () => calls.filter(c => c.generation) };
}
test('simultaneous ticks dispatch once and retain server job workspace, identity, engine and request ID', async () => {
  const h = harness();
  const results = await Promise.all([h.run(), h.run()]);
  assert.deepEqual(results.map(r => r.state).sort(), ['contended', 'draft_ready']);
  assert.equal(h.generations().length, 1);
  assert.deepEqual(h.generations()[0].generation, { clientId: 'tenant-a', projectId: ids.project, track: 'video', requestId: ids.job, engine: 'ollama' });
  assert.equal(h.row.attempts, 1); assert.equal(h.row.status, 'completed');
  assert.equal(h.row.metadata.published, false); assert.equal(h.row.metadata.reconciliationRequired, false);
  assert.equal((await h.run()).state, 'idle');
});
test('a reset queued state never grants a second attempt, even if maxAttempts was broadened', async () => {
  for (const change of [{ attempts: 1 }, { maxAttempts: 3 }, { attempts: -1 }, { clientId: null }]) {
    const h = harness(change); assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.generations().length, 0);
    assert.equal(h.finishes.length, 0);
  }
});
test('fresh authorization denies a foreign workspace or revoked membership before dispatch', async () => {
  for (const foreign of [false, true]) {
    const h = harness(foreign ? { clientId: 'tenant-b' } : {});
    if (!foreign) h.deps.actorAllowed = async () => false;
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.generations().length, 0);
    assert.equal(h.row.errorMessage, 'authorization_changed'); assert.equal(h.row.metadata.reconciliationRequired, false);
  }
});
test('changed or unavailable central price prevents dispatch', async () => {
  for (const price of [3, 0, null]) {
    const h = harness(); h.deps.currentPrice = () => price;
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.generations().length, 0);
    assert.equal(h.row.errorMessage, 'credit_price_changed');
  }
});
test('malformed queued tasks cannot choose an unsupported track, provider, budget, actor or project', async () => {
  for (const change of [{ source: 'other' }, { version: 2 }, { operation: 'bad' }, { fingerprint: '' }, { projectId: 'foreign' },
    { actorId: null }, { track: 'publish' }, { track: { toString: () => 'video' } }, { engine: 'external' }, { day: 7 },
    { creditCeiling: 0 }, { budgetCredits: 1 }, { budgetCredits: Infinity }]) {
    const h = harness({ metadata: { ...metadata, ...change } });
    assert.equal(parseStudioWorkerTask(h.row.metadata, source), null);
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.generations().length, 0);
    assert.equal(h.row.errorMessage, 'invalid_task');
  }
});
test('post-dispatch timeout, duplicate debit and unknown refusal stay held without another generation', async () => {
  for (const code of ['timeout', 'network', 'provider_error', 'already_processed', 'idempotency_conflict', 'unrecognized_provider_failure']) {
    const h = harness(); h.deps.generate = async () => { h.calls.push({ generation: true }); return { ok: false, code }; };
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.status, 'failed');
    assert.equal(h.row.errorMessage, code); assert.equal(h.row.metadata.reconciliationRequired, true);
    assert.equal((await h.run()).state, 'idle'); assert.equal(h.generations().length, 1);
  }
});
test('refusals returned before any debit are retained but never block the production', async () => {
  for (const code of ['insufficient_credits', 'no_engine_connected', 'unknown_engine', 'engine_mode_mismatch', 'project_not_found', 'brief_too_large_for_engine']) {
    const h = harness(); h.deps.generate = async () => { h.calls.push({ generation: true }); return { ok: false, code }; };
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.status, 'failed');
    assert.equal(h.row.errorMessage, code); assert.equal(h.row.metadata.reconciliationRequired, false);
    assert.equal(typeof h.row.metadata.dispatchedAt, 'string');
    assert.equal((await h.run()).state, 'idle'); assert.equal(h.generations().length, 1);
  }
});
test('the dispatch marker is written before the provider call and a lost lease aborts the call', async () => {
  const h = harness();
  const order = [];
  h.deps.markDispatched = async (job, lease, next) => { order.push('mark'); h.row.metadata = next; return true; };
  h.deps.generate = async () => { order.push('generate'); return { ok: true, savedId: 'saved-a', text: 'x', linked: true }; };
  assert.equal((await h.run()).state, 'draft_ready'); assert.deepEqual(order, ['mark', 'generate']);
  assert.equal(typeof h.row.metadata.dispatchedAt, 'string');
  const lost = harness(); lost.deps.markDispatched = async () => false;
  assert.equal((await lost.run()).state, 'contended'); assert.equal(lost.generations().length, 0); assert.equal(lost.finishes.length, 0);
});
test('expired running leases are finalized without a provider call: blocked only after dispatch', async () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const expired = new Date(now - 200000).toISOString();
  const rows = [
    { id: 'a', clientId: 'tenant-a', attempts: 1, maxAttempts: 1, status: 'running', leaseOwner: 'l1', leaseExpiresAt: expired, metadata: { ...metadata, dispatchedAt: '2026-11-14T11:50:00.000Z' } },
    { id: 'b', clientId: 'tenant-a', attempts: 1, maxAttempts: 1, status: 'running', leaseOwner: 'l2', leaseExpiresAt: expired, metadata: { ...metadata } },
    { id: 'c', clientId: 'tenant-a', attempts: 1, maxAttempts: 1, status: 'running', leaseOwner: 'l3', leaseExpiresAt: new Date(now - 30000).toISOString(), metadata: { ...metadata } },
  ];
  const recovered = [];
  const h = harness({ status: 'completed' });
  h.deps.now = () => now; h.deps.findExpired = async () => rows; h.deps.recover = async (job, outcome) => { recovered.push({ id: job.id, ...outcome }); return true; };
  const result = await recoverStudioLeases(h.deps);
  assert.deepEqual(result, { recovered: 2, blocked: 1 });
  assert.equal(recovered.find(r => r.id === 'a').errorMessage, 'lease_expired_after_dispatch');
  assert.equal(recovered.find(r => r.id === 'a').metadata.reconciliationRequired, true);
  assert.equal(recovered.find(r => r.id === 'b').errorMessage, 'lease_expired_before_dispatch');
  assert.equal(recovered.find(r => r.id === 'b').metadata.reconciliationRequired, false);
  assert.equal(recovered.some(r => r.id === 'c'), false, 'within grace: still owned by a possibly live worker');
  assert.equal(h.generations().length, 0);
  const tick = await h.run(); assert.equal(tick.state, 'idle'); assert.deepEqual(tick.leases, { recovered: 2, blocked: 1 });
});
test('an exception after dispatch is ambiguous, while a preflight outage has no billable attempt', async () => {
  for (const dispatched of [false, true]) {
    const h = harness();
    if (dispatched) h.deps.generate = async () => { h.calls.push({ generation: true }); throw Error('storage interruption'); };
    else h.deps.actorAllowed = async () => { throw Error('authorization store unavailable'); };
    assert.equal((await h.run()).state, 'needs_attention');
    assert.equal(h.row.errorMessage, dispatched ? 'requires_reconciliation' : 'preflight_unavailable');
    assert.equal(h.row.metadata.reconciliationRequired, dispatched); assert.equal(h.generations().length, dispatched ? 1 : 0);
  }
});
test('a saved output link failure preserves the output reference and asks for reconciliation', async () => {
  const h = harness(); h.deps.generate = async () => ({ ok: true, savedId: 'saved-a', text: 'Original draft', linked: false });
  assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.status, 'completed');
  assert.equal(h.row.metadata.outputId, 'saved-a'); assert.equal(h.row.metadata.reconciliationRequired, true);
  assert.equal(h.row.metadata.recoveryText, undefined); assert.equal(h.row.errorMessage, 'output_link_requires_reconciliation');
});
test('a generation without a saved ID retains bounded recovery text without reporting draft ready', async () => {
  const h = harness(); h.deps.generate = async () => ({ ok: true, savedId: null, text: 'x'.repeat(20001), linked: false });
  assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.metadata.recoveryText.length, 20000);
  assert.equal(h.row.metadata.outputId, null); assert.equal(h.row.metadata.reconciliationRequired, true);
});
test('lost finalization ownership and storage interruption never report success or replay the provider', async () => {
  for (const throws of [false, true]) {
    const h = harness(); h.deps.finish = async () => { if (throws) throw Error('storage unavailable'); return false; };
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.status, 'running');
    assert.equal(h.generations().length, 1); assert.equal((await h.run()).state, 'idle'); assert.equal(h.generations().length, 1);
  }
});
