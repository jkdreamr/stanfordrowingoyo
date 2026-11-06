import { test, expect } from './fixtures';
import { logEntry, equivalentMeters, formatMeters } from './helpers';

test('weekly target drives Home progress and remaining meters', async ({ makeRower }) => {
  const { page } = await makeRower();
  await page
    .getByRole('link', { name: 'Weekly progress. Change your target', exact: true })
    .click();
  await page.getByLabel('Personal Target', { exact: true }).fill('50000');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Weekly target saved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }).click();
  await logEntry(page, 'bike', 'E', 60000, 'E2E target workout');
  const meters = equivalentMeters(60000, 'bike', 'E');
  const hero = page.getByRole('link', { name: 'Weekly progress. Change your target', exact: true });
  await expect(hero.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(meters));
  await expect(hero.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '50000');
  await expect(hero.getByText('40%', { exact: true })).toBeVisible();
  await expect(
    hero.getByText(
      new RegExp(`${formatMeters(50000 - meters).replace(/ m$/, ' E-meters')}.*remaining`, 'i'),
    ),
  ).toBeVisible();
});
