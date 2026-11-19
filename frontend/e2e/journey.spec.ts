/**
 * SIMULATED first-milestone journey in demo mode. Nothing here touches a real portal, calendar,
 * gateway or model. It proves the frontend behaviour only.
 */
import { expect, test } from '@playwright/test';
import { createDemoTask, tabTo } from './helpers';

const CORRECTED = 'Read my assignment deadline and create a reminder in my test calendar.';

test('keyboard-only: voice transcript review, plan, approval, verification, completion', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mode-banner')).toContainText('Demo mode — simulated data');

  // 1–2. Speak (simulated transcript) and correct it before submitting.
  await tabTo(page, page.getByRole('button', { name: 'Use simulated voice transcript (demo)' }));
  await page.keyboard.press('Enter');
  const instruction = page.getByLabel('Task instruction');
  await expect(instruction).toHaveValue(/dead line .* calender/);
  await expect(instruction).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(CORRECTED);
  await tabTo(page, page.getByRole('button', { name: 'Start task' }));
  await page.keyboard.press('Enter');

  // 3. Structured task and plan appear; focus moves to the page heading.
  const h1 = page.getByRole('heading', { level: 1, name: 'Task progress' });
  await expect(h1).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Plan, version 1' })).toBeVisible();

  // 4–5. Portal step verified, calendar write enters approval.
  await expect(page.getByRole('heading', { name: 'Approval needed' })).toBeVisible();
  const step1 = page.locator('li.step').nth(0);
  await expect(step1.locator('.badge')).toHaveText(/Verified/);

  // 6–7. Approval dialog shows exact details; approve with the keyboard.
  await tabTo(page, page.getByRole('button', { name: 'Review action' }));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Approve this action?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('create_calendar_event');
  await expect(dialog).toContainText('CS 160 Assignment 3 due');
  await expect(dialog).toContainText('AccessPilot test calendar (simulated)');
  await expect(dialog.getByRole('heading', { name: 'Approve this action?' })).toBeFocused();
  await tabTo(page, dialog.getByRole('button', { name: 'Approve' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();

  // 8–10. Execution is reported separately from verification; completion only after verification.
  await expect(page.getByText(/Completed and verified: the backend confirmed every step/)).toBeVisible({ timeout: 10_000 });
  const journal = page.getByRole('region', { name: 'Task journal' });
  await expect(journal).toContainText('Simulated API adapter reported SUCCESS for create_calendar_event (not yet verified)');
  await expect(journal).toContainText('Independent simulated read-back confirmed create_calendar_event');
  await expect(page.locator('li.step .badge')).toHaveText([/Verified/, /Verified/, /Verified/]);
  await expect(page.getByTestId('approval-status')).toContainText('Backend confirmed the next state');
});

test('pause, correct to plan version 2, then timeout-after-save is shown as not confirmed', async ({ page }) => {
  await createDemoTask(page, 'Create a reminder for my assignment deadline', 'timeout-after-save');
  await expect(page.getByRole('heading', { name: 'Approval needed' })).toBeVisible();

  // 11. Pause.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('control-feedback')).toContainText('Backend confirmed pause request. Task status: Paused.');

  // 12–13. Correct the date/time; plan version 2 appears and verified work is kept.
  await page.getByRole('button', { name: 'Change instruction' }).click();
  await page.getByLabel('New or corrected instruction').fill('Actually change it to Thursday at 4 pm');
  await page.getByRole('button', { name: 'Send change' }).click();
  await expect(page.getByRole('heading', { name: 'Plan, version 2' })).toBeFocused();
  await expect(page.locator('li.step').nth(0).locator('.badge')).toHaveText(/Verified/);

  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Review action' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('2026-12-03');
  await expect(dialog).toContainText('16:00');
  await expect(dialog.locator('.kv-row', { hasText: 'Plan version' })).toContainText('2');
  await dialog.getByRole('button', { name: 'Approve' }).click();

  // 14. Uncertain timeout-after-save.
  const panel = page.getByRole('region', { name: /Not confirmed/ });
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText('The action may have occurred, but it has not been confirmed.');
  await expect(page.locator('.badge', { hasText: 'Needs your attention' })).toBeVisible();

  // 15. No unsafe retry; no duplicate write events.
  await expect(page.getByRole('button', { name: /retry|try again/i })).toHaveCount(0);
  await expect(page.getByText(/Completed and verified/)).toHaveCount(0);
  const journal = page.getByRole('region', { name: 'Task journal' });
  await expect(journal.getByText('Simulated timeout after save: the write may have happened. Not retried.')).toHaveCount(1);
  await expect(journal.getByText(/adapter reported SUCCESS for create_calendar_event/)).toHaveCount(0);

  await panel.getByRole('button', { name: 'What happened?' }).click();
  await expect(page.getByRole('heading', { name: 'What happened' })).toBeVisible();
  await expect(page.locator('#main').getByText(/may or may not exist/)).toBeVisible();
});

test('rejecting an approval blocks the step and pauses the task', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline');
  await page.getByRole('button', { name: 'Review action' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click();
  await expect(page.locator('li.step').nth(1).locator('.badge')).toHaveText(/Blocked/);
  await expect(page.locator('.kv-row', { hasText: 'Status' }).first()).toContainText('Paused');
});

test('stale approval is refused and can be reviewed again for the current plan', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline', 'stale-approval');
  await page.getByRole('button', { name: 'Review action' }).click();
  const dialog = page.getByRole('dialog');
  // The demo backend simulates a concurrent plan change that lands just before this decision.
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(dialog.getByText('The plan changed')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Review the current request' }).click();
  await expect(page.getByRole('dialog').locator('.kv-row', { hasText: 'Plan version' })).toContainText('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Completed and verified: the backend confirmed/)).toBeVisible({ timeout: 10_000 });
});

test('closing the approval dialog with Escape returns focus to the opener', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline');
  const opener = page.getByRole('button', { name: 'Review action' });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(opener).toBeFocused();
});

test('simulated reconnect does not duplicate journal entries', async ({ page }) => {
  await createDemoTask(page, 'Remind me of my deadline');
  await expect(page.getByRole('heading', { name: 'Approval needed' })).toBeVisible();
  const entries = page.locator('.journal-entry');
  const before = await entries.count();
  await page.getByRole('button', { name: 'Simulate connection drop (demo)' }).click();
  await expect(page.getByTestId('stream-status')).toContainText('Receiving task updates.');
  await expect(entries).toHaveCount(before);
});

test('network error on create is shown and nothing is created', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Task instruction').fill('Anything');
  await page.getByLabel('Demo scenario (simulated)').selectOption('network-error');
  await page.getByRole('button', { name: 'Start task' }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach AccessPilot');
  await expect(page.getByRole('heading', { level: 1, name: 'Start a new task' })).toBeVisible();
});
