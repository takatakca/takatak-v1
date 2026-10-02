#!/usr/bin/env node
// TAKATAK Food Hub setup wizard
// Run: npm run food-hub:setup                (writes .env.local — local development)
//      npm run food-hub:setup -- --file .env (on the server, next to the release)
// Asks for each Food Hub credential and updates ONLY the Food Hub lines of that file;
// every other TAKATAK setting in the file is left exactly as it is.
// Secrets never leave your computer. Press Enter to skip anything you
// don't have yet — you can re-run this wizard any time; existing values
// are kept unless you type a new one.

import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
// Buffered line reader: works when typing AND when answers are piped in (lines are never dropped).
const lineQueue = [];
const waiters = [];
let inputClosed = false;
rl.on('line', (line) => { const w = waiters.shift(); if (w) w(line); else lineQueue.push(line); });
rl.on('close', () => { inputClosed = true; while (waiters.length) waiters.shift()(''); });
function ask(prompt) {
  process.stdout.write(prompt);
  if (lineQueue.length) { const l = lineQueue.shift(); if (!process.stdin.isTTY) process.stdout.write('\n'); return Promise.resolve(l); }
  if (inputClosed) { process.stdout.write('\n'); return Promise.resolve(''); }
  return new Promise((resolve) => waiters.push(resolve));
}

const fileArg = process.argv.indexOf('--file');
const FILE = fileArg > -1 && process.argv[fileArg + 1] ? process.argv[fileArg + 1] : '.env.local';
const existing = {};
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) existing[m[1]] = m[2];
  }
  console.log(`Found existing ${FILE} — current values are kept if you press Enter.\n`);
}

const sections = [
  ['FOOD HUB (sign-in, users and the database are TAKATAK’s — nothing to add for those)', [
    ['FOODHUB_PUBLIC_URL', 'Public URL used in webhook addresses [empty = NEXT_PUBLIC_APP_URL]'],
    ['FOOD_HUB_OWNER_EMAILS', 'Email(s) allowed to activate Food Hub for their workspace, comma-separated'],
  ]],
  ['CLOVER (clover.com → Account & Setup → API Tokens → create a token with Orders, Inventory, Payments and Merchant read/write)', [
    ['CLOVER_BASE_URL', 'Base URL [https://api.clover.com]', 'https://api.clover.com'],
    ['CLOVER_MERCHANT_ID', 'Merchant ID (13 characters, in your Clover dashboard URL)'],
    ['CLOVER_ACCESS_TOKEN', 'API token'],
    ['CLOVER_MERCHANT_TOKENS', 'Other locations, optional JSON {"MERCHANT_ID":"token",...}'],
    ['CLOVER_PRINT_DEVICE_ID', 'Optional: Clover device id that prints kitchen tickets (empty = merchant default printer)'],
    ['CLOVER_WEBHOOK_AUTH', 'Optional: Clover app webhook auth code (X-Clover-Auth, shown in the Clover developer dashboard after the webhook URL is verified) — makes 86 from Clover instant'],
  ]],
  ['UBER EATS DIRECT (developer.uber.com → your app → needs eats.order + eats.store scopes approved)', [
    ['UBER_CLIENT_ID', 'Client ID'],
    ['UBER_CLIENT_SECRET', 'Client Secret (also verifies Uber webhooks)'],
  ]],
  ['DOORDASH DIRECT (developer.doordash.com → Credentials; provider type comes from DoorDash after approval)', [
    ['DOORDASH_DEVELOPER_ID', 'Developer ID'],
    ['DOORDASH_KEY_ID', 'Key ID'],
    ['DOORDASH_SIGNING_SECRET', 'Signing secret'],
    ['DOORDASH_PROVIDER_TYPE', 'Provider type (given by DoorDash when Marketplace access is approved)'],
  ]],
  ['SKIPTHEDISHES DIRECT (JET Connect — Skip/Just Eat Takeaway integrations team gives you an API key)', [
    ['SKIP_JET_API_KEY', 'JET Connect API key (sent as X-Flyt-Api-Key)'],
    ['SKIP_JET_BASE_URL', 'JET Connect base URL [https://api.flytplatform.com]', 'https://api.flytplatform.com'],
  ]],
];

sections.push(['REPORT EMAILS (optional — resend.com → API Keys; the From address must be on a domain verified in Resend)', [
  ['RESEND_API_KEY', 'Resend API key (re_...)'],
  ['REPORT_EMAIL_FROM', 'From address, e.g. TAKATAK Reports <reports@yourdomain.com>'],
]]);

const values = { ...existing };
for (const [title, fields] of sections) {
  console.log('\n=== ' + title + ' ===');
  for (const [key, label, fallback] of fields) {
    const current = values[key];
    const hint = current ? ' [saved value kept if empty]' : (fallback ? '' : '');
    const answer = (await ask(`${label}${hint}\n${key}= `)).trim();
    if (answer) values[key] = answer;
    else if (!current && fallback) values[key] = fallback;
  }
}

// Webhook secrets are generated automatically — you paste them into each platform's portal.
const { randomBytes } = await import('node:crypto');
for (const key of ['DOORDASH_WEBHOOK_SECRET', 'SKIP_WEBHOOK_HMAC_SECRET', 'SKIP_WEBHOOK_API_KEY', 'TGTG_WEBHOOK_SECRET', 'CRON_SECRET']) {
  if (!values[key]) values[key] = randomBytes(24).toString('hex');
}
values['FOODHUB_TIMEZONE'] = values['FOODHUB_TIMEZONE'] || 'America/Toronto';
values['FOODHUB_CLOVER_AUTOPRINT'] = values['FOODHUB_CLOVER_AUTOPRINT'] || 'on';
values['FOODHUB_AUTO_COMPLETE_MIN'] = values['FOODHUB_AUTO_COMPLETE_MIN'] || '90';
// RC9 automation defaults (all can be turned off with "off")
values['FOODHUB_CLOVER_RECORD_PAYMENT'] = values['FOODHUB_CLOVER_RECORD_PAYMENT'] || 'on';
values['FOODHUB_CLOVER_ORDER_TYPES'] = values['FOODHUB_CLOVER_ORDER_TYPES'] || 'on';
values['FOODHUB_CLOVER_DELETE_CANCELLED'] = values['FOODHUB_CLOVER_DELETE_CANCELLED'] || 'on';
values['FOODHUB_CLOVER_INVENTORY_SYNC'] = values['FOODHUB_CLOVER_INVENTORY_SYNC'] || 'on';
values['FOODHUB_SCHEDULED_AFTER_MIN'] = values['FOODHUB_SCHEDULED_AFTER_MIN'] || '60';
console.log('\nWebhook secrets generated. They are shown (with the exact URLs) on the Channels screen');
console.log('of your dashboard — give them to each platform from there. Nothing to copy now.');
console.log('  Uber Eats  uses your Client Secret automatically (nothing to paste).');

// Safety flags
values['CONNECTOR_NETWORK_TIMEOUT_MS'] = values['CONNECTOR_NETWORK_TIMEOUT_MS'] ?? '15000';
const enable = (await ask('\nEnable LIVE connectors now? Only say yes after credentials are in. (yes/no) [no]: ')).trim().toLowerCase();
values['LIVE_CONNECTORS_GLOBAL_ENABLED'] = enable === 'yes' || enable === 'y' ? 'true' : (values['LIVE_CONNECTORS_GLOBAL_ENABLED'] ?? 'false');

// Update the Food Hub keys in place; keep every other line (comments included) untouched.
const FOOD_HUB_KEYS = new Set([...sections.flatMap(([, fields]) => fields.map(([k]) => k)),
  'DOORDASH_WEBHOOK_SECRET', 'SKIP_WEBHOOK_HMAC_SECRET', 'SKIP_WEBHOOK_API_KEY', 'TGTG_WEBHOOK_SECRET', 'CRON_SECRET',
  'FOODHUB_TIMEZONE', 'FOODHUB_CLOVER_AUTOPRINT', 'FOODHUB_AUTO_COMPLETE_MIN', 'FOODHUB_CLOVER_RECORD_PAYMENT', 'FOODHUB_CLOVER_ORDER_TYPES',
  'FOODHUB_CLOVER_DELETE_CANCELLED', 'FOODHUB_CLOVER_INVENTORY_SYNC', 'FOODHUB_SCHEDULED_AFTER_MIN', 'CONNECTOR_NETWORK_TIMEOUT_MS', 'LIVE_CONNECTORS_GLOBAL_ENABLED']);
const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n') : [];
const written = new Set();
const updated = lines.map((line) => {
  const m = line.match(/^([A-Z0-9_]+)=/);
  if (!m || !FOOD_HUB_KEYS.has(m[1]) || values[m[1]] === undefined) return line;
  written.add(m[1]);
  return `${m[1]}=${values[m[1]]}`;
});
while (updated.length && updated[updated.length - 1] === '') updated.pop();
const added = [...FOOD_HUB_KEYS].filter((k) => !written.has(k) && values[k] !== undefined && values[k] !== '');
if (added.length) updated.push('', '# --- TAKATAK Food Hub ---', ...added.map((k) => `${k}=${values[k]}`));
writeFileSync(FILE, updated.join('\n') + '\n');
console.log(`\nSaved ${FILE}. Secrets stayed on this machine.`);
console.log('Next: restart the app, open /dashboard/food-hub → Channels for every webhook URL + secret to give each platform.');
rl.close();
