import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

test('sheets keep pointer focus quiet and keyboard focus visible', async ({ adminPage }) => {
  await adminPage.goto('/admin/roster');
  const row = adminPage.getByRole('button').filter({ hasText: 'Joshua Koo' });
  await row.click();
  const sheet = adminPage.getByRole('dialog', { name: 'Edit Person', exact: true });
  await expect(sheet.getByRole('heading', { name: 'Edit Person' })).toBeFocused();
  expect(
    await sheet
      .getByRole('heading', { name: 'Edit Person' })
      .evaluate((element) => getComputedStyle(element).outlineColor),
  ).toBe('rgba(0, 0, 0, 0)');
  await adminPage.keyboard.press('Tab');
  const close = sheet.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  expect(await close.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await adminPage.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(row).toBeFocused();
  await row.press('Enter');
  await expect(close).toBeFocused();
  expect(await close.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
});

test('compliance shows the current-week not-logged list and week navigation', async ({
  adminPage,
  makeRower,
}) => {
  const rower = await makeRower();
  await adminPage.goto('/admin/compliance');
  const notLogged = adminPage
    .locator('.ui-card')
    .filter({ has: adminPage.getByRole('heading', { name: 'Not Yet Logged' }) });
  await expect(notLogged).toContainText(rower.user.name);
  await expect(adminPage.getByRole('button', { name: 'Next Week' })).toBeDisabled();
  await adminPage.getByRole('radio', { name: 'Name', exact: true }).click();
  await seedEntry(rower, 'E2E compliance workout');
  await adminPage.reload();
  await expect(notLogged).not.toContainText(rower.user.name);
  await adminPage.getByRole('button', { name: 'Previous Week' }).click();
  await expect(notLogged).toContainText(rower.user.name);
  await expect(adminPage.getByRole('button', { name: 'Next Week' })).toBeEnabled();
});

test('settings validates drafts, confirms recalculation and records the result in audit', async ({
  adminPage,
}) => {
  await adminPage.goto('/admin/settings');
  const factor = adminPage.getByRole('textbox', { name: 'Zone E', exact: true });
  await expect(factor).toBeVisible();
  const original = await factor.inputValue();
  await factor.fill('0');
  await expect(
    adminPage.getByText('Use a factor from 0.01 to 100.', { exact: true }),
  ).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  await adminPage.getByRole('link', { name: 'Back', exact: true }).click();
  const discard = adminPage.getByRole('dialog', { name: 'Discard Changes?' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(discard).not.toBeVisible();
  await factor.fill(Number(original).toFixed(4));
  await adminPage.getByRole('button', { name: 'Save Settings' }).click();
  await expect(adminPage.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  await adminPage.getByRole('button', { name: 'Recalculate All Entries', exact: true }).click();
  const confirm = adminPage.getByRole('dialog', { name: 'Recalculate All Entries?', exact: true });
  await expect(confirm).toContainText('every existing entry');
  await confirm.getByRole('button', { name: 'Recalculate Entries', exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await expect(adminPage.locator('p[role="status"]')).toHaveText(/^Updated [\d,]+ entries$/);
  await adminPage.goto('/admin/audit');
  await expect(adminPage.getByText(/recalculated training entries/).first()).toBeVisible();
});

test('export validates dates and downloads the backend CSV', async ({ adminPage }) => {
  await adminPage.goto('/admin/export');
  await adminPage.getByRole('button', { name: 'Last 30 Days', exact: true }).click();
  await adminPage.getByLabel('Start Date', { exact: true }).fill('2026-12-02');
  await adminPage.getByLabel('End Date', { exact: true }).fill('2026-12-01');
  await expect(adminPage.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  await expect(adminPage.getByText('End date must be on or after the start date.')).toBeVisible();
  await adminPage.getByRole('button', { name: 'This Week', exact: true }).click();
  const downloading = adminPage.waitForEvent('download');
  await adminPage.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^oyo-entries-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  expect(await download.failure()).toBeNull();
});
