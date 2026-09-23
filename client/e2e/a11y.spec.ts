import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ask, QUESTIONS } from './fixtures';

const audit = async (page: Page): Promise<string[]> => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}) — ${violation.help}\n    ${violation.nodes
        .map((node) => node.target.join(' '))
        .join('\n    ')}`,
  );
};

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('no WCAG AA violations in any state', async ({ page }) => {
    expect(await audit(page), 'empty state').toEqual([]);

    await ask(page, QUESTIONS.bar);
    expect(await audit(page), 'answered state').toEqual([]);

    // The table is the only readable form of a grouped chart's numbers, so the
    // view it hides behind has to be audited too, not just the default one.
    await page.getByRole('button', { name: 'Show as table' }).click();
    expect(await audit(page), 'figure switched to table').toEqual([]);

    await page.getByRole('button', { name: /How the query was written/ }).click();
    expect(await audit(page), 'generator card open').toEqual([]);

    await page.getByRole('button', { name: /Notes on this answer/ }).click();
    expect(await audit(page), 'notes open').toEqual([]);

    await ask(page, QUESTIONS.blocked);
    expect(await audit(page), 'blocked state').toEqual([]);

    await page.getByRole('button', { name: 'Open filed answers' }).click();
    expect(await audit(page), 'history drawer open').toEqual([]);
  });

  test('the keyboard starts at the ask bar, with the chrome one step behind', async ({ page }) => {
    // In place of a skip link: focus already begins past the chrome.
    await expect(page.getByLabel('Ask a question')).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Open filed answers' })).toBeFocused();
  });

  test('the ask bar shows focus on its underline, having no outline of its own', async ({
    page,
  }) => {
    const input = page.getByLabel('Ask a question');
    const underline = page.locator('form div').first();

    // The bar takes focus on load, so it has to be released to see it resting.
    await input.blur();
    const resting = await underline.evaluate((el) => getComputedStyle(el).borderBottomColor);

    await input.focus();
    const focused = await underline.evaluate((el) => getComputedStyle(el).borderBottomColor);

    expect(resting).toBe('rgb(69, 59, 51)');
    expect(focused).toBe('rgb(255, 158, 122)');
  });

  test('a screen reader is told what became of the question', async ({ page }) => {
    const status = page.getByRole('status');

    await ask(page, QUESTIONS.bar);
    await expect(status).toContainText(/^Answered\./);

    await ask(page, QUESTIONS.blocked);
    await expect(status).toContainText(/^Blocked before execution\./);
  });

  test('the pipeline is marked busy only while it is running', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main).toHaveAttribute('aria-busy', 'false');

    const input = page.getByLabel('Ask a question');
    await input.fill(QUESTIONS.bar);
    await input.press('Enter');
    await expect(main).toHaveAttribute('aria-busy', 'true');

    await expect(main).toHaveAttribute('aria-busy', 'false', { timeout: 40_000 });
  });

  test('every stage of the pipeline states its status in words', async ({ page }) => {
    const input = page.getByLabel('Ask a question');
    await input.fill(QUESTIONS.bar);
    await input.press('Enter');

    // Colour alone distinguishes the dots; the text is what a reader hears.
    await expect(page.getByText('in progress').first()).toBeAttached();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 40_000 });
  });
});

test.describe('responsive', () => {
  for (const [label, width] of [
    ['narrow phone', 375],
    ['phone', 430],
    ['tablet', 834],
    ['laptop', 1280],
  ] as const) {
    test(`lays out without horizontal overflow at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await ask(page, QUESTIONS.bar);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the page should never scroll sideways').toBeLessThanOrEqual(0);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
});
