// Pure logic of the app, run with Node's own test runner (type stripping, no build step).
import test from 'node:test';
import assert from 'node:assert/strict';
import { amount, change, compact, daysUntil, initials, INVOICE_STATUS, LEAD_STATUS, statusOf } from '../src/lib/format.ts';

test('numbers are short and French', () => {
  assert.equal(compact(null), '—');
  assert.equal(compact(950), '950');
  assert.equal(compact(12_400), '12 k');
  assert.equal(compact(2_350_000), '2,4 M');
});

test('change against the previous period', () => {
  assert.equal(change(120, 100), 20);
  assert.equal(change(80, 100), -20);
  assert.equal(change(5, 0), null);
  assert.equal(change(null, 10), null);
});

test('invoice amounts and labels', () => {
  assert.match(amount(12345, 'cad'), /123,45/);
  assert.equal(INVOICE_STATUS.overdue.label, 'En retard');
  assert.equal(initials('Groupe Takatak'), 'GT');
  assert.equal(initials(''), 'T');
});

test('web statuses read in plain French with the right colour', () => {
  assert.deepEqual(statusOf('active'), { label: 'Actif', tone: 'green' });
  assert.equal(statusOf('expired').tone, 'red');
  assert.equal(statusOf('pending').tone, 'gold');
  assert.equal(statusOf(null).label, 'Inconnu');
  assert.equal(statusOf('some_new_state').label, 'some new state');
});

test('days until a renewal', () => {
  const now = Date.parse('2026-11-21T12:00:00');
  assert.equal(daysUntil('2026-11-30', now), 9);
  assert.equal(daysUntil(null, now), null);
});

test('every lead stage has a French label', () => {
  for (const s of ['new_internal', 'follow_up_planned', 'contacted_internal', 'qualified_internal', 'proposal_planned', 'won_internal', 'lost_internal']) assert.ok(LEAD_STATUS[s]);
});
