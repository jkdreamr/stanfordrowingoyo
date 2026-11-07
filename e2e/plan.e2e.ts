import { test, expect } from './fixtures';

test('Plan shows the fortnight schedule and equivalent distance calculator', async ({
  adminPage,
}) => {
  await adminPage.goto('/plan');
  const tabs = adminPage.getByRole('tablist', { name: 'Plan', exact: true });
  expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  for (const tab of await tabs.getByRole('tab').all())
    expect(await tab.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  await expect(
    adminPage.getByRole('heading', { level: 2, name: 'Sample Fortnight' }),
  ).toBeVisible();
  await expect(adminPage.getByRole('heading', { name: 'Week 1', exact: true })).toBeVisible();
  await adminPage.getByRole('tab', { name: 'Calculator', exact: true }).click();
  await expect(
    adminPage.getByRole('heading', { level: 2, name: 'Pace & Distance Calculator' }),
  ).toBeVisible();
  await expect(adminPage.getByLabel('Target E-km')).toHaveValue('10');
  const row = adminPage
    .getByRole('row')
    .filter({ has: adminPage.getByRole('rowheader', { name: 'E', exact: true }) });
  await expect(row.getByRole('cell').nth(1)).toHaveText('30.0');
});
