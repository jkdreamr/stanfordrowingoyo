import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { addDays } from '../shared/dates';
import { dailyAnswer } from '../worker/src/games/wordGuess';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { waitForSplash } from './helpers';

type Shared = { text?: string; files?: { name: string; type: string; data: string }[] };

async function shots(page: Page, project: string, name: string) {
  if (project !== 'iphone-15' || !process.env.E2E_SHOTS_DIR) return;
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
      theme,
    );
    await page.screenshot({
      path: join(process.env.E2E_SHOTS_DIR, `${name}-${theme}.png`),
      animations: 'disabled',
    });
  }
}

test('completed weekly recap shows highlights, team totals and shares an image', async ({
  makeRower,
}, testInfo) => {
  const rower = await makeRower(),
    { page } = rower;
  const project = testInfo.project.name;
  const original = await (await rower.context.request.get('/api/config')).json();
  const monday = addDays(original.current_week_start, 7),
    sunday = addDays(monday, -1);
  await rower.context.setExtraHTTPHeaders({ 'X-OYO-Test-Now': sunday + 'T20:00:00Z' });
  const config = await (await rower.context.request.get('/api/config')).json();
  const clockEnabled = config.today === sunday;
  const response = await rower.context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: clockEnabled ? sunday : original.current_week_start,
      modality: 'erg',
      zone: 'E',
      distance_m: 82000,
      title: 'E2E Recap Erg',
      notes: '',
    },
  });
  await expect(response).toBeOK();
  const entry = await response.json();
  if (clockEnabled) {
    await expect(
      await rower.context.request.post('/api/games/wordguess/guess', {
        headers: csrfHeaders,
        data: { guess: dailyAnswer(sunday) },
      }),
    ).toBeOK();
    await rower.context.setExtraHTTPHeaders({ 'X-OYO-Test-Now': monday + 'T18:00:00Z' });
  }
  await page.addInitScript(() => {
    const win = window as Window & { recapShare?: Shared };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (value: ShareData) => {
        const files = await Promise.all(
          (value.files ?? []).map(async (file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let data = '';
            for (const byte of bytes) data += String.fromCharCode(byte);
            return { name: file.name, type: file.type, data: btoa(data) };
          }),
        );
        win.recapShare = { text: value.text, files };
      },
    });
  });
  await page.goto('/');
  await waitForSplash(page);
  if (clockEnabled) {
    const card = page.getByRole('region', { name: 'Last Week', exact: true });
    await expect(card).toBeVisible();
    await expect(card).toContainText('82.0k');
    await expect(card).toContainText('vs Berkeley');
    await page.waitForTimeout(1200);
    await shots(page, project, 'home-recap');
    await card.getByRole('button', { name: 'Dismiss Last Week Recap' }).click();
    await expect(card).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Last Week', exact: true })).toHaveCount(0);
  }
  await page.goto('/me');
  await page.getByRole('link', { name: /Weekly Recap/ }).click();
  if (!clockEnabled) await page.goto('/recap?week=' + original.current_week_start);
  await expect(page.getByRole('heading', { name: /Week of/ })).toBeVisible();
  await expect(
    page.locator('#main-content').getByRole('progressbar', { name: 'Weekly Target' }),
  ).toHaveAttribute('aria-valuetext', /82,000/);
  const highlights = page.getByRole('region', { name: 'Highlights' });
  await expect(highlights).toContainText('Team Rank');
  if (clockEnabled) {
    await expect(highlights).toContainText('vs Berkeley');
    await expect(highlights).toContainText('1 Word Guess Solve');
  }
  await expect(page.getByRole('link', { name: /E2E Recap Erg/ })).toHaveAttribute(
    'href',
    '/entries/' + entry.id,
  );
  await expect(page.getByRole('region', { name: 'Team', exact: true })).toContainText('My Rank');
  await expect(page.getByRole('region', { name: 'Weekly Target' })).toContainText('82.0k');
  await page.waitForTimeout(1200);
  await shots(page, project, 'weekly-recap');
  const share = page.getByRole('button', { name: 'Share Recap' });
  await expect(share).toBeEnabled();
  expect((await share.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await share.click();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { recapShare?: Shared }).recapShare?.text))
    .toContain('1 workout');
  const shared = await page.evaluate(
    () => (window as Window & { recapShare?: Shared }).recapShare!.files!,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatchObject({ type: 'image/png', name: /^oyo-week-\d{4}-\d{2}-\d{2}\.png$/ });
  const png = Buffer.from(shared[0].data, 'base64');
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  if (project === 'iphone-15' && process.env.E2E_SHOTS_DIR)
    await writeFile(join(process.env.E2E_SHOTS_DIR, 'recap-share.png'), png);
});
