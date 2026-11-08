import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { ANSWER_LIST, dailyAnswer } from '../shared/games/wordGuess';
import { perceptionPuzzle } from '../shared/games/perception';
import { connectionsPuzzleFor } from '../worker/src/games/connectionsPuzzles';

test.describe.configure({ timeout: 180_000 });

async function shots(page: Page, project: string, name: string) {
  const dir = process.env.E2E_SHOTS_DIR;
  if (!dir || !['iphone-15', 'desktop-chrome'].includes(project)) return;
  for (const theme of project === 'iphone-15' ? ['light', 'dark'] : ['light']) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
      theme,
    );
    await page.screenshot({
      path: join(dir, `${name}-${project}-${theme}.png`),
      animations: 'disabled',
    });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

async function expectResult(page: Page, title: string) {
  const result = page.getByRole('region', { name: 'Your Result' });
  await expect(result).toBeVisible();
  await expect(result.getByRole('button', { name: 'Share' })).toBeVisible();
  const board = page.getByRole('region', { name: `${title} Day Board` });
  await expect(board).toContainText(/\d+ Players/);
  await expect(board).toContainText('· You');
}

test('plays Word Guess, Perception and Connections once each after the OYO', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  const project = testInfo.project.name;
  const phone = project !== 'desktop-chrome';
  const config = await (await context.request.get('/api/config')).json();
  const date: string = config.today;

  await page.goto('/games/wordguess');
  await waitForSplash(page);
  await expect(page.getByText("Log today's OYO to unlock")).toBeVisible();
  await expect(
    await context.request.post('/api/entries', {
      headers: csrfHeaders,
      data: { date, modality: 'erg', zone: 'E', distance_m: 6000, title: 'E2E Games', notes: '' },
    }),
  ).toBeOK();

  await page.goto('/games');
  await waitForSplash(page);
  for (const name of ['Word Guess', 'Perception', 'Connections'])
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toContainText('Play');

  // Word Guess: a miss then the daily answer, on-screen keys on phones, keyboard on desktop.
  await page.goto('/games/wordguess');
  await waitForSplash(page);
  const answer = dailyAnswer(date);
  const miss = ANSWER_LIST.find((word) => word !== answer)!;
  const enter = async (word: string, row: number) => {
    if (phone) {
      for (const letter of word)
        await page
          .getByRole('button', { name: new RegExp(`^${letter.toUpperCase()}(,|$)`) })
          .click();
      await page.getByRole('button', { name: 'Enter' }).click();
    } else {
      await page.keyboard.type(word);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('row', { name: `Guess ${row}`, exact: true })).toHaveText(
      word.toUpperCase(),
    );
  };
  await expect(page.getByRole('grid')).toBeVisible();
  await enter(miss, 1);
  await shots(page, project, 'wordguess-play');
  await enter(answer, 2);
  await expectResult(page, 'Word Guess');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('2 / 6');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText(
    `Answer · ${answer[0].toUpperCase()}${answer.slice(1)}`,
  );
  await shots(page, project, 'wordguess-result');
  await page.reload();
  await waitForSplash(page);
  await expectResult(page, 'Word Guess');

  // Perception: five rounds aimed at the daily puzzle.
  const puzzle = perceptionPuzzle(date);
  await page.goto('/games/perception');
  await waitForSplash(page);
  await page.getByRole('button', { name: 'Ready' }).click();
  const hold = page.getByRole('button', { name: 'Press and Hold' });
  await hold.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(puzzle.clockMs);
  await page.keyboard.up(' ');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Lock In' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  const spot = page.getByTestId('spot-board');
  await expect(spot).toBeVisible();
  const box = (await spot.boundingBox())!;
  await page.waitForTimeout(1000);
  await spot.click({
    position: { x: (box.width * puzzle.dot[0]) / 1000, y: (box.height * puzzle.dot[1]) / 1000 },
  });
  await page.getByRole('button', { name: 'Lock In' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('button', { name: `Square ${puzzle.cells[0] + 1}` })).toBeEnabled({
    timeout: 5000,
  });
  for (const cell of puzzle.cells)
    await page.getByRole('button', { name: `Square ${cell + 1}` }).click();
  await shots(page, project, 'perception-play');
  await page.getByRole('button', { name: 'Lock In' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Tap' }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'See Result' }).click();
  await expectResult(page, 'Perception');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('/ 500');
  await shots(page, project, 'perception-result');

  // Connections: deselect, One Away, a solve, reload persistence, then the rest.
  await page.goto('/games/connections');
  await waitForSplash(page);
  const [a, b, c, d] = connectionsPuzzleFor(date).groups.map((g) => g.words);
  const words = page.getByRole('group', { name: 'Words' });
  await expect(words.getByRole('button')).toHaveCount(16);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 360, height: viewport.height });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  for (const tile of await words.getByRole('button').evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      return { width: box.width, height: box.height, text: el.firstElementChild!.scrollWidth };
    }),
  )) {
    expect(tile.height).toBeGreaterThanOrEqual(44);
    expect(tile.width).toBeGreaterThanOrEqual(44);
    expect(tile.text).toBeLessThanOrEqual(tile.width);
  }
  await page.setViewportSize(viewport);
  const tap = async (list: string[]) => {
    for (const w of list) await words.getByRole('button', { name: w, exact: true }).click();
  };
  const submit = page.getByRole('button', { name: 'Submit' });
  await tap(a);
  await page.getByRole('button', { name: 'Deselect All' }).click();
  await expect(words.getByRole('button', { pressed: true })).toHaveCount(0);
  await tap([a[0], a[1], a[2], b[0]]);
  await submit.click();
  await expect(page.getByRole('status').filter({ hasText: 'One Away' })).toBeVisible();
  await expect(page.getByRole('img', { name: '3 Mistakes Left' })).toBeVisible();
  await page.getByRole('button', { name: 'Deselect All' }).click();
  await tap(d);
  await submit.click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Shuffle' }).click();
  await tap([b[0], b[1]]);
  await shots(page, project, 'connections-play');
  await page.reload();
  await waitForSplash(page);
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('img', { name: '3 Mistakes Left' })).toBeVisible();
  for (const group of [a, b, c]) {
    await tap(group);
    await submit.click();
    await expect(words.getByRole('button', { name: group[0], exact: true })).toHaveCount(0);
  }
  await expectResult(page, 'Connections');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('4 / 4');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('1 Mistake');
  await shots(page, project, 'connections-result');

  await page.goto('/games');
  await expect(page.getByRole('link', { name: /^Word Guess/ })).toContainText('2 / 6');
  await expect(page.getByRole('link', { name: /^Connections/ })).toContainText('4 / 4');
  expect(
    (
      await context.request.post('/api/games/wordguess/results', {
        headers: csrfHeaders,
        data: { payload: { guesses: [answer] } },
      })
    ).status(),
  ).toBe(409);
});
