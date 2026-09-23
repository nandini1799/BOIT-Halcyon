// Capture all six states for each direction and report any console/page errors.
// Hard gate: any pageerror means do not deliver.
const { chromium } = require('playwright');
const path = require('path');

const DIRS = [
  ['a', 'a-instrument.html'],
  ['b', 'b-broadsheet.html'],
  ['c', 'c-vault.html'],
];
const STATES = ['empty', 'kpi-bar', 'table-line', 'thinking', 'rejected', 'error'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];

  page.on('console', m => {
    if (m.type() === 'error') problems.push(`CONSOLE ${m.text()}`);
  });
  page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));

  for (const [key, file] of DIRS) {
    const url = 'file://' + path.resolve(__dirname, '..', 'design-demos', file);
    await page.goto(url);
    await page.waitForFunction(() => window.__ready === true, { timeout: 5000 });
    await page.waitForTimeout(700); // let webfonts settle

    for (const state of STATES) {
      await page.click(`[data-state-btn="${state}"]`);
      await page.waitForTimeout(260);
      await page.screenshot({
        path: path.resolve(__dirname, '..', 'shots', `${key}-${state}.png`),
        fullPage: true,
      });
    }

    // Open every drawer once: an un-openable drawer is a broken promise.
    await page.click('[data-state-btn="kpi-bar"]');
    await page.waitForTimeout(160);
    const toggles = await page.$$('[data-drawer]');
    for (const t of toggles) {
      if (await t.isVisible()) { await t.click(); await page.waitForTimeout(140); }
    }
    await page.screenshot({
      path: path.resolve(__dirname, '..', 'shots', `${key}-drawer-open.png`),
      fullPage: true,
    });
  }

  await browser.close();
  if (problems.length) {
    console.log('FAIL\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log('OK - 21 screenshots, 0 console errors, 0 page errors');
})();
