import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { ANSWER_LIST, dailyAnswer } from '../shared/games/wordGuess';
import { perceptionPuzzle } from '../shared/games/perception';
import { intervalMs, rateHoldRates, STROKES_PER_PIECE } from '../shared/games/rateHold';

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

test('plays Word Guess, Perception and Rate Hold once each after the OYO', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  const project = testInfo.project.name;
  const phone = project !== 'desktop-chrome';
  const config = await (await context.request.get('/api/config')).json();
  const date: string = config.today;

  await page.goto('/games/wordguess');
  await waitForSplash(page);
  await expect(page.getByText('Games Locked')).toBeVisible();
  await expect(
    await context.request.post('/api/entries', {
      headers: csrfHeaders,
      data: { date, modality: 'erg', zone: 'E', distance_m: 6000, title: 'E2E Games', notes: '' },
    }),
  ).toBeOK();

  await page.goto('/games');
  await waitForSplash(page);
  for (const name of ['Word Guess', 'Perception', 'Rate Hold'])
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

  // Rate Hold: three pieces of eight strokes at the daily rates.
  await page.goto('/games/ratehold');
  await waitForSplash(page);
  const rates = rateHoldRates(date);
  for (const [i, rate] of rates.entries()) {
    await page.getByRole('button', { name: 'Start Piece' }).click();
    const pad = page.getByTestId('catch-pad');
    for (let stroke = 0; stroke < STROKES_PER_PIECE; stroke++) {
      if (stroke) await page.waitForTimeout(intervalMs(rate));
      await pad.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0 });
      if (i === 0 && stroke === 4) await shots(page, project, 'ratehold-play');
    }
    await page
      .getByRole('button', { name: i === rates.length - 1 ? 'See Result' : 'Next Piece' })
      .click();
  }
  await expectResult(page, 'Rate Hold');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('/ 100');
  await shots(page, project, 'ratehold-result');

  await page.goto('/games');
  await expect(page.getByRole('link', { name: /^Word Guess/ })).toContainText('2 / 6');
  await expect(page.getByRole('link', { name: /^Rate Hold/ })).toContainText('/ 100');
  expect(
    (
      await context.request.post('/api/games/wordguess/results', {
        headers: csrfHeaders,
        data: { payload: { guesses: [answer] } },
      })
    ).status(),
  ).toBe(409);
});
