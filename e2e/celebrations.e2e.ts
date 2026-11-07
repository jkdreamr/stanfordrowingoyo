import { join } from 'node:path';
import { addDays, seasonRange } from '../shared/dates';
import type { Config } from '../shared/types';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, seedEntry } from './helpers';

test('logging beats a prior best week and celebrates once on Home', async ({ makeRower }) => {
  const rower = await makeRower();
  const { page, context } = rower;
  const response = await context.request.get('/api/config');
  const config: Config = await response.json();
  const start = seasonRange(config.today, config.season_start).start;
  const priorWeek = addDays(config.current_week_start, -7);
  const baseline = await seedEntry(rower, 'Previous Best Week', 10000);
  await expect(
    await context.request.put('/api/me/target', {
      headers: csrfHeaders,
      data: { target_m: 10000 },
    }),
  ).toBeOK();
  await expect(
    await context.request.patch(`/api/entries/${baseline.id}`, {
      headers: csrfHeaders,
      data: { date: priorWeek >= start ? priorWeek : start },
    }),
  ).toBeOK();
  await seedEntry(rower, 'Current Week', 4000);
  await page.reload();
  await logEntry(page, 'erg', 'E', 8000, 'New Best Week Workout');
  const status = page.getByRole('status').filter({ hasText: 'New Best Week' });
  await expect(status).toBeVisible();
  await expect(status).toContainText(priorWeek >= start ? '12.0k m' : '22.0k m');
  await expect(page.locator('.ui-finish-tick')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss Celebration' }).click();
  await expect(status).toHaveCount(0);
  const entryResponse = await context.request.get('/api/entries?scope=mine');
  const { items } = await entryResponse.json();
  const entry = items.find((item: { title: string }) => item.title === 'New Best Week Workout');
  await page.goto(`/log?edit=${entry.id}`);
  await page.getByRole('textbox', { name: 'Meters', exact: true }).fill('9000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await expect(status).toHaveCount(0);
});

test('split best waits for Save as Best, then updates the profile benchmark', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  await expect(
    await context.request.patch('/api/me', {
      headers: csrfHeaders,
      data: { best2k_split_s: 100 },
    }),
  ).toBeOK();
  await page.evaluate(() => localStorage.setItem('theme', 'system'));
  await page.reload();
  await page
    .locator('.shell-sidebar, .shell-tabbar')
    .getByRole('link', { name: 'Log Session', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('textbox', { name: 'Meters', exact: true }).fill('2000');
  await page.getByRole('button', { name: 'Add Details' }).click();
  await page.getByLabel('Split /500m', { exact: true }).fill('1:38.2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const status = page.getByRole('status').filter({ hasText: 'New 2k Best' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('1:38.2 /500m');
  expect((await (await context.request.get('/api/me')).json()).best2k_split_s).toBe(100);
  if (testInfo.project.name === 'iphone-15') {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      if (scheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expect(status.locator('..').locator('..').locator('.lucide-trophy')).toHaveCSS(
        'color',
        scheme === 'light' ? 'rgb(252, 82, 0)' : 'rgb(255, 144, 92)',
      );
      const dismiss = page.getByRole('button', { name: 'Dismiss Celebration' });
      const bounds = (await dismiss.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await expect(dismiss).toHaveCSS(
        'color',
        scheme === 'light' ? 'rgb(140, 21, 21)' : 'rgb(241, 139, 131)',
      );
      await page.screenshot({
        path: join(process.env.HOME!, 'a11y-delight-evidence', `celebration-${scheme}-iphone.png`),
      });
    }
  }
  await page.getByRole('button', { name: 'Save as Best', exact: true }).click();
  await expect(status).toHaveCount(0);
  expect((await (await context.request.get('/api/me')).json()).best2k_split_s).toBe(98.2);
});
