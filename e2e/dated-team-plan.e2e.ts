import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });
async function screenshot(page: Page, name: string, project: string) {
  const dir = process.env.E2E_DATED_PLAN_SHOTS_DIR;
  if (dir) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: join(dir, `${name}-${project}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
}
test('dated Schedule shows the Nov9 seed, Nov16 Coming Soon, and read-only Example Fortnight', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  await context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': '2026-11-09T18:00:00Z',
  });
  await page.setViewportSize({
    width: testInfo.project.name === 'desktop-chrome' ? 1440 : 390,
    height: 844,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const seed = await (await context.request.get('/api/plan?week=2026-11-09')).json();
  expect(seed.slots).toHaveLength(14);
  expect(seed.total).toBeNull();
  await page.goto('/plan');
  await waitForSplash(page);
  await expect(page.getByRole('heading', { name: 'Week of Nov 9' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Group' })).toHaveCount(0);
  const session = page
    .getByText("6:55 @ BH\n1) 15' Mobility/Activation\n2) E - 16k - w/up + 3 x 4k\n1x/2-/4-", {
      exact: true,
    })
    .filter({ visible: true });
  await expect(session).toBeVisible();
  expect(await session.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('pre-line');
  await expect(page.locator('h4[aria-current="date"]').filter({ visible: true })).toHaveCount(1);
  for (const name of ['Previous Week', 'Next Week']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await screenshot(page, 'schedule-2026-11-09', testInfo.project.name);
  await page.getByRole('button', { name: 'Next Week', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Week of Nov 16' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coming Soon' })).toBeVisible();
  await expect(page.getByText("This week's schedule hasn't been posted yet.")).toBeVisible();
  await screenshot(page, 'schedule-2026-11-16', testInfo.project.name);
  await page.getByRole('button', { name: 'This Week', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Week of Nov 9' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Plan', exact: true });
  await expect(tabs.getByRole('tab')).toHaveCount(6);
  await tabs.getByRole('tab', { name: 'Example Fortnight', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Fortnight', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Week 1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Week 2', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Frosh', exact: true }).click();
  await expect(page.getByText('40k Equivalent + Monday PM')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name !== 'desktop-chrome')
    expect(await tabs.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await screenshot(page, 'example-fortnight', testInfo.project.name);
  expect(errors).toEqual([]);
});
test('rowers unlock games only on posted no-OYO days, using the same server write gate', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  for (const [date, reason] of [
    ['2026-11-09', 'no_oyo'],
    ['2026-11-11', 'locked'],
    ['2026-11-13', 'locked'],
    ['2026-11-15', 'no_oyo'],
    ['2026-11-16', 'locked'],
  ]) {
    await context.setExtraHTTPHeaders({
      ...testInfo.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': `${date}T18:00:00Z`,
    });
    const access = await (await context.request.get('/api/games/access')).json();
    expect(access).toEqual({ date, reason, unlocked: reason === 'no_oyo' });
    await page.goto('/games');
    await waitForSplash(page);
    if (reason === 'no_oyo') {
      await expect(page.getByText("No OYO on today's team schedule.")).toBeVisible();
      await expect(page.getByRole('link', { name: /Word Guess/ })).toContainText('Play');
    } else {
      await expect(page.getByText("Log today's OYO to unlock")).toBeVisible();
      expect(
        (
          await context.request.post('/api/games/perception/start', {
            headers: csrfHeaders,
            data: { round: 0, reason: 'no_oyo' },
          })
        ).status(),
      ).toBe(403);
    }
  }
});
test('My Fortnight displays Nov9 team rows above personal sessions without changing personal meter totals', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  await context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': '2026-11-09T18:00:00Z',
  });
  await page.setViewportSize({
    width: testInfo.project.name === 'desktop-chrome' ? 1440 : 390,
    height: 844,
  });
  await expect(
    await context.request.put('/api/me/plan', {
      headers: csrfHeaders,
      data: {
        start_date: '2026-11-09',
        sessions: [
          {
            week: 1,
            day: 0,
            slot: 'AM',
            modality: 'erg',
            zone: 'E',
            distance_m: 6000,
            note: 'Personal steady erg',
          },
        ],
        rest_days: [],
      },
    }),
  ).toBeOK();
  await page.goto('/plan?tab=mine');
  await waitForSplash(page);
  const monday = page.getByRole('region', { name: 'Monday Week 1', exact: true });
  const team = monday.getByLabel('Team schedule Monday AM Week 1', { exact: true });
  const personal = monday.getByRole('button', { name: 'Edit AM Monday Week 1', exact: true });
  await expect(team).toContainText("15' Mobility/Activation");
  await expect(team.getByRole('button')).toHaveCount(0);
  await expect(personal).toContainText('Personal steady erg');
  expect((await team.boundingBox())!.y).toBeLessThan((await personal.boundingBox())!.y);
  await expect(
    page
      .getByRole('region', { name: 'Week 2', exact: true })
      .getByText('Team schedule coming soon', { exact: true }),
  ).toHaveCount(1);
  const plan = await (await context.request.get('/api/me/plan')).json();
  expect(plan.planned_m).toEqual([6000, 0]);
  expect(plan.sessions).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, 'my-fortnight-2026-11-09', testInfo.project.name);
});
