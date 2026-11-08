import { test, expect } from './fixtures';
import { seedEntry } from './helpers';
import type { TeamRace } from '../shared/types';

const result = /^(?:(?:Stanford|Berkeley) (?:Ahead|Won) by [\d.]+[kM]? E-meters|Tied)$/;
const lines = (text: string) => {
  const range = document.createRange();
  range.selectNodeContents(
    Array.from(document.querySelectorAll('p')).find((p) => p.textContent === text)!,
  );
  return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size;
};

test('Stanford vs Berkeley race shows on Home and the Leaderboard', async ({ makeRower }) => {
  const rower = await makeRower();
  await seedEntry(rower, `Race ${rower.user.id}`, 12000);
  const response = await rower.context.request.get('/api/stats/race');
  await expect(response).toBeOK();
  const race = (await response.json()) as TeamRace;
  expect(race.week.rowers).toBeGreaterThan(0);
  expect(race.week.stanford_m).toBeGreaterThanOrEqual(12000);
  expect(race.week.berkeley_total_m).toBe(Math.round(race.week.target_m * race.ratio));

  const page = rower.page;
  await page.goto('/');
  const home = page.getByRole('region', { name: 'Stanford vs Berkeley' });
  await expect(home.getByRole('heading', { name: 'Stanford vs Berkeley' })).toBeVisible();
  await expect(home.getByText(result)).toBeVisible();
  await expect(home.getByText('Stanford', { exact: true })).toBeVisible();
  await expect(home.getByText('Berkeley', { exact: true })).toBeVisible();
  await expect(home.getByText(/^Last Week: /)).toBeVisible();
  const box = await home.boundingBox();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  for (const text of [
    await home.getByText(result).innerText(),
    await home.getByText(/^Last Week: /).innerText(),
  ])
    expect(await page.evaluate(lines, text)).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const duration of await home
    .locator('.race-fill')
    .evaluateAll((fills) => fills.map((fill) => getComputedStyle(fill).transitionDuration)))
    expect(duration).toBe('0s');

  await page.goto('/leaderboard');
  const board = page.getByRole('region', { name: 'Stanford vs Berkeley' });
  await expect(board.getByText(result)).toBeVisible();
  await page.getByRole('button', { name: 'Previous Week' }).click();
  await expect(
    board.getByText(/^(?:(?:Stanford|Berkeley) Won by [\d.]+[kM]? E-meters|Tied)$/),
  ).toBeVisible();
  await expect(board.getByText(/^Last Week: /)).toHaveCount(0);
  await page
    .getByRole('radiogroup', { name: 'Leaderboard Metric' })
    .getByRole('radio', { name: 'Season', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Stanford vs Berkeley' })).toHaveCount(0);
});
