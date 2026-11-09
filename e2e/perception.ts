import { expect, type Page } from '@playwright/test';
import type { PerceptionDay } from '../shared/types';
import {
  PERCEPTION_FIELDS,
  PERCEPTION_V2_FROM,
  scorePerceptionRound,
  type PerceptionRoundAnswer,
  type PerceptionRoundId,
  type PerceptionV3Puzzle,
} from '../shared/games/perceptionV2';
import { perceptionLineup, perceptionPuzzleForDate } from '../worker/src/games/perceptionV2';
import { perceptionPuzzle, scorePerception } from '../worker/src/games/perception';
import { waitForSplash } from './helpers';

export const perceptionTitles: Record<PerceptionRoundId, string> = {
  clock: 'Inner Clock',
  color: 'Color Recall',
  dot: 'Spot Recall',
  pattern: 'Pattern',
  reaction: 'Reaction',
  angle: 'Angle Copy',
  length: 'Length Match',
  count: 'Quick Count',
  span: 'Digit Span',
  shade: 'Shade Match',
  bisect: 'Line Midpoint',
  contact: 'Hidden Motion',
  ratio: 'Size Ratio',
  beat: 'Keep the Beat',
  path: 'Path Predict',
  order: 'Flash Order',
  duration: 'Duration Recall',
  centroid: 'Center Point',
};

export async function perceptionClock(page: Page, date: string) {
  const wallStart = Date.now(),
    clockStart = Date.parse(`${date}T18:00:00Z`);
  await page.route('**/api/games/perception/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-oyo-test-now': new Date(clockStart + Date.now() - wallStart).toISOString(),
      },
    }),
  );
}

export async function playPerception(
  page: Page,
  date: string,
  capture?: (id: PerceptionRoundId, stage: string) => Promise<void>,
  from = 0,
) {
  const puzzle = {
    ...perceptionPuzzleForDate(date),
    ...perceptionPuzzle(date),
  } as PerceptionV3Puzzle;
  const today = await page.request.get('/api/games/perception/today');
  expect(today.ok()).toBe(true);
  const { rounds } = (await today.json()) as PerceptionDay;
  expect(rounds).toEqual(perceptionLineup(date));
  await page.goto('/games/perception');
  await waitForSplash(page);
  let expectedTotal = 0;
  for (let round = from; round < 5; round++) {
    const id = rounds[round];
    await expect(
      page.getByRole('heading', { name: perceptionTitles[id], exact: true }),
    ).toBeVisible();
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/perception/start') && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: id === 'clock' ? 'Ready' : 'Start', exact: true })
      .click();
    const start = await started;
    expect(start.ok()).toBe(true);
    expect((await start.json()).rounds).toEqual(rounds);
    const contactDue = Date.now() + puzzle.contact.visibleMs + puzzle.contact.hiddenMs;
    const beatDue = Date.now() + 5 * puzzle.beatIntervalMs - 100;
    if (id === 'span') {
      const digit = page.locator('.pc-digit-stage > span').first(),
        counter = page.locator('.pc-digit-stage .pc-sub');
      const a = await digit.boundingBox(),
        b = await counter.boundingBox();
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
      if (capture) await capture(id, 'stimulus');
    }
    const answerResponse = page.waitForResponse(
      (r) => r.url().endsWith('/perception/answer') && r.request().method() === 'POST',
    );
    if (id === 'beat') {
      const pad = page.getByRole('button', { name: 'Continue the Beat', exact: true });
      await pad.waitFor();
      if (capture) await capture(id, 'answer');
      await page.waitForTimeout(Math.max(0, beatDue - Date.now()));
      for (let i = 0; i < 4; i++) {
        await pad.click();
        if (i < 3) await page.waitForTimeout(puzzle.beatIntervalMs);
      }
    } else if (id === 'duration') {
      const pad = page.getByRole('button', { name: 'Press and Hold', exact: true });
      await pad.waitFor();
      if (capture) await capture(id, 'answer');
      await pad.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(puzzle.durationMs);
      await page.keyboard.up('Space');
    } else if (id === 'clock') {
      const hold = page.getByRole('button', { name: 'Press and Hold', exact: true });
      await hold.waitFor();
      if (capture) await capture(id, 'answer');
      await hold.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(puzzle.clockMs);
      await page.keyboard.up('Space');
    } else if (id === 'reaction') {
      const tap = page.getByRole('button', { name: 'Tap', exact: true });
      await tap.waitFor({ timeout: 10000 });
      if (capture) await capture(id, 'answer');
      await page.waitForTimeout(180);
      await tap.click();
    } else if (id === 'contact') {
      const tap = page.getByRole('button', { name: 'Tap at Finish', exact: true });
      await tap.waitFor();
      if (capture) await capture(id, 'answer');
      await page.waitForTimeout(Math.max(0, contactDue - Date.now()));
      await tap.click();
    } else {
      const lock = page.getByRole('button', { name: 'Lock In', exact: true });
      await lock.waitFor({ timeout: 10000 });
      if (['angle', 'length', 'shade', 'color', 'ratio'].includes(id)) {
        const slider = page.getByRole('slider'),
          target =
            id === 'color' ? puzzle.hue : puzzle[id as 'angle' | 'length' | 'shade' | 'ratio'];
        await slider.focus();
        await slider.press('Home');
        const min = Number(await slider.getAttribute('min'));
        for (let i = min; i < target; i++) await slider.press('ArrowRight');
        await expect(slider).toHaveValue(String(target));
      } else if (id === 'path' || id === 'centroid') {
        const board = page.getByRole(id === 'path' ? 'slider' : 'button', {
          name: id === 'path' ? 'Crossing Position' : 'Center Position',
        });
        const box = (await board.locator('.pc-v3-canvas').boundingBox())!;
        const target = id === 'path' ? [1000, puzzle.pathY] : puzzle.centroid;
        const x = box.x + (box.width * target[0]) / 1000 - (id === 'path' ? 1 : 0),
          y = box.y + (box.height * target[1]) / 1000;
        if (await page.evaluate(() => navigator.maxTouchPoints > 0))
          await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      } else if (id === 'order') {
        for (const cell of puzzle.order)
          await page.getByRole('button', { name: `Tile ${cell + 1}`, exact: true }).click();
      } else if (id === 'dot' || id === 'bisect') {
        const target =
          id === 'dot'
            ? puzzle.dot
            : [
                (puzzle.endpoints[0][0] + puzzle.endpoints[1][0]) / 2,
                (puzzle.endpoints[0][1] + puzzle.endpoints[1][1]) / 2,
              ];
        const board = page.getByRole('button', {
            name: id === 'dot' ? 'Dot Position' : 'Midpoint Position',
          }),
          box = (await board.boundingBox())!;
        const x = box.x + (box.width * target[0]) / 1000,
          y = box.y + (box.height * target[1]) / 1000;
        if (await page.evaluate(() => navigator.maxTouchPoints > 0))
          await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      } else if (id === 'pattern') {
        for (const cell of puzzle.cells)
          await page.getByRole('button', { name: `Square ${cell + 1}`, exact: true }).click();
      } else if (id === 'count' || id === 'span') {
        for (const digit of id === 'count' ? String(puzzle.count) : puzzle.digits)
          await page.getByRole('button', { name: digit, exact: true }).click();
      }
      if (capture) await capture(id, 'answer');
      await lock.click();
    }
    const response = await answerResponse;
    expect(response.ok()).toBe(true);
    const answer = response.request().postDataJSON().answer as PerceptionRoundAnswer;
    expect(Object.keys(answer)).toEqual([PERCEPTION_FIELDS[id]]);
    const score =
      date >= PERCEPTION_V2_FROM
        ? scorePerceptionRound(id, puzzle, answer)
        : scorePerception(date, { ...puzzle, reactionMs: -1, ...answer })[id]!;
    expectedTotal += score;
    expect(((await response.json()) as PerceptionDay).scores[id]).toBe(score);
    if (['dot', 'bisect', 'path', 'centroid'].includes(id))
      expect(score).toBeGreaterThanOrEqual(95);
    else if (!['clock', 'reaction', 'contact', 'beat', 'duration'].includes(id))
      expect(score).toBe(100);
    await page
      .getByRole('button', { name: round === 4 ? 'See Result' : 'Next', exact: true })
      .click();
  }
  const result = page.getByRole('region', { name: 'Your Result' });
  await expect(result).toBeVisible();
  await expect(result).toContainText(`${expectedTotal} / 500`);
  const stored = await page.request.get('/api/games/perception/results/me', { params: { date } });
  expect(stored.ok()).toBe(true);
  expect((await stored.json()).score).toBe(expectedTotal);
  const board = page.getByRole('region', { name: 'Perception Day Board' });
  await expect(board).toContainText('· You');
  await expect(board).toContainText(String(expectedTotal));
  return expectedTotal;
}
