import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { CrosswordDay, GameResult } from '../shared/types';
import {
  crosswordShare,
  formatCrosswordTime,
  type CrosswordResult,
} from '../shared/games/crossword';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { crosswordData } from './crossword-data';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 180000 });

async function screenshots(page: Page, project: string, state: string) {
  if (project === 'desktop-chrome') return;
  const directory = join(homedir(), 'xw', 'shots');
  await mkdir(directory, { recursive: true });
  await waitForSplash(page);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
      theme,
    );
    await page.screenshot({
      path: join(directory, `e2e-${project}-${theme}-${state}.png`),
      animations: 'disabled',
      scale: 'css',
    });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

test('crossword unlocks, resumes, checks, reveals, finishes and recovers a second attempt', async ({
  browser,
  newRowerSignup,
  baseURL,
}, testInfo) => {
  const { date, grid: answerRows, solution, slots } = await crosswordData(testInfo.project.name);
  const clock = (seconds = 0) =>
    new Date(Date.parse(`${date}T18:00:00Z`) + seconds * 1000).toISOString();
  const headers = { ...testInfo.project.use.extraHTTPHeaders, 'X-OYO-Test-Now': clock() };
  const context = await browser.newContext({
    ...testInfo.project.use,
    baseURL,
    serviceWorkers: 'block',
    extraHTTPHeaders: headers,
  });
  try {
    const signup = await newRowerSignup();
    await expect(
      await context.request.post('/api/auth/signup', { headers: csrfHeaders, data: signup.body }),
    ).toBeOK();
    await expect(await context.request.post('/api/me/intro', { headers: csrfHeaders })).toBeOK();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => sessionStorage.setItem('crossword-share', text),
        },
      });
    });
    const page = await context.newPage();
    if (testInfo.project.name === 'iphone-15')
      await page.setViewportSize({ width: 393, height: 852 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const phone = testInfo.project.name !== 'desktop-chrome';
    const tap = async (locator: ReturnType<Page['locator']>) =>
      phone ? locator.tap() : locator.click();
    const tile = (i: number) => page.getByRole('grid').getByRole('gridcell').nth(i);
    const select = async (i: number) => tap(tile(i).getByRole('button'));
    const letter = async (value: string) =>
      phone
        ? tap(page.getByRole('button', { name: `Type ${value}`, exact: true }))
        : page.keyboard.type(value);
    const first = slots.find((slot) => slot.dir === 'across')!;
    const cell = first.cells[0],
      revealCell = first.cells[1];
    const wrong = solution[cell] === 'Z' ? 'Q' : 'Z';
    await page.goto('/games/crossword');
    await waitForSplash(page);
    await expect(page.getByRole('link', { name: 'Log Workout', exact: true })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveCount(0);
    const locked = await context.request.post('/api/games/crossword/start', {
      headers: csrfHeaders,
      data: { date },
    });
    expect(locked.status()).toBe(403);
    expect(await locked.json()).toMatchObject({ error: { code: 'GAME_LOCKED' } });
    await expect(
      await context.request.post('/api/entries', {
        headers: csrfHeaders,
        data: {
          date,
          modality: 'erg',
          zone: 'E',
          distance_m: 6000,
          title: 'E2E Crossword Unlock',
          notes: '',
        },
      }),
    ).toBeOK();
    await page.reload();
    await expect(page.getByText('Ready to Solve?', { exact: true })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveCount(0);
    const before: CrosswordDay = await (
      await context.request.get('/api/games/crossword/today')
    ).json();
    expect(before).toMatchObject({ started: false, started_at: null, clues: [], solution: null });
    await tap(page.getByRole('button', { name: 'Start', exact: true }));
    await expect(page.getByRole('grid')).toBeVisible();
    const timer = page.locator('.xw-time');
    const initial = await timer.getAttribute('aria-label');
    await expect.poll(() => timer.getAttribute('aria-label')).not.toBe(initial);
    if (phone) {
      await select(cell);
      await expect(page.locator('.xw-sr')).toContainText('Down,');
      await select(cell);
      await expect(page.locator('.xw-sr')).toContainText('Across,');
    } else {
      await tile(cell).getByRole('button').focus();
      await page.keyboard.press('Space');
      await expect(page.locator('.xw-sr')).toContainText('Down,');
      await letter(wrong);
      await page.keyboard.press('Backspace');
      await expect(tile(cell)).toHaveAttribute('aria-label', /blank/);
      await page.keyboard.press('Space');
      await expect(page.locator('.xw-sr')).toContainText('Across,');
    }
    await letter(wrong);
    if (phone)
      expect(
        await page.evaluate(() =>
          document.activeElement?.matches('input,textarea,[contenteditable="true"]'),
        ),
      ).toBe(false);
    await select(cell);
    await tap(page.getByRole('button', { name: 'Check', exact: true }));
    await tap(page.getByRole('button', { name: 'Cell +5s', exact: true }));
    await expect(tile(cell)).toHaveClass(/xw-wrong/);
    await expect(page.locator('.xw-time')).toContainText('+5s');
    await page.reload();
    await expect(tile(cell)).toHaveAttribute('aria-label', new RegExp(`letter ${wrong}`));
    await expect(page.getByText('Not Quite — Keep Going', { exact: true })).toHaveCount(0);
    await select(revealCell);
    await tap(page.getByRole('button', { name: 'Reveal', exact: true }));
    await tap(page.getByRole('button', { name: 'Cell +15s Per New Cell', exact: true }));
    await expect(tile(revealCell)).toHaveClass(/xw-revealed/);
    await expect(page.locator('.xw-time')).toContainText('+20s');
    await letter(wrong);
    await expect(tile(revealCell)).toHaveAttribute(
      'aria-label',
      new RegExp(`letter ${solution[revealCell]}, Revealed`),
    );
    const staleDay: CrosswordDay = await (
      await context.request.get('/api/games/crossword/today')
    ).json();
    await screenshots(page, testInfo.project.name, 'mid-solve');
    await context.setExtraHTTPHeaders({ ...headers, 'X-OYO-Test-Now': clock(90) });
    const finishing = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/crossword/finish') &&
        response.request().method() === 'POST',
    );
    for (const [i, value] of solution.entries()) {
      if (!value || i === revealCell) continue;
      await select(i);
      await letter(value);
    }
    expect((await (await finishing).json()) as CrosswordDay).toMatchObject({
      finished: true,
      incorrect: false,
      penalty: 20,
    });
    const result = page.getByRole('region', { name: 'Your Result' });
    await expect(result).toBeVisible();
    const stored: GameResult = await (
      await context.request.get(`/api/games/crossword/results/me?date=${date}`)
    ).json();
    expect(stored.score).toBe(110);
    const time = formatCrosswordTime(stored.score);
    await expect(result).toContainText(time);
    await tap(result.getByRole('button', { name: 'Share', exact: true }));
    await expect(page.getByText('Result Copied', { exact: true })).toBeVisible();
    const shared = await page.evaluate(() => sessionStorage.getItem('crossword-share'));
    expect(shared?.split('\n').slice(0, 3).join('\n')).toBe(
      crosswordShare(date, stored.payload as CrosswordResult),
    );
    expect(shared).toContain('https://stanford-oyo.joskoo.workers.dev');
    for (const row of answerRows) expect(shared).not.toContain(row);
    expect(shared).not.toContain(solution.join(''));
    await tap(page.getByRole('button', { name: 'Dismiss Notification', exact: true }));
    await expect(page.getByText('Result Copied', { exact: true })).toHaveCount(0);
    const board = page.getByRole('region', { name: 'Mini Crossword Day Board' });
    await expect(board).toContainText('· You');
    await expect(board).toContainText(time);
    await screenshots(page, testInfo.project.name, 'result');
    await page.route(
      '**/api/games/crossword/results/me?*',
      (route) => route.fulfill({ json: null }),
      { times: 1 },
    );
    await page.route('**/api/games/crossword/today', (route) => route.fulfill({ json: staleDay }), {
      times: 1,
    });
    await page.reload();
    await expect(page.getByRole('grid', { name: 'Mini Crossword', exact: true })).toBeVisible();
    const replay = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/crossword/check') && response.status() === 409,
    );
    await tap(page.getByRole('button', { name: 'Check', exact: true }));
    await tap(page.getByRole('button', { name: 'Cell +5s', exact: true }));
    expect(await (await replay).json()).toMatchObject({ error: { code: 'ALREADY_PLAYED' } });
    await expect(result).toBeVisible();
    await expect(result).toContainText(time);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
