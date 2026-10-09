// End-to-end smoke test in a real browser (Chromium via Playwright).
// Run: npm run e2e   (needs `npm i -D playwright` or a global Playwright install)
// Fails on any uncaught page error or console error, including in hostile-input scenarios.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const outDir = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'cvforge-e2e-'));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const step = (s) => console.log('•', s);
  const expect = (cond, msg) => { if (!cond) throw new Error('Assertion failed: ' + msg); };

  await page.goto(url);
  step('app loads with empty memory');
  expect(await page.locator('#tab-memory').isVisible(), 'memory tab visible');

  step('load example profile');
  await page.click('summary:has-text("More ▾")');
  await page.click('[data-action="load-example"]');
  await page.waitForSelector('[data-path="basics.name"]');
  expect(await page.inputValue('[data-path="basics.name"]') === 'Alex Morgan', 'example loaded');

  step('edit memory fields (typing is saved)');
  await page.fill('[data-path="basics.location"]', 'Austin, Texas');
  await page.click('[data-action="add-entry"][data-list="experience"]');
  await page.fill('[data-path="experience.0.role"]', 'Freelance Frontend Engineer');
  await page.fill('[data-path="experience.0.company"]', 'Self-employed');
  await page.fill('[data-path="experience.0.start"]', '2018-01');
  await page.fill('[data-path="experience.0.end"]', '2019-05');
  await page.fill('[data-path="experience.0.bullets"]', 'Built 12 responsive marketing sites in React for local businesses\n- Wrote Cypress end-to-end tests for every launch');
  await page.waitForTimeout(600);

  step('paste a job and see the analysis');
  await page.click('[data-tab="job"]');
  await page.click('[data-action="example-job"]');
  await page.waitForSelector('#analysisView .chip');
  const analysisText = await page.textContent('#analysisView');
  expect(/Senior Frontend Engineer/.test(analysisText), 'title detected');
  await page.screenshot({ path: path.join(outDir, '2-job.png'), fullPage: true });

  step('build the tailored CV');
  await page.click('[data-action="build"]');
  await page.waitForSelector('#cvPreview .cv-name');
  const score = Number(await page.textContent('.ring span'));
  expect(score > 50 && score <= 100, 'score in range: ' + score);
  const cvText = await page.textContent('#cvPreview');
  expect(cvText.includes('Cypress'), 'new memory bullet with Cypress used');
  await page.screenshot({ path: path.join(outDir, '3-cv.png'), fullPage: true });

  step('live summary edit re-scores');
  await page.fill('#cvSummary', 'Frontend engineer specialising in React, TypeScript, Playwright testing and accessibility.');
  await page.waitForTimeout(600);
  expect((await page.textContent('#cvPreview')).includes('Playwright testing'), 'preview updated');

  step('switch templates');
  for (const t of ['modern', 'compact', 'classic']) { await page.click(`[data-template="${t}"]`); await page.waitForSelector(`.cv--${t}`); }

  step('downloads: docx, txt, md, html');
  for (const [action, ext] of [['download-docx', '.docx'], ['download-txt', '.txt'], ['download-md', '.md'], ['download-html', '.html']]) {
    if (action !== 'download-docx') await page.click('summary:has-text("More formats")');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-action="${action}"]`)]);
    const target = path.join(outDir, dl.suggestedFilename());
    await dl.saveAs(target);
    expect(target.endsWith(ext) && fs.statSync(target).size > 500, action + ' file written');
  }

  step('PDF (print) does not throw');
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('[data-action="download-pdf"]');
  await page.waitForTimeout(500);

  step('save to applications and reopen');
  await page.click('[data-action="save-application"]');
  await page.click('[data-tab="history"]');
  expect(await page.locator('#historyView tbody tr').count() === 1, 'one application');
  await page.selectOption('[data-history-status="0"]', 'applied');
  await page.click('[data-action="history-open"]');
  await page.waitForSelector('#cvPreview .cv-name');

  step('data survives a reload');
  await page.reload();
  expect(await page.inputValue('[data-path="basics.location"]') === 'Austin, Texas', 'memory persisted');
  await page.click('[data-tab="history"]');
  expect(await page.locator('#historyView tbody tr').count() === 1, 'history persisted');

  step('paste-CV importer');
  await page.click('[data-tab="memory"]');
  await page.click('[data-action="import-text"]');
  await page.fill('#importText', 'Jane Roe\nAnimator\njane@example.com\n\nEXPERIENCE\nLead Animator — Big Studio\nMar 2020 – Present\n• Animated 40 episodes in Blender\n\nSKILLS\nBlender, Maya, After Effects');
  await page.click('.dialog button[value="ok"]');
  await page.waitForTimeout(300);
  expect((await page.locator('.entry-title').allTextContents()).some((t) => t.includes('Big Studio')), 'imported role merged');

  step('hostile inputs do not crash the app');
  await page.fill('[data-path="basics.name"]', '<script>alert(1)</script><img src=x onerror=alert(2)>');
  await page.click('[data-sec="summary"] > summary');
  await page.fill('[data-path="summary"]', '\u0000'.repeat(10) + '💥'.repeat(500));
  await page.click('[data-tab="job"]');
  await page.fill('#jobText', '((((((([[[[ ' + 'x'.repeat(59000));
  await page.waitForTimeout(500);
  await page.click('[data-action="build"]');
  await page.waitForSelector('#cvPreview .cv-name');
  expect(await page.locator('#cvPreview img').count() === 0, 'no injected markup');

  step('corrupted storage is recovered');
  await page.evaluate(() => localStorage.setItem('cvforge.v2.state', '{not json'));
  await page.reload();
  await page.waitForSelector('#memoryForm .sec');

  step('settings render; AI without key fails gracefully');
  await page.click('[data-tab="settings"]');
  await page.check('[data-setting="aiEnabled"]');
  await page.click('[data-tab="cv"]');
  await page.waitForSelector('#cvSide');

  step('mobile layout');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-tab="memory"]');
  await page.screenshot({ path: path.join(outDir, '1-memory-mobile.png'), fullPage: false });
  const overflow = await page.evaluate(() => {
    const W = window.innerWidth, wide = [];
    document.querySelectorAll('main *, .topbar *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0 && !el.closest('.tabs')) wide.push(el.tagName + '.' + el.className + ' ' + Math.round(r.right)); });
    return { px: document.documentElement.scrollWidth - W, wide: wide.slice(0, 5) };
  });
  expect(overflow.px <= 1, 'no horizontal scroll on mobile (' + overflow.px + 'px) ' + overflow.wide.join(', '));

  await browser.close();
  if (errors.length) { console.error('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nE2E passed. Screenshots and downloads in ' + outDir);
})().catch((e) => { console.error(e); process.exit(1); });
