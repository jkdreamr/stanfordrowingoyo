import { test, expect } from './fixtures';
import { seedEntry, formatMeters } from './helpers';
import { csrfHeaders } from './api';

test('Me shows mileage, ranges, keyboard scrubbing, year stats and entry filters', async ({
  makeRower,
}) => {
  const rower = await makeRower();
  await expect(
    await rower.context.request.put('/api/me/target', {
      data: { target_m: 50000 },
      headers: csrfHeaders,
    }),
  ).toBeOK();
  const first = await seedEntry(rower, 'Me Morning Erg', 10000);
  const second = await seedEntry(rower, 'Me Evening Erg', 5000);
  const { page } = rower;
  await page.goto('/me');
  const chart = page.getByRole('region', { name: 'Season Mileage' });
  const total = formatMeters(first.equiv_m + second.equiv_m);
  await expect(chart.getByText(total, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
  for (const range of ['1W', '1M', '3M', 'All', 'Season']) {
    const button = chart.getByRole('button', { name: range, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(chart.getByText(total, { exact: true })).toBeVisible();
  }
  const plot = chart.getByRole('img', { name: /^Cumulative E-meters/ });
  await plot.focus();
  await plot.press('Home');
  await expect(chart.locator('[aria-live="polite"]')).toContainText(/\w+, \w+ \d+, [\d,]+ m/);
  await expect(chart.getByText(/since /)).toBeVisible();
  await plot.press('End');
  await expect(chart.locator('[aria-live="polite"]')).toContainText(total);
  await plot.press('Escape');
  await expect(chart.locator('[aria-live="polite"]')).toHaveText('Showing latest total');
  await page.getByRole('tab', { name: 'Calendar Year', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Calendar Year', exact: true });
  await expect(panel.getByText(total, { exact: true }).first()).toBeVisible();
  await expect(panel.getByRole('img', { name: /^Weekly volume/ })).toBeVisible();
  const entries = page.getByRole('region', { name: 'My Entries' });
  await expect(entries.getByRole('link', { name: /Me Morning Erg/ })).toBeVisible();
  await expect(entries.getByRole('link', { name: /Me Evening Erg/ })).toBeVisible();
  await entries.getByRole('radio', { name: 'Bike', exact: true }).click();
  await expect(entries.getByText('No Matching Sessions', { exact: true })).toBeVisible();
  await entries.getByRole('button', { name: 'Clear Filters' }).click();
  await entries.getByLabel('Zone', { exact: true }).selectOption('A');
  await expect(entries.getByText('No Matching Sessions', { exact: true })).toBeVisible();
  await entries.getByRole('button', { name: 'Clear Filters' }).click();
  await expect(entries.getByRole('link', { name: /Me Morning Erg/ })).toBeVisible();
});
