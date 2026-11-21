// Pure logic of the app, run with Node's own test runner (type stripping, no build step).
import test from 'node:test';
import assert from 'node:assert/strict';
import { amount, change, compact, initials, INVOICE_STATUS } from '../src/lib/format.ts';

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
