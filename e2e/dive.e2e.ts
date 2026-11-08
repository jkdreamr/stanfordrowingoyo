import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DiveDay, GameDayLeaderboard } from '../shared/types';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, seedEntry, waitForSplash } from './helpers';

const NOW = '2026-11-07T18:00:00Z';
const answers = ['Coin Toss', 'Orchid', 'Ruler', 'Ramen', 'Oak Tree', 'Bookshop', 'Lighthouse'];
const teammates = [
  ['Coin Toss', 'Rose', 'Tape Measure', 'Ramen', 'Duck', 'Gas Station', 'Church'],
  ['Coin Toss', 'Tulip', 'Ruler', 'Pho', 'Oak Tree', 'Bookshop', 'School'],
  ['Captain Picks', 'Dahlia', 'Yardstick', 'Cereal', 'Fountain', 'Tourist Office', 'Bicycle'],
  ['Drawing Names', 'Rose', 'Ruler', 'Ramen', 'Oak Tree', 'Gas Station', 'Church'],
  ['Captain Picks', 'Tulip', 'Tape Measure', 'Ramen', 'Dog', 'Bookshop', 'School'],
  ['Drawing Names', 'Lily', 'Ruler', 'Ramen', 'Fountain', 'Airport', 'Church'],
  ['Drawing Names', 'Rose', 'Tape Measure', 'Ramen', 'Oak Tree', 'Gas Station', 'Bicycle'],
];
test('Dive unlocks after a workout, plays seven prompts, persists its timer and supports staff moderation', async ({
  makeRower,
  adminPage,
}, testInfo) => {
  test.setTimeout(180000);
  const clockHeaders = { ...testInfo.project.use.extraHTTPHeaders, 'X-OYO-Test-Now': NOW };
  await adminPage.context().setExtraHTTPHeaders(clockHeaders);
  const rower = await makeRower();
  const { page, context } = rower;
  await context.setExtraHTTPHeaders(clockHeaders);
  await expect(
    await context.request.patch('/api/me', {
      headers: csrfHeaders,
      data: { name: 'Alex Rivera' },
    }),
  ).toBeOK();
  await page.goto('/games/dive');
  await expect(page.getByText('Games Locked', { exact: true })).toBeVisible();
  const locked = await context.request.post('/api/games/dive/answers', {
    headers: csrfHeaders,
    data: { prompt_index: 0, answer: 'Coin Toss' },
  });
  expect(locked.status()).toBe(403);
  await logEntry(page, 'erg', 'E', 10000, 'Morning Steady');

  // Real teammate submissions make the rarity groups and live board representative.
  for (const [index, values] of teammates.entries()) {
    const teammate = await makeRower();
    await teammate.context.setExtraHTTPHeaders(clockHeaders);
    await expect(
      await teammate.context.request.patch('/api/me', {
        headers: csrfHeaders,
        data: {
          name: [
            'Maya Chen',
            'Sam Patel',
            'Jordan Lee',
            'Casey Morgan',
            'Taylor Brooks',
            'Jamie Park',
            'Riley Hayes',
          ][index],
        },
      }),
    ).toBeOK();
    await seedEntry(teammate, 'Morning Row');
    for (const [prompt_index, answer] of values.entries()) {
      await expect(
        await teammate.context.request.post('/api/games/dive/answers', {
          headers: csrfHeaders,
          data: { prompt_index, answer },
        }),
      ).toBeOK();
    }
  }
  for (const [prompt_index, answer] of [
    'Random Numbers',
    'Lily',
    'Tape Measure',
    'Oatmeal',
    'Dog',
    'Visitor Center',
    'Temple',
  ].entries()) {
    await expect(
      await adminPage.request.post('/api/games/dive/answers', {
        headers: csrfHeaders,
        data: { prompt_index, answer },
      }),
    ).toBeOK();
  }

  const shots = join(homedir(), 'work', 'shots');
  await mkdir(shots, { recursive: true });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  if (testInfo.project.name === 'iphone-15') {
    await page.goto('/');
    await waitForSplash(page);
    const gamesCard = page.getByRole('link', { name: /Daily Games.*Play Today's Games/ });
    await expect(gamesCard).toBeVisible();
    await gamesCard.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(shots, 'home-iphone-light.png'),
      fullPage: false,
      animations: 'disabled',
    });
  }
  await page.goto('/games');
  await waitForSplash(page);
  await expect(page.getByRole('link', { name: /Dive.*Play/ })).toBeVisible();
  if (testInfo.project.name === 'iphone-15')
    await page.screenshot({
      path: join(shots, 'hub-iphone-light.png'),
      fullPage: false,
      animations: 'disabled',
    });
  await page.goto('/games/dive');
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await waitForSplash(page);
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Name a way to pick teams without arguing.' }),
  ).toBeVisible();
  const deadline = await page.evaluate(
    () =>
      Object.entries(localStorage).find(
        ([key]) => key.startsWith('oyo:dive:') && key.endsWith(':0'),
      )?.[1],
  );
  expect(deadline).toBeTruthy();
  if (testInfo.project.name === 'iphone-15') {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: join(shots, 'iphone-light-play.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({
      path: join(shots, 'iphone-dark-play.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await page.emulateMedia({ colorScheme: 'light' });
  }
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.entries(localStorage).find(
          ([key]) => key.startsWith('oyo:dive:') && key.endsWith(':0'),
        )?.[1],
    ),
  ).toBe(deadline);
  for (const [index, answer] of answers.entries()) {
    await expect(page.getByText(`${index + 1} of 7`, { exact: true })).toBeVisible();
    await page.getByLabel('Your Answer', { exact: true }).fill(answer);
    await page.getByRole('button', { name: 'Dive', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Answer Result' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your Dive', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today’s Answers', exact: true })).toBeVisible();
  const board = page.getByRole('region', { name: 'Dive Day Board' });
  await expect(board.getByText('Live · 9 Players', { exact: true })).toBeVisible();
  const result = (await (await context.request.get('/api/games/dive/today')).json()) as DiveDay;
  expect(result.complete).toBe(true);
  expect(result.score).toBeGreaterThan(200);
  expect(result.reveal?.[0].groups.some((group) => group.count === 3 && group.mine)).toBe(true);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await expect(
    page.getByRole('img', { name: `Depth: ${result.score} meters out of 700` }),
  ).toBeVisible();
  await expect(page.locator('.ui-page-compact')).toHaveCSS('opacity', '0');
  if (testInfo.project.name === 'iphone-15') {
    await page.screenshot({
      path: join(shots, 'iphone-light-results.png'),
      fullPage: false,
      animations: 'disabled',
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({
      path: join(shots, 'iphone-dark-results.png'),
      fullPage: false,
      animations: 'disabled',
    });
  }
  if (testInfo.project.name === 'desktop-chrome')
    await page.screenshot({
      path: join(shots, 'desktop-results.png'),
      fullPage: false,
      animations: 'disabled',
    });
  await adminPage.goto('/games/dive');
  await adminPage.getByRole('button', { name: 'Hide Coin Toss', exact: true }).click();
  const sheet = adminPage.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Hide Answer', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(
    adminPage.getByRole('button', { name: 'Unhide Coin Toss', exact: true }),
  ).toBeVisible();
  await page.reload();
  const moderated = (await (await context.request.get('/api/games/dive/today')).json()) as DiveDay;
  expect(moderated.answers[0]).toMatchObject({ points: 0, tier: 'Hidden', hidden: true });
  expect(moderated.score).toBe(result.score - result.answers[0].points);
  const dayBoard = (await (
    await context.request.get('/api/games/dive/leaderboard')
  ).json()) as GameDayLeaderboard;
  expect(dayBoard.rows.find((row) => row.me)?.score).toBe(moderated.score);
  await expect(
    page.getByRole('region', { name: 'Dive Log' }).getByText('Coin Toss · Hidden', { exact: true }),
  ).toBeVisible();
});
