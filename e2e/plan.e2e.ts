import { test, expect } from './fixtures';

test('Plan shows the dated team schedule and equivalent distance calculator', async ({
  adminPage,
}) => {
  await adminPage.goto('/plan');
  const tabs = adminPage.getByRole('tablist', { name: 'Plan', exact: true });
  expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  for (const tab of await tabs.getByRole('tab').all())
    expect(await tab.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  await expect(adminPage.getByRole('heading', { level: 2, name: /^Week of / })).toBeVisible();
  await expect(adminPage.getByRole('tab')).toHaveCount(6);
  await expect(adminPage.getByRole('radiogroup', { name: 'Group' })).toHaveCount(0);
  await adminPage.getByRole('tab', { name: 'Calculator', exact: true }).click();
  await expect(
    adminPage.getByRole('heading', { level: 2, name: 'Pace & Distance Calculator' }),
  ).toBeVisible();
  await expect(adminPage.getByLabel('Target E-km')).toHaveValue('10');
  const six = adminPage.getByLabel('Best 6k Split');
  const two = adminPage.getByLabel('Best 2k Split');
  for (const input of [six, two]) await expect(input).toHaveAttribute('inputmode', 'decimal');
  for (const [typed, normalized] of [
    ['1450', '1:45.0'],
    ['145', '1:45'],
    ['145.0', '1:45.0'],
    ['1.45.0', '1:45.0'],
    ['1:45.0', '1:45.0'],
    ['1:45', '1:45'],
    ['105', '1:05'],
  ]) {
    await six.fill(typed);
    await six.press('Tab');
    await expect(six).toHaveValue(normalized);
    await expect(adminPage.getByText('Enter a split like 1:45.0')).toHaveCount(0);
  }
  await two.fill('1450');
  await two.press('Tab');
  await expect(two).toHaveValue('1:45.0');
  await six.fill('160');
  await six.press('Tab');
  await expect(adminPage.getByText('Enter a split like 1:45.0')).toBeVisible();
  await six.fill('1450');
  await six.press('Tab');
  await adminPage.screenshot({
    path: test.info().outputPath('split-calculator.png'),
  });
  const row = adminPage
    .getByRole('row')
    .filter({ has: adminPage.getByRole('rowheader', { name: 'E', exact: true }) });
  await expect(row.getByRole('cell').nth(1)).toHaveText('30.0');
});
