import { expect, test } from '@playwright/test';
import { alternatives, ask, QUESTIONS, story, watchForTrouble } from './fixtures';

test.describe('what happens when it will not answer', () => {
  let trouble: string[] = [];

  test.beforeEach(async ({ page }) => {
    trouble = watchForTrouble(page);
    await page.goto('/');
  });

  test.afterEach(() => {
    expect(trouble, 'the browser reported nothing amiss').toEqual([]);
  });

  test('refuses a write and shows the statement it refused', async ({ page }) => {
    await ask(page, QUESTIONS.blocked);

    await expect(story(page).getByText('Blocked before execution')).toBeVisible();
    await expect(story(page).getByText('Refused statement — never executed')).toBeVisible();

    // The dangerous verb is shown, not summarised away.
    await expect(page.locator('pre').first()).toContainText('DROP');

    // Failed checks say which, and why, with an icon as well as a colour.
    await expect(story(page).getByText('2 statements were submitted; only one is permitted.')).toBeVisible();
    await expect(
      story(page).getByText('A DROP statement cannot be executed; only SELECT is permitted.'),
    ).toBeVisible();
    await expect(story(page).getByText('— failed').first()).toBeAttached();
  });

  test('declines a forecast rather than approximating one', async ({ page }) => {
    await ask(page, QUESTIONS.unanswerable);

    await expect(story(page).getByText('Cannot be answered from this data')).toBeVisible();

    // The refusal names the field someone might have reached for, and says why
    // it was not used. A generic "outside what I can answer" would tell the
    // reader nothing they had not worked out from not getting an answer.
    await expect(story(page).getByText(/customers\.risk_band/)).toBeVisible();
    await expect(story(page).getByText(/would be wrong, so it has not been used/)).toBeVisible();

    // It offers a way forward instead of a dead end.
    expect(await alternatives(page).count()).toBeGreaterThan(0);
  });

  test('a suggested alternative can be asked straight away', async ({ page }) => {
    await ask(page, QUESTIONS.unanswerable);

    await alternatives(page).first().click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 40_000 });

    await expect(story(page).getByText('Cannot be answered from this data')).toBeHidden();
  });

  test('says so when the server refuses the request, rather than thinking for ever', async ({
    page,
  }) => {
    // A refusal has a body, but not an event stream. Read as one it yields no
    // events and ends cleanly, which once left the UI filing indefinitely.
    await page.route('**/api/ask', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too many questions in a short time.' }),
      }),
    );

    const input = page.getByLabel('Ask a question');
    await input.fill(QUESTIONS.bar);
    await input.press('Enter');

    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 });
    await expect(story(page).getByText('Not asked')).toBeVisible();
    await expect(story(page).getByText(/Too many questions in a short time/)).toBeVisible();

    // The 429 is this test's own doing, so it is accounted for rather than
    // left for the shared check to report as an unexplained fault.
    expect(trouble.filter((entry) => !entry.includes('429'))).toEqual([]);
    trouble.length = 0;
  });

  test('reports a timeout as a timeout, with nothing partial shown', async ({ page }) => {
    await ask(page, QUESTIONS.timeout);

    await expect(story(page).getByText('Query timed out')).toBeVisible();
    await expect(story(page).getByText('57014 — statement_timeout')).toBeVisible();
    await expect(page.locator('.recharts-surface')).toHaveCount(0);
  });
});
