import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { WorldleDay } from '../shared/types';
import { dailyCountry } from '../worker/src/games/worldle/game';
import { worldleNames } from '../shared/games/worldleNames';
import { test, expect } from './fixtures';
import type { Rower } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry, waitForSplash } from './helpers';

const DATE = '2027-01-18';
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

async function clock(rower: Rower, info: TestInfo) {
  await rower.context.setExtraHTTPHeaders({
    ...info.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': `${DATE}T18:00:00Z`,
  });
  await expect(
    await rower.context.request.post('/api/auth/login', {
      headers: csrfHeaders,
      data: { email: rower.user.email, password: rower.password },
    }),
  ).toBeOK();
}

async function capture(page: Page, info: TestInfo, state: string) {
  const directory = process.env.E2E_WORLDLE_SHOTS_DIR;
  if (!directory || !['iphone-15', 'pixel-7'].includes(info.project.name)) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: join(directory, `phone-${info.project.name}-${state}.png`),
    animations: 'disabled',
    scale: 'css',
  });
}

test('rower plays the real outline, uses autocomplete and units, and resumes a finished game', async ({
  makeRower,
}, info) => {
  const rower = await makeRower();
  const { page, context } = rower;
  await clock(rower, info);
  const entry = await seedEntry(rower, 'Worldle E2E');
  try {
    const response = await context.request.get('/api/games/worldle/today');
    await expect(response).toBeOK();
    const initial: WorldleDay = await response.json();
    expect(initial.date).toBe(DATE);
    expect(initial.access.unlocked).toBe(true);
    expect(initial.answer).toBeNull();
    const answer = dailyCountry(DATE);
    const misses = [
      'United Arab Emirates',
      'Japan',
      'Australia',
      'Canada',
      'Brazil',
      'France',
      'Spain',
    ]
      .filter((name) => name !== answer.name)
      .slice(0, 6);
    expect(misses).toHaveLength(6);
    await page.goto('/games/worldle');
    await waitForSplash(page);
    const outline = page.getByRole('img', { name: 'Country outline', exact: true });
    await expect(outline).toBeVisible();
    expect(await outline.getAttribute('aria-label')).not.toContain(answer.name);
    // The silhouette uses a CSS mask; decode its actual URL in the browser to verify the asset.
    const asset = await outline.evaluate(async (element) => {
      const style = getComputedStyle(element);
      const mask = style.maskImage || style.webkitMaskImage;
      const url = mask.slice(4, -1).replace(/^["']|["']$/g, '');
      const image = new Image();
      image.src = url;
      await image.decode();
      return { src: image.src, width: image.naturalWidth };
    });
    expect(asset.src).toMatch(/\/worldle\/[a-f0-9]{16}\.svg$/);
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.src).toContain(initial.shape!);

    const field = page.getByRole('combobox');
    const submit = async (name: string, index: number) => {
      await field.fill(name);
      await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
      await field.press('ArrowDown');
      await field.press('Enter');
      await expect(field).toHaveValue(name);
      const saved = page.waitForResponse(
        (res) => res.url().endsWith('/worldle/guess') && res.request().method() === 'POST',
      );
      await field.press('Enter');
      const result = await saved;
      expect(result.request().postDataJSON()).toEqual({ guess: name, date: DATE });
      expect(result.status()).toBe(200);
      const day: WorldleDay = await result.json();
      expect(day.guesses).toHaveLength(index + 1);
      await expect(
        page.getByRole('listitem', { name: `Guess ${index + 1}`, exact: true }),
      ).toContainText(name);
      return day;
    };

    await field.fill('Atlantis');
    await page.getByRole('button', { name: 'Guess', exact: true }).click();
    await expect(page.getByText('Choose a country from the suggestions.')).toBeVisible();
    expect(
      (await (await context.request.get('/api/games/worldle/today')).json()).guesses,
    ).toHaveLength(0);
    await expect(page.getByRole('listitem', { name: /Guess \d, empty/ })).toHaveCount(6);

    await submit(misses[0], 0);
    const first = page.getByRole('listitem', { name: 'Guess 1', exact: true });
    await expect(first).toContainText(/\d[\d,]* km/);
    await expect(first).toContainText(/\d+%/);
    await expect(
      first.getByRole('img', {
        name: /^(North|Northeast|East|Southeast|South|Southwest|West|Northwest)$/,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'mi', exact: true }).click();
    await expect(first).toContainText(/\d[\d,]* mi/);
    await page.reload();
    await waitForSplash(page);
    await expect(first).toContainText(/\d[\d,]* mi/);
    await page.getByRole('button', { name: 'km', exact: true }).click();
    await submit(misses[1], 1);
    await submit(misses[2], 2);
    await field.blur();
    await outline.scrollIntoViewIfNeeded();
    await capture(page, info, 'mid');
    for (let index = 3; index < 6; index++) await submit(misses[index], index);

    await expect(page.getByText('Out of guesses', { exact: true })).toBeVisible();
    const reveal = page.getByRole('region', { name: 'Answer', exact: true });
    await expect(reveal.getByRole('heading', { name: answer.name, exact: true })).toBeVisible();
    const map = reveal.getByRole('img', { name: `Location of ${answer.name}`, exact: true });
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute('viewBox', '0 0 360 180');
    expect(Number(await map.locator('circle').getAttribute('cx'))).toBeCloseTo(answer.lon + 180);
    expect(Number(await map.locator('circle').getAttribute('cy'))).toBeCloseTo(90 - answer.lat);
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    expect((await (await context.request.get('/api/games/worldle/today')).json()).answer.name).toBe(
      answer.name,
    );
    await page.reload();
    await waitForSplash(page);
    await expect(page.getByText('Out of guesses', { exact: true })).toBeVisible();
    await expect(reveal).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('listitem', { name: /^Guess \d$/ })).toHaveCount(6);
    await capture(page, info, 'finished');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await expect(
      await context.request.delete(`/api/entries/${entry.id}`, { headers: csrfHeaders }),
    ).toBeOK();
  }
});

test('locked rower cannot see a silhouette or consume a guess', async ({ makeRower }, info) => {
  const rower = await makeRower();
  const { page, context } = rower;
  await clock(rower, info);
  await page.goto('/games/worldle');
  await waitForSplash(page);
  await expect(page.getByRole('link', { name: 'Log Workout', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Country outline', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  const day: WorldleDay = await (await context.request.get('/api/games/worldle/today')).json();
  expect(day.shape).toBeNull();
  expect(day.guesses).toHaveLength(0);
  const rejected = await context.request.post('/api/games/worldle/guess', {
    headers: csrfHeaders,
    data: { guess: worldleNames[0].name, date: DATE },
  });
  expect(rejected.status()).toBe(403);
  expect(
    (await (await context.request.get('/api/games/worldle/today')).json()).guesses,
  ).toHaveLength(0);
});
