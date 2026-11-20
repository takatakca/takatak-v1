import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openStudioPlanCount, canQueueStudioPlan, canCreateStudioProject, createStudioRateLimiter, STUDIO_MAX_OPEN_PLANS, STUDIO_MAX_PROJECTS_PER_DAY, STUDIO_GENERATE_PER_MINUTE } from '../src/lib/studio/limits.ts';
test('open plans are counted per operation, not per task, and only while queued or running', () => {
  const jobs = [
    { id: '1', status: 'queued', metadata: { operation: 'op-a' } }, { id: '2', status: 'running', metadata: { operation: 'op-a' } },
    { id: '3', status: 'queued', metadata: { operation: 'op-b' } }, { id: '4', status: 'completed', metadata: { operation: 'op-c' } },
    { id: '5', status: 'failed', metadata: { operation: 'op-d' } }, { id: '6', status: 'queued', metadata: null },
  ];
  assert.equal(openStudioPlanCount(jobs), 3);
  assert.equal(openStudioPlanCount([]), 0);
});
test('a workspace may hold at most two open plans and needs the first task price in credits', () => {
  assert.equal(STUDIO_MAX_OPEN_PLANS, 2);
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: 2, firstTaskPrice: 2 }), { ok: true });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 1, balance: 1000, firstTaskPrice: 2 }), { ok: true });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 2, balance: 1000, firstTaskPrice: 2 }), { ok: false, code: 'plan_limit' });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: 1, firstTaskPrice: 2 }), { ok: false, code: 'insufficient_credits' });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: 0, firstTaskPrice: 2 }), { ok: false, code: 'insufficient_credits' });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: null, firstTaskPrice: 2 }), { ok: false, code: 'balance_unavailable' });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: NaN, firstTaskPrice: 2 }), { ok: false, code: 'balance_unavailable' });
  assert.deepEqual(canQueueStudioPlan({ openPlans: 0, balance: 50, firstTaskPrice: 0 }), { ok: false, code: 'insufficient_credits' }, 'an unpriced task never queues');
  assert.equal(canQueueStudioPlan({ openPlans: 2, balance: null, firstTaskPrice: 2 }).code, 'plan_limit', 'the cap is reported before the balance');
});
test('project creation stops at fifty per rolling day', () => {
  assert.equal(STUDIO_MAX_PROJECTS_PER_DAY, 50);
  assert.equal(canCreateStudioProject(0), true); assert.equal(canCreateStudioProject(49), true);
  assert.equal(canCreateStudioProject(50), false); assert.equal(canCreateStudioProject(500), false);
  assert.equal(canCreateStudioProject(-1), false); assert.equal(canCreateStudioProject(NaN), false);
});
test('the generate limiter is a fixed per-key window that resets and reports a retry delay', () => {
  let now = 1_000_000;
  const limiter = createStudioRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
  assert.deepEqual(limiter.take('ws-a'), { ok: true, remaining: 2 });
  assert.deepEqual(limiter.take('ws-a'), { ok: true, remaining: 1 });
  assert.deepEqual(limiter.take('ws-a'), { ok: true, remaining: 0 });
  now += 10_000;
  assert.deepEqual(limiter.take('ws-a'), { ok: false, retryAfterMs: 50_000 });
  assert.deepEqual(limiter.take('ws-b'), { ok: true, remaining: 2 }, 'another workspace is unaffected');
  now += 50_000;
  assert.deepEqual(limiter.take('ws-a'), { ok: true, remaining: 2 }, 'window reset');
  assert.equal(STUDIO_GENERATE_PER_MINUTE, 6);
});
test('the limiter sweeps expired keys and never grows past its bound', () => {
  let now = 0;
  const limiter = createStudioRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 5, now: () => now });
  for (let i = 0; i < 5; i++) limiter.take(`k${i}`);
  assert.equal(limiter.size(), 5);
  now = 2000;
  limiter.take('fresh');
  assert.ok(limiter.size() <= 5, `swept to ${limiter.size()}`);
  for (let i = 0; i < 20; i++) limiter.take(`same-window-${i}`);
  assert.ok(limiter.size() <= 6, `bounded at ${limiter.size()}`);
});
