import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';


// Optional release proof: use Playwright from the full FoodHub workspace, or
// point LOCAL_FONT_PROOF_PLAYWRIGHT_ROOT at a separate installed tool package.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.LOCAL_FONT_PROOF_OUTPUT || path.join(os.tmpdir(), 'takatak-local-font-proof');
const port = Number(process.env.LOCAL_FONT_PROOF_PORT || 4829);
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
const playwrightRoot = process.env.LOCAL_FONT_PROOF_PLAYWRIGHT_ROOT || path.join(root, '../foodhubca');
const { chromium } = createRequire(path.join(playwrightRoot, 'package.json'))('playwright');
const base = `http://127.0.0.1:${port}`;
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const parseFont = createRequire(import.meta.url)(path.join(root, 'node_modules/next/dist/compiled/@next/font/dist/fontkit')).default;
const families = [
  ['Geist', '@fontsource-variable/geist', 'geist-latin-wght-normal.woff2'],
  ['Geist Mono', '@fontsource-variable/geist-mono', 'geist-mono-latin-wght-normal.woff2'],
  ['Inter', '@fontsource-variable/inter', 'inter-latin-wght-normal.woff2'],
  ['Montserrat', '@fontsource-variable/montserrat', 'montserrat-latin-wght-normal.woff2'],
  ['Instrument Serif', '@fontsource/instrument-serif', 'instrument-serif-latin-400-normal.woff2'],
  ['Instrument Serif italic', '@fontsource/instrument-serif', 'instrument-serif-latin-400-italic.woff2'],
];
const files = fs.readdirSync(path.join(root, '.next/static/media')).filter((name) => name.endsWith('.woff2'));
const assets = families.map(([family, packageName, file]) => {
  const source = fs.readFileSync(path.join(root, 'node_modules', packageName, 'files', file));
  const emitted = files.find((name) => hash(fs.readFileSync(path.join(root, '.next/static/media', name))) === hash(source));
  assert(emitted, `Emitted asset must match the real locked ${family} font`);
  assert.equal(source.subarray(0, 4).toString(), 'wOF2');
  const font = parseFont(source);
  const frenchGlyphs = [...'àâäçéèêëîïôöùûüÿœÀÂÇÉÈÊËÎÏÔÙÛÜŒ'];
  assert(frenchGlyphs.every((glyph) => font.hasGlyphForCodePoint(glyph.codePointAt(0))), `${family} must cover French accented glyphs and ligatures`);
  return { family, emitted, sha256: hash(source), bytes: source.length, frenchGlyphCoverage: true };
});
fs.mkdirSync(output, { recursive: true });
let logs = '';
const inherited = ['PATH', 'HOME', 'TMPDIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_ENV_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];
const childEnv = Object.fromEntries(inherited.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: root, env: { ...childEnv, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.on('data', (data) => { logs += String(data); });
app.stderr.on('data', (data) => { logs += String(data); });
let browser;
const results = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(app.exitCode, null, logs);
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, logs);
  for (const asset of assets) {
    const response = await fetch(`${base}/_next/static/media/${asset.emitted}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /font\/woff2/);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), asset.sha256);
  }
  for (const packageName of new Set(families.map((row) => row[1]))) {
    const name = packageName.split('/').at(-1);
    const response = await fetch(`${base}/fonts/licenses/${name}.txt`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), fs.readFileSync(path.join(root, 'node_modules', packageName, 'LICENSE'), 'utf8'));
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  const external = [];
  const pageErrors = [];
  const context = await browser.newContext();
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  for (const [url, label, width] of [['/?lang=en', 'home-en-desktop', 1440], ['/?lang=fr', 'home-fr-mobile', 390], ['/oauth/consent?lang=fr', 'oauth-fr', 390]]) {
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const proof = await page.evaluate(async () => {
      const variables = location.pathname.startsWith('/oauth/')
        ? [['OAuth Montserrat', document.querySelector('h1'), null]]
        : [['Geist', document.documentElement, '--font-geist-sans'], ['Geist Mono', document.documentElement, '--font-geist-mono'], ['Inter', document.querySelector('.website-surface'), '--font-website-body'], ['Montserrat', document.querySelector('.website-surface'), '--font-website-display'], ['Instrument Serif', document.querySelector('.hp-serif'), '--font-serif']];
      const fonts = [];
      for (const [label, node, variable] of variables) {
        if (!node) throw new Error(`${label} root missing`);
        const value = variable ? getComputedStyle(node).getPropertyValue(variable).trim() : getComputedStyle(node).fontFamily;
        if (!value) throw new Error(`${label} family missing`);
        // Probe the requested web face. The generated fallback uses a local
        // platform font (Arial/Times New Roman), which need not exist on Linux.
        const webFamily = value.split(',')[0].trim();
        const faces = await document.fonts.load(`400 32px ${webFamily}`, 'Français Montréal Québec œuf');
        if (!faces.length || !faces.every((face) => face.status === 'loaded')) throw new Error(`${label} did not load: ${JSON.stringify({ value, faces: [...document.fonts].map((font) => ({ family: font.family, style: font.style, status: font.status })) })}`);
        if (label === 'Instrument Serif') {
          const italic = await document.fonts.load(`italic 400 32px ${webFamily}`, 'Français');
          if (!italic.length || !italic.every((face) => face.status === 'loaded')) throw new Error('Serif italic did not load');
        }
        fonts.push({ label, loaded: true });
      }
      return { lang: document.documentElement.lang, fonts, preloadedFonts: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((node) => new URL(node.href).pathname), fontRequests: performance.getEntriesByType('resource').filter((entry) => /\.woff2(?:$|\?)/.test(entry.name)).map((entry) => new URL(entry.name).origin) };
    });
    assert(proof.fontRequests.every((origin) => origin === base));
    assert(!proof.preloadedFonts.some((url) => assets.filter((asset) => /Geist|Serif/.test(asset.family)).some((asset) => url.endsWith(asset.emitted))), 'Geist and below-hero serif must remain unpreloaded');
    await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: false });
    results.push({ url, width, ...proof });
    await page.close();
  }
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  assert(!external.some((url) => /fonts\.(?:googleapis|gstatic)\.com/.test(url)), 'No request may target a Google font host');
  const runtimeSources = ['src/app/layout.tsx', 'src/app/(website)/layout.tsx', 'src/app/oauth/layout.tsx', 'src/lib/website/home-fonts.ts', 'package-lock.json'];
  const sourceSha256 = Object.fromEntries(runtimeSources.map((name) => [name, hash(fs.readFileSync(path.join(root, name)))]));
  const report = { ok: true, sourceSha256, sourceGit: { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), trackedChanges: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()) }, buildId: fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim(), families: 5, assets, emittedFontResponses: assets.length, originalLicenseResponses: 5, browserStates: results, pageErrors, externalFontRequests: 0, externalOtherRequestsBlocked: external.length, databaseRuntimeVerified: false, productionVerified: false };
  fs.writeFileSync(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('PASS6 exact emitted fonts +5 original licenses +3 actual Chromium page states; no external font requests or page errors');
} finally {
  await browser?.close();
  const exited = app.exitCode === null ? new Promise((resolve) => app.once('exit', resolve)) : Promise.resolve();
  if (app.exitCode === null) app.kill('SIGTERM');
  await exited;
}
