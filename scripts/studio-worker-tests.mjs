import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processStudioAgentTick, parseStudioWorkerTask } from '../src/lib/studio/worker.ts';
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
  for (const code of ['timeout', 'network', 'provider_error', 'already_processed', 'insufficient_credits', 'unrecognized_provider_failure']) {
    const h = harness(); h.deps.generate = async () => { h.calls.push({ generation: true }); return { ok: false, code }; };
    assert.equal((await h.run()).state, 'needs_attention'); assert.equal(h.row.status, 'failed');
    assert.equal(h.row.errorMessage, code); assert.equal(h.row.metadata.reconciliationRequired, true);
    assert.equal((await h.run()).state, 'idle'); assert.equal(h.generations().length, 1);
  }
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
