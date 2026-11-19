import { expect, test } from '@playwright/test';
import { createDemoTask, expectNoHorizontalScroll, expectNoSeriousA11yViolations, tabTo } from './helpers';

test('new task page: no serious axe violations, skip link works, no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await expectNoSeriousA11yViolations(page, 'New task');
  await expectNoHorizontalScroll(page);
  // On first load focus is at the document start, so the skip link is the first Tab stop.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('progress page with approval dialog: no serious axe violations', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline');
  await expect(page.getByRole('heading', { name: 'Approval needed' })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'Task progress');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Review action' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'Approval dialog');
});

test('unknown outcome and history pages: no serious axe violations', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline', 'timeout-after-save');
  await page.getByRole('button', { name: 'Review action' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('region', { name: /Not confirmed/ })).toBeVisible({ timeout: 10_000 });
  await expectNoSeriousA11yViolations(page, 'Unknown outcome');
  await page.getByRole('link', { name: 'Task history' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Task history' })).toBeFocused();
  await page.getByRole('link', { name: /View journal/ }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'Task history');
  await expectNoHorizontalScroll(page);
});

test('every control on the progress page is reachable by keyboard with a visible focus indicator', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline');
  await expect(page.getByRole('heading', { name: 'Approval needed' })).toBeVisible();
  for (const name of ['Review action', 'Pause', 'Stop', 'What happened?', 'Check status', 'Change instruction']) {
    const button = page.getByRole('button', { name, exact: true });
    await tabTo(page, button, 80);
    const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline, `${name} focus outline`).not.toBe('none');
  }
});

test('spoken status settings are keyboard operable and off by default', async ({ page }) => {
  await page.goto('/');
  const summary = page.getByText('Spoken status settings');
  await tabTo(page, summary, 60);
  await page.keyboard.press('Enter');
  const toggle = page.getByLabel('Speak important status updates aloud');
  await expect(toggle).not.toBeChecked();
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked();
});
