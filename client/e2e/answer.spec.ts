import { expect, test } from '@playwright/test';
import { ask, QUESTIONS, storyHeading, watchForTrouble } from './fixtures';

test.describe('asking a question', () => {
  let trouble: string[] = [];

  test.beforeEach(async ({ page }) => {
    trouble = watchForTrouble(page);
    await page.goto('/');
  });

  test.afterEach(() => {
    expect(trouble, 'the browser reported nothing amiss').toEqual([]);
  });

  test('offers starters, then files an answer with its working attached', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ask a question. Get a filed answer.' })).toBeVisible();

    await page.getByRole('button', { name: new RegExp(QUESTIONS.bar, 'i') }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 40_000 });

    // The story: a headline, a standfirst carrying figures, and pull numbers.
    await expect(storyHeading(page)).toBeVisible();
    await expect(page.getByText(/applications across FY2025/i)).toBeVisible();

    // The chart prints its own values, so nothing is encoded by colour alone.
    const chart = page.locator('.recharts-surface').first();
    await expect(chart).toBeVisible();

    // The evidence rail marks which tables were read.
    await expect(page.getByLabel('Evidence').getByText('onboarding_applications')).toBeVisible();

    // The working is present but not in the way.
    const notes = page.getByRole('button', { name: /Notes on this answer/ });
    await expect(notes).toHaveAttribute('aria-expanded', 'false');
    await notes.click();
    await expect(notes).toHaveAttribute('aria-expanded', 'true');

    await expect(page.getByText('Query as executed')).toBeVisible();
    await expect(page.getByText(/Safety checks — 5 of 5/)).toBeVisible();
  });

  test('charts the measure the question asked about, not merely the first number', async ({
    page,
  }) => {
    await ask(page, QUESTIONS.rate);

    // The result carries applications, rejections and a rate. A chart of volume
    // beneath a headline about rates would be wrong in a way that still looks right.
    await expect(page.getByText('Rejection rate by branch')).toBeVisible();

    const labels = await page.locator('.recharts-label-list text').allTextContents();
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.every((label) => label.endsWith('%'))).toBe(true);

    // Printed to a decimal place, because the ordering depends on it.
    expect(labels[0]).toMatch(/^\d+\.\d%$/);
    expect(parseFloat(labels[0]!)).toBeGreaterThan(parseFloat(labels[1]!) - 0.001);
  });

  test('the figure can be read as a chart or as the rows behind it', async ({ page }) => {
    await ask(page, QUESTIONS.bar);

    await expect(page.locator('.recharts-surface')).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();

    await page.getByRole('button', { name: 'Show as table' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('.recharts-surface')).toBeHidden();

    // The same twelve rows, not a truncated preview of them.
    await expect(page.getByRole('row')).toHaveCount(13);

    await page.getByRole('button', { name: 'Show as chart' }).click();
    await expect(page.locator('.recharts-surface')).toBeVisible();
  });

  test('the query shown is the query that ran, formatted as written', async ({ page }) => {
    await ask(page, QUESTIONS.bar);
    await page.getByRole('button', { name: /Notes on this answer/ }).click();

    const sql = await page.locator('pre').first().innerText();

    // Clause-aligned, as authored — not a one-line reconstruction from the AST.
    expect(sql).toContain('SELECT');
    expect(sql.split('\n').length).toBeGreaterThan(3);
    // The Guard's row cap is visible rather than applied silently.
    expect(sql).toContain('LIMIT 1000');
    // Every value is bound.
    expect(sql).toContain('$1');
    expect(sql).not.toMatch(/'\w+'/);
  });

  test('copy affordances put real content on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ask(page, QUESTIONS.bar);

    await page.getByRole('button', { name: 'Copy data — CSV' }).click();
    const csv = await page.evaluate(() => navigator.clipboard.readText());

    expect(csv.split('\n')[0]).toMatch(/^Month,/);
    expect(csv.split('\n').length).toBe(13);

    await page.getByRole('button', { name: 'Copy SQL' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('SELECT');
  });
});
