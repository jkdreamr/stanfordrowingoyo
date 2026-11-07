import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import type { Config } from '../shared/types';

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });

test('phone Home and Me expose both fortnights before and after planning', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  const card = page
    .locator('.ui-card')
    .filter({ has: page.getByRole('heading', { name: "Today's Plan", exact: true }) });
  const sample = card.getByRole('link', { name: 'Sample Fortnight', exact: true });
  await expect(sample).toBeVisible();
  const box = (await sample.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(card.getByRole('link', { name: 'My Fortnight', exact: true })).toBeVisible();
  if (process.env.QA_SCREENSHOT_DIR && testInfo.project.name === 'iphone-15') {
    await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/home-no-plan-light.png` });
  }
  await sample.click();
  await expect(page.getByRole('heading', { name: 'Sample Fortnight', exact: true })).toBeVisible();
  await page.goto('/');
  await card.getByRole('link', { name: 'My Fortnight', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Blank', exact: true })).toBeVisible();
  const config: Config = await (await context.request.get('/api/config')).json();
  const day = Math.round(
    (Date.parse(`${config.today}T12:00:00Z`) -
      Date.parse(`${config.current_week_start}T12:00:00Z`)) /
      86400000,
  );
  const response = await context.request.put('/api/me/plan', {
    headers: csrfHeaders,
    data: {
      start_date: config.current_week_start,
      sessions: [
        {
          week: 1,
          day,
          slot: 'AM',
          modality: 'erg',
          zone: 'E',
          distance_m: 12000,
          note: 'Morning Steady Row',
        },
      ],
      rest_days: [],
    },
  });
  await expect(response).toBeOK();
  await page.goto('/');
  await expect(card.getByRole('link', { name: /Morning Steady Row/ })).toBeVisible();
  if (process.env.QA_SCREENSHOT_DIR && testInfo.project.name === 'iphone-15') {
    await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/home-with-plan-light.png` });
  }
  await card.getByRole('link', { name: "Today's Plan", exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Week 1', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main Navigation' })
    .filter({ visible: true })
    .getByRole('link', { name: 'Me', exact: true })
    .click();
  await page
    .getByRole('region', { name: 'Your Training' })
    .getByRole('link', { name: 'Plan', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Sample Fortnight', exact: true })).toBeVisible();
});

test('phone rower can browse announcements published before signup', async ({
  adminPage,
  makeRower,
}, testInfo) => {
  const suffix = crypto.randomUUID().slice(0, 6);
  const announcements: { id: string; title: string }[] = [];
  try {
    for (const [title, body, pinned] of [
      [`Practice Schedule ${suffix}`, 'Saturday practice starts at 7 AM.', true],
      [`Team Update ${suffix}`, 'Boathouse opens at 6 AM.\nBring your training log.', false],
    ] as const) {
      const response = await adminPage.request.post('/api/announcements', {
        data: { title, body, pinned },
        headers: csrfHeaders,
      });
      await expect(response).toBeOK();
      announcements.push(await response.json());
    }
    const { page } = await makeRower();
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.reload();
    await page.getByRole('link', { name: 'Announcements', exact: true }).click();
    await expect(page).toHaveURL(/\/announcements$/);
    for (const announcement of announcements) {
      await expect(page.getByRole('article', { name: announcement.title })).toBeVisible();
    }
    await expect(page.getByText('Boathouse opens at 6 AM. Bring your training log.')).toBeVisible();
    if (process.env.QA_SCREENSHOT_DIR && testInfo.project.name === 'iphone-15') {
      await page.screenshot({ path: `${process.env.QA_SCREENSHOT_DIR}/announcements-light.png` });
    }
    await page.goto('/notifications');
    await page.getByRole('link', { name: 'Announcements', exact: true }).click();
    await expect(page.getByRole('article', { name: announcements[1].title })).toBeVisible();
  } finally {
    for (const announcement of announcements) {
      const response = await adminPage.request.delete(`/api/announcements/${announcement.id}`, {
        headers: csrfHeaders,
      });
      await expect(response).toBeOK();
    }
  }
});
