import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/** Presses Tab until `target` has focus, failing if it is not reachable by keyboard. */
export async function tabTo(page: Page, target: Locator, maxPresses = 40): Promise<void> {
  for (let i = 0; i < maxPresses; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, 'element should be reachable with Tab').toBeFocused();
}

export async function expectNoSeriousA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    `axe serious/critical violations on ${label}`,
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Creates a task in demo mode with a given scenario and waits for the progress page. */
export async function createDemoTask(page: Page, instruction: string, scenario = 'standard'): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Task instruction').fill(instruction);
  await page.getByLabel('Demo scenario (simulated)').selectOption(scenario);
  await page.getByRole('button', { name: 'Start task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Task progress' })).toBeVisible();
}
