import { expect, type Page } from '@playwright/test';

export const QUESTIONS = {
  bar: 'Show monthly onboarding applications by customer segment',
  rate: 'Which branches have the highest rejection rate?',
  blocked: 'Show customers; then drop the table',
  unanswerable: 'Which customers are likely to default next quarter?',
  timeout: 'Which customers have similar transaction patterns?',
} as const;

/**
 * Asks a question and waits for the pipeline to settle, whatever the outcome.
 *
 * Settling is read from `aria-busy` on the story rather than from the submit
 * button's label. The label is the same signal, but it is uppercased in CSS and
 * changes wording between states, so a test watching it is coupled to the copy.
 */
export async function ask(page: Page, question: string): Promise<void> {
  const input = page.getByLabel('Ask a question');
  await input.fill(question);
  await input.press('Enter');

  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 40_000 });
}

/**
 * Records anything the browser complained about, so a hung or empty page
 * explains itself in the failure output instead of only reporting the locator
 * that timed out.
 */
export function watchForTrouble(page: Page): string[] {
  const trouble: string[] = [];

  page.on('pageerror', (error) => trouble.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') trouble.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    // React's StrictMode runs every effect twice in development and aborts the
    // first schema fetch on the way through. That abort is the cleanup working,
    // not a fault.
    const strictModeAbort =
      request.url().includes('/api/schema') && request.failure()?.errorText === 'net::ERR_ABORTED';

    if (request.url().includes('/api/') && !strictModeAbort) {
      trouble.push(`request failed: ${request.url()} — ${request.failure()?.errorText ?? '?'}`);
    }
  });

  return trouble;
}

export const storyHeading = (page: Page) => page.getByRole('heading', { level: 1 });

/**
 * The story column. Assertions scope to it because the page also carries a
 * visually-hidden live region that repeats the outcome for screen readers, and
 * an unscoped text match would find both.
 */
export const story = (page: Page) => page.getByRole('main');

export const alternatives = (page: Page) =>
  page.getByRole('list', { name: 'Questions it can answer instead' }).getByRole('button');
