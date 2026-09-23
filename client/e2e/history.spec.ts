import { expect, test } from '@playwright/test';
import { ask, QUESTIONS, story, storyHeading } from './fixtures';

test.describe('the filing cabinet', () => {
  test('files every question and restores one unchanged', async ({ page }) => {
    await page.goto('/');
    await ask(page, QUESTIONS.bar);
    const headline = await storyHeading(page).innerText();

    await ask(page, QUESTIONS.blocked);
    await expect(story(page).getByText('Blocked before execution')).toBeVisible();

    await page.getByRole('button', { name: 'Open filed answers' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Filed answers')).toBeVisible();

    // Both outcomes are recorded, the refusal as prominently as the answer.
    await expect(drawer.getByText('blocked').first()).toBeVisible();
    await expect(drawer.getByText('answered').first()).toBeVisible();

    // Re-opening restores what was filed rather than re-running the query.
    await drawer.getByText(QUESTIONS.bar, { exact: false }).first().click();
    await expect(drawer).toBeHidden();
    await expect(storyHeading(page)).toHaveText(headline);
  });

  test('Escape closes the drawer and hands focus back to the control that opened it', async ({
    page,
  }) => {
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Open filed answers' });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    // Without this the keyboard user is dropped at the top of the document.
    await expect(trigger).toBeFocused();
  });
});
