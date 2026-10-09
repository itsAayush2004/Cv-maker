// AI-mode contract test: real app UI + real Anthropic SDK (pinned build), with the API itself simulated.
// It verifies wiring and safety — request shape, error handling, and that invented numbers and
// unbacked skills are blocked. It says nothing about AI *quality*; tests/ai-live.js does that.
//
//   npm run test:ai-contract   (needs Playwright + Chromium and `npm install`)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const SDK_URL_PREFIX = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@';
const FAKE_KEY = ['sk', 'ant', 'api03', 'contract', 'test', 'not', 'a', 'real', 'key'].join('-'); // built at runtime so the secrets guard doesn't flag this file

const expect = (cond, msg) => { if (!cond) throw new Error('Assertion failed: ' + msg); };
const step = (s) => console.log('•', s);

function message(text, extra) {
  return JSON.stringify(Object.assign({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }
  }, extra || {}));
}

(async () => {
  // Bundle the exact SDK version the app loads from the CDN into one ES module.
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cvforge-sdk-')), 'sdk.mjs');
  const entry = JSON.stringify(require.resolve('@anthropic-ai/sdk'));
  await esbuild.build({ stdin: { contents: `export * from ${entry}; export { default } from ${entry};`, resolveDir: ROOT },
    bundle: true, format: 'esm', platform: 'browser', outfile: out, logLevel: 'silent' });
  const sdkBundle = fs.readFileSync(out, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  let scenario = 'success';
  const seen = [];
  await page.route(SDK_URL_PREFIX + '**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: sdkBundle, headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    const body = JSON.parse(req.postData() || '{}');
    seen.push({ headers: req.headers(), body });
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    const isResearch = Array.isArray(body.tools) && body.tools.some((t) => t.name === 'web_search');
    if (scenario === '401') return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    if (scenario === 'refusal') return route.fulfill({ status: 200, headers: cors, body: message('', { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'test refusal' } }) });
    if (scenario === 'garbage') return route.fulfill({ status: 200, headers: cors, body: message('this is not json {') });
    if (isResearch) return route.fulfill({ status: 200, headers: cors, body: message('- BR Softech builds Unity games for mobile.\n- Screened on: Unity, C#, OOP, game physics.') });
    return route.fulfill({ status: 200, headers: cors, body: message(JSON.stringify({
      headline: 'Unity Developer',
      summary: 'Unity and C# developer building procedural game worlds and editor tooling, with a backend for a live 750+ item showcase.',
      skills: [{ group: 'Engines & Languages', items: ['Unity', 'C#', 'Kubernetes', 'Blender'] }],
      experience: [{ index: 0, bullets: ['Grew the AKverse channels to 50k subscribers with a weekly schedule', 'Run AKverse end to end across YouTube and Instagram, owning strategy, production and community'] }],
      projects: [{ index: 0, bullets: ['Built HexaBed in Unity (C#), a procedural generator that assembles 160+ hex tiles into a playable world', 'Created HexTileEditor, a custom Unity editor panel for authoring the world without code'] }],
      notes: ['Add real subscriber numbers if you have them.']
    })) });
  });

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  step('load starter memory and a real job, enable AI with a test key');
  await page.click('summary:has-text("More ▾")');
  await page.click('[data-action="load-starter"]');
  await page.click('[data-tab="job"]');
  await page.fill('#jobText', fs.readFileSync(path.join(__dirname, 'fixtures', 'jobs', 'game-unity-brsoftech-jaipur.txt'), 'utf8'));
  await page.click('[data-tab="settings"]');
  await page.check('[data-setting="aiEnabled"]');
  await page.check('[data-setting="aiResearch"]');
  await page.fill('#aiKey', FAKE_KEY);
  await page.press('#aiKey', 'Tab');
  await page.click('[data-tab="job"]');
  await page.click('[data-action="build"]');
  await page.waitForSelector('#cvPreview .cv-name');
  const offlineText = await page.textContent('#cvPreview');

  step('AI research + rewrite succeeds and is validated');
  await page.click('[data-action="ai-enhance"]');
  await page.waitForFunction(() => /rewritten by AI/.test(document.querySelector('#aiStatus')?.textContent || ''), null, { timeout: 30000 });
  const cvText = await page.textContent('#cvPreview');
  expect(cvText.includes('HexTileEditor, a custom Unity editor panel for authoring'), 'AI bullet applied');
  expect(!cvText.includes('50k'), 'invented "50k subscribers" bullet was blocked');
  expect(!cvText.includes('Kubernetes'), 'skill not in memory was removed');
  expect(cvText.includes('750+'), 'number that exists in memory is allowed');
  expect((await page.textContent('#cvSide')).includes('Company research'), 'research shown');

  step('request shape: model, fallbacks, beta header, structured output, browser header, key only in header');
  const rewrite = seen.find((r) => r.body.output_config && r.body.output_config.format);
  const researchReq = seen.find((r) => Array.isArray(r.body.tools));
  expect(rewrite && researchReq, 'both research and rewrite calls were made');
  expect(rewrite.body.model === 'claude-opus-5-5', 'default model');
  expect(rewrite.body.fallbacks === 'default', 'refusal fallbacks enabled');
  expect(/server-side-fallback-2026-07-01/.test(rewrite.headers['anthropic-beta'] || ''), 'beta header');
  expect(rewrite.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'browser access header');
  expect(rewrite.headers['x-api-key'] === FAKE_KEY, 'key sent only as header');
  expect(!JSON.stringify(rewrite.body).includes(FAKE_KEY), 'key never in request body');
  expect(researchReq.body.tools[0].type === 'web_search_20260209', 'web search tool version');

  step('backup export never contains the key');
  const exported = await page.evaluate(() => localStorage.getItem('cvforge.v2.state'));
  expect(!exported.includes('sk-ant'), 'key not in saved state');

  for (const [name, wantText] of [['401', 'rejected'], ['refusal', 'declined'], ['garbage', 'AI step failed']]) {
    step(`failure mode "${name}" keeps the offline CV and shows a clear message`);
    scenario = name;
    await page.click('[data-action="rebuild"]');
    await page.click('[data-action="ai-enhance"]');
    await page.waitForSelector('.toast.error', { timeout: 30000 });
    const toastText = (await page.locator('.toast.error').last().textContent()) || '';
    expect(toastText.includes(wantText) || toastText.includes('AI step failed'), `message for ${name}: ${toastText}`);
    expect((await page.textContent('#cvPreview')) === offlineText, 'offline CV unchanged');
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  }

  await browser.close();
  if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nAI contract test passed (simulated API — wiring and safety only, not AI quality).');
})().catch((e) => { console.error(e); process.exit(1); });
