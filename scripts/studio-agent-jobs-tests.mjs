import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeStudioAgentJob, reconcileStudioJobMetadata, STUDIO_BLOCKING_FAILURES } from '../src/lib/studio/agent-jobs.ts';
import { refusalRequiresReconciliation, recoverExpiredStudioLease } from '../src/lib/studio/worker.ts';
const metadata = { source: 'takatakstudio_agent_v1', version: 1, operation: '44444444-4444-4444-8444-444444444444', fingerprint: 'a'.repeat(64),
  actorId: '33333333-3333-4333-8333-333333333333', projectId: '22222222-2222-4222-8222-222222222222', track: 'video', day: 2, engine: 'ollama',
  creditCeiling: 2, budgetCredits: 4, reconciliationRequired: true, recoveryText: 'x'.repeat(5000), outputId: 'saved-1', linked: false };
test('the member job view whitelists fields and never carries identity, fingerprint, engine or recovery text', () => {
  const view = sanitizeStudioAgentJob({ id: 'job-1', status: 'completed', scheduledFor: new Date('2026-11-14T12:00:00Z'), errorMessage: 'output_link_requires_reconciliation', metadata });
  assert.deepEqual(view, { id: 'job-1', status: 'completed', scheduledFor: '2026-11-14T12:00:00.000Z', errorMessage: 'output_link_requires_reconciliation',
    projectId: metadata.projectId, track: 'video', day: 2, reconciliationRequired: true, hasRecoveryText: true });
  for (const key of ['operation', 'fingerprint', 'actorId', 'recoveryText', 'engine', 'budgetCredits', 'creditCeiling', 'outputId', 'linked', 'leaseExpiresAt', 'leaseOwner']) assert.equal(key in view, false, key);
  assert.equal(JSON.stringify(view).includes('xxxx'), false);
});
test('malformed metadata and free-text error messages are dropped, not echoed', () => {
  const view = sanitizeStudioAgentJob({ id: 'job-2', status: 'failed', scheduledFor: 'not a date', errorMessage: 'Error: ECONNREFUSED 10.0.0.1 token=abc', metadata: { projectId: 'foreign', track: 'publish', day: 9, recoveryText: '' } });
  assert.deepEqual(view, { id: 'job-2', status: 'failed', scheduledFor: null, errorMessage: null, projectId: null, track: null, day: null, reconciliationRequired: false, hasRecoveryText: false });
  assert.equal(sanitizeStudioAgentJob({ id: 'j', status: 'queued', metadata: null }).reconciliationRequired, false);
});
test('only refusals returned before a debit are non-blocking', () => {
  for (const code of ['insufficient_credits', 'no_engine_connected', 'unknown_engine', 'engine_mode_mismatch', 'unknown_mode', 'mode_not_inline', 'project_not_found', 'brief_too_large_for_engine']) assert.equal(refusalRequiresReconciliation(code), false, code);
  for (const code of ['timeout', 'network', 'provider_error', 'empty', 'already_processed', 'idempotency_conflict', 'rate_limited', 'auth', 'unsupported', 'something_new', undefined, 42]) assert.equal(refusalRequiresReconciliation(code), true, String(code));
  for (const code of ['timeout', 'network', 'provider_error', 'empty', 'already_processed', 'idempotency_conflict', 'requires_reconciliation', 'lease_expired_after_dispatch']) assert.ok(STUDIO_BLOCKING_FAILURES.includes(code), code);
  assert.equal(STUDIO_BLOCKING_FAILURES.includes('lease_expired_before_dispatch'), false);
  assert.equal(STUDIO_BLOCKING_FAILURES.includes('insufficient_credits'), false);
});
test('lease recovery waits for the grace period and blocks only when a dispatch was recorded', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const base = { status: 'running', leaseExpiresAt: new Date(now - 61000), metadata: { ...metadata, reconciliationRequired: undefined } };
  const dispatched = recoverExpiredStudioLease({ ...base, metadata: { ...base.metadata, dispatchedAt: '2026-11-14T11:57:00.000Z' } }, now);
  assert.equal(dispatched.status, 'failed'); assert.equal(dispatched.errorMessage, 'lease_expired_after_dispatch');
  assert.equal(dispatched.metadata.reconciliationRequired, true); assert.equal(dispatched.metadata.leaseRecoveredAt, '2026-11-14T12:00:00.000Z');
  assert.equal(dispatched.metadata.fingerprint, metadata.fingerprint, 'existing metadata is preserved for the operator');
  const idle = recoverExpiredStudioLease(base, now);
  assert.equal(idle.errorMessage, 'lease_expired_before_dispatch'); assert.equal(idle.metadata.reconciliationRequired, false);
  assert.equal(recoverExpiredStudioLease({ ...base, leaseExpiresAt: new Date(now - 59000) }, now), null, 'inside grace');
  assert.equal(recoverExpiredStudioLease({ ...base, status: 'queued' }, now), null);
  assert.equal(recoverExpiredStudioLease({ ...base, leaseExpiresAt: null }, now), null);
  assert.equal(recoverExpiredStudioLease({ ...base, leaseExpiresAt: 'garbage' }, now), null);
});
test('operator reconciliation records who, when and why and clears only the flag', () => {
  const operator = '55555555-5555-4555-8555-555555555555';
  const next = reconcileStudioJobMetadata(metadata, operator, '  Checked ledger: refund posted. ', Date.parse('2026-11-14T12:00:00Z'));
  assert.equal(next.reconciliationRequired, false); assert.equal(next.reconciledBy, operator); assert.equal(next.reconciledAt, '2026-11-14T12:00:00.000Z');
  assert.equal(next.reconciliationNote, 'Checked ledger: refund posted.'); assert.equal(next.recoveryText, metadata.recoveryText, 'held text stays for recovery');
  for (const [op, note] of [['not-a-uuid', 'valid note'], [operator, 'ab'], [operator, 'x'.repeat(301)], [operator, 'line\nbreak'], [operator, 42]]) assert.equal(reconcileStudioJobMetadata(metadata, op, note, 0), null);
});
