import { test, expect } from './fixtures';
import { seedEntry } from './helpers';
import { csrfHeaders } from './api';

test('weekly percent ranks this test’s rowers relatively', async ({ makeRower }) => {
  const rowers = await Promise.all([makeRower(), makeRower(), makeRower()]);
  for (const [i, rower] of rowers.entries()) {
    await expect(
      await rower.context.request.put('/api/me/target', {
        data: { target_m: 50000 },
        headers: csrfHeaders,
      }),
    ).toBeOK();
    await seedEntry(rower, `Leaderboard ${rower.user.id}`, (i + 1) * 10000);
  }
  const page = rowers[0].page;
  await page.goto('/leaderboard');
  const metric = page.getByRole('radiogroup', { name: 'Leaderboard Metric' });
  await metric.getByRole('radio', { name: 'Meters', exact: true }).click();
  await expect(page).toHaveURL(/metric=meters/);
  await metric.getByRole('radio', { name: '% of Target', exact: true }).click();
  await expect(metric.getByRole('radio', { name: '% of Target', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page).not.toHaveURL(/metric=/);
  await expect(page.getByRole('button', { name: 'Next Week' })).toBeDisabled();
  const items = page.getByRole('main').getByRole('listitem');
  for (const rower of rowers)
    await expect(items.filter({ hasText: rower.user.name })).toHaveCount(1);
  const names = await items.allTextContents();
  const positions = rowers.map((r) => names.findIndex((text) => text.includes(r.user.name)));
  for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
  expect(positions[2]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[0]);
  for (const [i, rower] of rowers.entries())
    await expect(items.filter({ hasText: rower.user.name })).toContainText(`${(i + 1) * 20}%`);
  const mine = items.filter({ hasText: rowers[0].user.name }).getByRole('link');
  await expect(mine).toContainText('You');
  await expect(mine).toHaveAttribute('href', '/me');
  await expect(items.filter({ hasText: rowers[1].user.name }).getByRole('link')).toHaveAttribute(
    'href',
    `/users/${rowers[1].user.id}`,
  );
  await page.getByRole('button', { name: 'Previous Week' }).click();
  await expect(page).toHaveURL(/week=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByText('Last Week', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Last Week', { exact: true })).toBeVisible();
});
