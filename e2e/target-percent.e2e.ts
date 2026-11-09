import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { addDays } from '../shared/dates';

test.use({ serviceWorkers: 'block' });

test('7.5 percent is floored consistently across training screens and recap sharing', async ({
  makeRower,
}) => {
  test.setTimeout(60_000);
  const { page, context, user } = await makeRower();
  const config = await (await context.request.get('/api/config')).json();
  await expect(
    await context.request.put('/api/me/target', {
      headers: csrfHeaders,
      data: { target_m: 80000 },
    }),
  ).toBeOK();
  await expect(
    await context.request.put('/api/me/plan', {
      headers: csrfHeaders,
      data: {
        start_date: config.current_week_start,
        sessions: [
          {
            week: 1,
            day: 0,
            slot: 'AM',
            modality: 'erg',
            zone: 'E',
            distance_m: 80000,
            note: 'Percentage regression',
          },
        ],
        rest_days: [],
      },
    }),
  ).toBeOK();
  const saved = await context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: config.today,
      modality: 'erg',
      zone: 'E',
      distance_m: 6000,
      title: 'Percentage regression',
      notes: '',
    },
  });
  await expect(saved).toBeOK();
  const { id } = await saved.json();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          Object.assign(window, { percentShare: data.text });
        },
      });
    });
    await page.goto('/');
    await waitForSplash(page);
    const hero = page.getByRole('link', {
      name: 'Weekly Progress. Change Your Target',
      exact: true,
    });
    await expect(hero.getByText('7%', { exact: true })).toBeVisible();
    await expect(hero.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6000');
    await page.goto('/leaderboard');
    const row = page
      .locator('#main-content')
      .getByRole('link', { name: new RegExp(user.name) })
      .first();
    await expect(row).toContainText('7%');
    await expect(row).not.toContainText('8%');
    await page.goto('/plan?tab=mine');
    const week = page.getByRole('region', { name: 'Week 1', exact: true });
    await expect(week.getByRole('progressbar')).toHaveAttribute('value', '6000');
    await expect(week.getByRole('progressbar')).toHaveAttribute('max', '80000');
    await expect(week.getByText('Complete', { exact: true })).toHaveCount(0);
    await page.goto('/me');
    await expect(page.getByRole('link', { name: /Weekly Target/ })).toContainText('80,000');
    const stats = await (await context.request.get('/api/stats/season')).json();
    expect(
      stats.weeks.find(
        (week: { week_start: string }) => week.week_start === config.current_week_start,
      ),
    ).toMatchObject({ percent: 7.5, hit_target: false });
    await context.setExtraHTTPHeaders({
      'X-OYO-Test-Now': addDays(config.current_week_start, 7) + 'T18:00:00Z',
    });
    await page.goto('/recap?week=' + config.current_week_start);
    const recap = page.getByRole('region', { name: 'Weekly Target', exact: true });
    await expect(recap.getByText('7%', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Highlights' })).toContainText('7%');
    await page.getByRole('button', { name: 'Share Recap' }).click();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'percentShare')))
      .toContain('(7%)');
  } finally {
    await expect(
      await context.request.delete('/api/entries/' + id, { headers: csrfHeaders }),
    ).toBeOK();
  }
});
