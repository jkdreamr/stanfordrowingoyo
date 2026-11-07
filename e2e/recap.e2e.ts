import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { addDays } from '../shared/dates';
import { join } from 'node:path';

test('completed weekly recap shows workouts, team totals and share', async ({
  makeRower,
}, testInfo) => {
  const rower = await makeRower(),
    { page } = rower;
  const original = await (await rower.context.request.get('/api/config')).json();
  const monday = addDays(original.current_week_start, 7);
  await rower.context.setExtraHTTPHeaders({ 'X-OYO-Test-Now': monday + 'T18:00:00Z' });
  const config = await (await rower.context.request.get('/api/config')).json();
  const clockEnabled = config.today === monday;
  const week = addDays(config.current_week_start, -7);
  const response = await rower.context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: week,
      modality: 'erg',
      zone: 'E',
      distance_m: 82000,
      title: 'E2E Recap Erg',
      notes: '',
    },
  });
  await expect(response).toBeOK();
  const entry = await response.json();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (value: ShareData) => {
        (window as Window & { recapShare?: ShareData }).recapShare = value;
      },
    });
  });
  await page.goto('/');
  if (clockEnabled) {
    const card = page.getByRole('region', { name: 'Last Week', exact: true });
    await expect(card).toBeVisible();
    await expect(card).toContainText('82.0k');
    if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(
          (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
          theme,
        );
        await page.screenshot({
          path: join(process.env.E2E_SHOTS_DIR, `home-recap-${theme}.png`),
          animations: 'disabled',
        });
      }
    }
    await card.getByRole('link', { name: 'View Last Week Recap' }).click();
  } else await page.goto('/recap');
  await expect(page.getByRole('heading', { name: /Week of/ })).toBeVisible();
  await expect(
    page.locator('#main-content').getByRole('progressbar', { name: 'Weekly Target' }),
  ).toHaveAttribute('aria-valuetext', /82,000/);
  await expect(page.getByRole('link', { name: /E2E Recap Erg/ })).toHaveAttribute(
    'href',
    '/entries/' + entry.id,
  );
  await expect(page.getByRole('region', { name: 'Team', exact: true })).toContainText('My Rank');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { recapShare?: ShareData }).recapShare?.text),
    )
    .toContain('1 workout');
  if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme,
      );
      await page.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `weekly-recap-${theme}.png`),
        animations: 'disabled',
      });
    }
  }
});
