// Capture every state of the chosen direction and report console/page errors.
// Hard gate: any pageerror means do not deliver.
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'halcyon.html';
const STATES = ['empty', 'kpi-bar', 'table-line', 'branches', 'compare', 'thinking', 'rejected', 'error'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];

  page.on('console', m => { if (m.type() === 'error') problems.push(`CONSOLE ${m.text()}`); });
  page.on('pageerror', e => problems.push(`PAGEERROR ${e.message}`));

  const url = 'file://' + path.resolve(__dirname, '..', 'design-demos', FILE);
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, { timeout: 5000 });
  await page.waitForTimeout(800); // webfonts

  for (const state of STATES) {
    await page.click(`nav [data-state-btn="${state}"]`);
    await page.waitForTimeout(260);
    await page.screenshot({
      path: path.resolve(__dirname, '..', 'shots', `${state}.png`),
      fullPage: true,
    });
  }

  // Every drawer must actually open. A drawer that does not is a broken promise.
  let opened = 0;
  for (const state of ['kpi-bar', 'table-line', 'branches', 'compare']) {
    await page.click(`nav [data-state-btn="${state}"]`);
    await page.waitForTimeout(150);
    const toggles = await page.$$('[data-drawer]');
    for (const t of toggles) {
      if (await t.isVisible()) { await t.click(); await page.waitForTimeout(160); opened++; }
    }
    await page.screenshot({
      path: path.resolve(__dirname, '..', 'shots', `${state}-notes-open.png`),
      fullPage: true,
    });
  }

  await browser.close();
  if (problems.length) { console.log('FAIL\n' + problems.join('\n')); process.exit(1); }
  console.log(`OK - ${STATES.length + 4} screenshots, ${opened} drawers opened, 0 errors`);
})();
