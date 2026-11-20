import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STUDIO_TEXT, studioText, studioErrorMessage } from '../src/lib/studio/i18n.ts';
test('every Studio string exists in both French and English and interpolates only named variables', () => {
  const keys = Object.keys(STUDIO_TEXT);
  assert.ok(keys.length > 150, `dictionary has ${keys.length} keys`);
  for (const key of keys) {
    for (const lang of ['en', 'fr']) assert.ok(typeof STUDIO_TEXT[key][lang] === 'string' && STUDIO_TEXT[key][lang].length > 0, `${key}.${lang}`);
    const vars = (STUDIO_TEXT[key].en.match(/\{\w+\}/g) ?? []).sort();
    assert.deepEqual((STUDIO_TEXT[key].fr.match(/\{\w+\}/g) ?? []).sort(), vars, `${key}: FR and EN use the same placeholders`);
  }
  assert.equal(studioText('fr', 'credits_count', { n: 12 }), '12 crédits');
  assert.equal(studioText('en', 'budget_formula', { formats: 2, days: 3, dayWord: 'days', price: 2 }), '2 formats × 3 days × 2 credits. No automatic top-up.');
  assert.equal(studioText('en', 'credits_count', {}), '{n} credits', 'an unknown placeholder is left visible rather than silently blanked');
});
test('server codes map to customer sentences in the chosen language; raw codes never reach the screen', () => {
  assert.equal(studioErrorMessage('fr', { codes: ['plan_limit', 'conflict'], status: 429 }), STUDIO_TEXT.err_plan_limit.fr);
  assert.equal(studioErrorMessage('en', { codes: ['insufficient_credits', 'invalid_input'], status: 402 }), STUDIO_TEXT.err_insufficient_credits.en);
  assert.equal(studioErrorMessage('en', { codes: ['conflict'], status: 409 }), STUDIO_TEXT.err_conflict.en, 'generic code when no stable message code');
  assert.equal(studioErrorMessage('en', { codes: ['network'], status: 502 }), STUDIO_TEXT.err_provider_error.en, 'aliases');
  assert.equal(studioErrorMessage('fr', { codes: ['project_daily_limit'], status: 429 }), STUDIO_TEXT.err_project_daily_limit.fr);
  assert.equal(studioErrorMessage('fr', { codes: ['rate_limited'], status: 429 }), STUDIO_TEXT.err_rate_limited.fr);
  for (const [codes, status, expected] of [
    [['brand_new_code'], 503, 'err_http_5xx'], [[], 401, 'err_http_401'], [[], 403, 'err_http_403'], [[], 413, 'err_http_413'], [[], 429, 'err_http_429'], [[], 418, 'err_generic'],
    [['DROP TABLE', null, undefined, 'x'.repeat(61)], 500, 'err_http_5xx'],
  ]) {
    const message = studioErrorMessage('en', { codes, status });
    assert.equal(message, STUDIO_TEXT[expected].en, `${JSON.stringify(codes)} ${status}`);
    for (const code of codes) if (typeof code === 'string') assert.equal(message.includes(code), false, `raw ${code} leaked`);
  }
});
