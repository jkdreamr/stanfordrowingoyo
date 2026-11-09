import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { ANSWER_LIST, dailyAnswer } from '../worker/src/games/wordGuess';
import { perceptionPuzzle } from '../worker/src/games/perception';
import { connectionsPuzzleFor } from '../worker/src/games/connectionsPuzzles';
import { DIVE_PROMPTS_PER_DAY } from '../shared/games/dive';

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: 'block' });

async function shots(page: Page, project: string, name: string) {
  const dir = process.env.E2E_SHOTS_DIR;
  if (!dir || !['iphone-15', 'desktop-chrome'].includes(project)) return;
  await waitForSplash(page);
  for (const theme of project === 'iphone-15' ? ['light', 'dark'] : ['light']) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
      theme,
    );
    await page.screenshot({
      path: join(dir, `${name}-${project}-${theme}.png`),
      animations: 'disabled',
      scale: 'css',
    });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

async function expectResult(page: Page, title: string) {
  const result = page.getByRole('region', { name: 'Your Result' });
  await expect(result).toBeVisible();
  await expect(result.getByRole('button', { name: 'Share' })).toBeVisible();
  const board = page.getByRole('region', { name: `${title} Day Board` });
  await expect(board.getByText(/^(Live|Final) · \d+ Players?$/)).toBeVisible();
  await expect(board).toContainText('· You');
}

for (const { id, title, outcome } of [
  { id: 'wordguess', title: 'six-guess Word Guess', outcome: 'win' },
  { id: 'wordguess', title: 'six-guess Word Guess', outcome: 'loss' },
  { id: 'connections', title: 'Connections', outcome: 'win' },
  { id: 'perception', title: 'Perception', outcome: 'complete' },
  { id: 'dive', title: 'Dive', outcome: 'complete' },
] as const) {
  for (const destination of ['Home', 'Feed'] as const) {
    test(`${title} ${outcome} shares and leaves for ${destination} without a render error`, async ({
      makeRower,
    }, testInfo) => {
      const { page, context } = await makeRower();
      if (testInfo.project.name === 'pixel-7')
        await page.setViewportSize({ width: 412, height: 915 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /TypeError|React Router/.test(message.text()))
          errors.push(message.text());
      });
      await context.setExtraHTTPHeaders({
        ...testInfo.project.use.extraHTTPHeaders,
        'X-OYO-Test-Now': '2026-12-14T18:00:00Z',
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text: string) => sessionStorage.setItem('shared-result', text),
          },
        });
      });
      const { today: date } = await (await context.request.get('/api/config')).json();
      const saved = await context.request.post('/api/entries', {
        headers: csrfHeaders,
        data: {
          date,
          modality: 'erg',
          zone: 'E',
          distance_m: 6000,
          title: 'Share Home',
          notes: '',
        },
      });
      await expect(saved).toBeOK();
      const { id: entryId } = await saved.json();
      try {
        if (id === 'perception') {
          for (let round = 0; round < 5; round++) {
            await expect(
              await context.request.post('/api/games/perception/start', {
                headers: csrfHeaders,
                data: { round },
              }),
            ).toBeOK();
            await expect(await context.request.get('/api/games/perception/today')).toBeOK();
          }
        }
        await page.goto(`/games/${id}`);
        await waitForSplash(page);
        const answer = dailyAnswer(date);
        if (id === 'wordguess') {
          await expect(page.getByRole('grid', { name: 'Word Guess Board' })).toBeVisible();
          const guesses = ANSWER_LIST.filter((word) => word !== answer).slice(0, 6);
          if (outcome === 'win') guesses[5] = answer;
          for (const [index, guess] of guesses.entries()) {
            if (testInfo.project.name === 'desktop-chrome') {
              await page.keyboard.type(guess);
              await page.keyboard.press('Enter');
            } else {
              for (const letter of guess)
                await page
                  .getByRole('button', { name: new RegExp(`^${letter.toUpperCase()}(,|$)`) })
                  .tap();
              await page.getByRole('button', { name: 'Enter', exact: true }).tap();
            }
            await expect(
              page.getByRole('row', { name: `Guess ${index + 1}`, exact: true }),
            ).toHaveText(guess.toUpperCase());
          }
        } else if (id === 'connections') {
          const words = page.getByRole('group', { name: 'Words' });
          for (const group of connectionsPuzzleFor(date).groups) {
            for (const word of group.words)
              await words.getByRole('button', { name: word, exact: true }).click();
            await page.getByRole('button', { name: 'Submit', exact: true }).click();
            await expect(
              words.getByRole('button', { name: group.words[0], exact: true }),
            ).toHaveCount(0);
          }
        } else if (id === 'dive') {
          await page.getByRole('button', { name: 'Begin', exact: true }).click();
          for (let index = 0; index < DIVE_PROMPTS_PER_DAY; index++) {
            await page.getByLabel('Your Answer', { exact: true }).fill('zzzzzzzzzz');
            await page.getByRole('button', { name: 'Dive', exact: true }).click();
            await page.getByRole('button', { name: 'Continue', exact: true }).click();
          }
        }
        if (id === 'dive')
          await expect(page.getByRole('region', { name: 'Dive Log' })).toBeVisible();
        else await expectResult(page, id === 'wordguess' ? 'Word Guess' : title);
        await page.getByRole('button', { name: 'Share', exact: true }).click();
        await expect(page.getByText('Result Copied', { exact: true })).toBeVisible();
        const copied = await page.evaluate(() => sessionStorage.getItem('shared-result'));
        expect(copied).toContain('https://stanford-oyo.joskoo.workers.dev');
        if (id === 'wordguess') expect(copied!.toLowerCase()).not.toContain(answer.toLowerCase());
        const tab = page.getByRole('link', { name: destination, exact: true });
        if (testInfo.project.name === 'desktop-chrome') await tab.click();
        else await tab.tap();
        await expect(page).toHaveURL(destination === 'Home' ? '/' : '/feed');
        expect(errors).toEqual([]);
        await expect(
          page.getByRole('heading', {
            name: destination === 'Home' ? 'This Week' : 'Feed',
            exact: true,
          }),
        ).toBeVisible();
        if (destination === 'Home')
          await expect(page.getByRole('link', { name: /Daily Games/ })).toContainText(
            '1 Day Streak',
          );
        await expect(page.getByText('Something Went Wrong', { exact: true })).toHaveCount(0);
        expect(errors).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`${id}-share-${destination.toLowerCase()}.png`),
        });
      } finally {
        await expect(
          await context.request.delete(`/api/entries/${entryId}`, {
            headers: csrfHeaders,
          }),
        ).toBeOK();
      }
    });
  }
}

for (const role of ['coxswain', 'coach'] as const) {
  test(`${role} leaves a one-guess Word Guess result without sharing`, async ({
    makeRower,
    adminPage,
  }, testInfo) => {
    const { page, context, user } = await makeRower();
    await expect(
      await adminPage.request.patch(`/api/admin/users/${user.id}`, {
        headers: csrfHeaders,
        data: { role },
      }),
    ).toBeOK();
    await context.setExtraHTTPHeaders({
      ...testInfo.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': '2026-12-21T18:00:00Z',
    });
    const { today: date } = await (await context.request.get('/api/config')).json();
    await page.goto('/games/wordguess');
    await waitForSplash(page);
    const answer = dailyAnswer(date);
    for (const letter of answer)
      await page.getByRole('button', { name: letter.toUpperCase(), exact: true }).click();
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await expectResult(page, 'Word Guess');
    await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('1 / 6');
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Daily Games/ })).toContainText('1 Day Streak');
    await expect(page.getByText('Something Went Wrong', { exact: true })).toHaveCount(0);
  });
}

test('plays Word Guess, Perception and Connections once each after the OYO', async ({
  makeRower,
}, testInfo) => {
  const { page, context } = await makeRower();
  const project = testInfo.project.name;
  if (project === 'iphone-15') await page.setViewportSize({ width: 393, height: 852 });
  const phone = project !== 'desktop-chrome';
  const dates: Record<string, string> = {
    'desktop-chrome': '2026-12-01',
    'iphone-15': '2026-12-02',
    'pixel-7': '2026-12-03',
  };
  await context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': `${dates[project]}T18:00:00Z`,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem('shared-result', text);
        },
      },
    });
  });
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
  await page.reload();
  await waitForSplash(page);
  await expect(page.getByRole('row', { name: 'Guess 1', exact: true })).toHaveText(
    miss.toUpperCase(),
  );
  await shots(page, project, 'wordguess-play');
  await enter(answer, 2);
  await expectResult(page, 'Word Guess');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('2 / 6');
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText(
    `Answer · ${answer[0].toUpperCase()}${answer.slice(1)}`,
  );
  await shots(page, project, 'wordguess-result');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByText('Result Copied', { exact: true })).toBeVisible();
  const copied = await page.evaluate(() => sessionStorage.getItem('shared-result'));
  expect(copied).toContain('https://stanford-oyo.joskoo.workers.dev');
  expect(copied!.toLowerCase()).not.toContain(answer.toLowerCase());
  await page.goto('/games');
  await expect(page.getByText('1 Day Streak · Best 1')).toBeVisible();
  await shots(page, project, 'games-streak');
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Daily Games/ })).toContainText('1 Day Streak');
  await page.getByRole('link', { name: /Daily Games/ }).scrollIntoViewIfNeeded();
  await shots(page, project, 'home-streak');
  await page.goto('/games/wordguess');
  await page.reload();
  await waitForSplash(page);
  await expectResult(page, 'Word Guess');

  // Perception: five rounds aimed at the daily puzzle.
  const puzzle = perceptionPuzzle(date);
  const wallStart = Date.now();
  const clockStart = Date.parse(`${date}T18:00:00Z`);
  // Server timing checks need the test clock to advance with real elapsed time.
  await page.route('**/api/games/perception/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-oyo-test-now': new Date(clockStart + Date.now() - wallStart).toISOString(),
      },
    }),
  );
  await page.goto('/games/perception');
  await waitForSplash(page);
  await page.getByRole('button', { name: 'Ready' }).click();
  const hold = page.getByRole('button', { name: 'Press and Hold' });
  await hold.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(puzzle.clockMs);
  await page.keyboard.up(' ');
  await page.getByRole('button', { name: 'Next' }).waitFor();
  await page.reload();
  await waitForSplash(page);
  await expect(page.getByRole('heading', { name: 'Color Recall' })).toBeVisible();
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
  await expect(
    page.getByRole('button', { name: `Square ${puzzle.cells[0] + 1}`, exact: true }),
  ).toBeEnabled({
    timeout: 5000,
  });
  for (const cell of puzzle.cells)
    await page.getByRole('button', { name: `Square ${cell + 1}`, exact: true }).click();
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
  ).toBe(405);
});

test('Perception abandons a started round on reload without allowing a redo', async ({
  makeRower,
}) => {
  const { page, context } = await makeRower();
  const config = await (await context.request.get('/api/config')).json();
  await context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: config.today,
      modality: 'erg',
      zone: 'E',
      distance_m: 1000,
      title: 'Round resume',
      notes: '',
    },
  });
  await page.goto('/games/perception');
  await waitForSplash(page);
  await page.getByRole('button', { name: 'Ready' }).click();
  await expect(page.getByRole('button', { name: 'Press and Hold' })).toBeVisible();
  await page.reload();
  await waitForSplash(page);
  await expect(page.getByRole('heading', { name: 'Color Recall' })).toBeVisible();
  const resumed = await (await context.request.get('/api/games/perception/today')).json();
  expect(resumed.scores).toEqual({ clock: 0 });
  expect(
    (
      await context.request.post('/api/games/perception/start', {
        headers: csrfHeaders,
        data: { round: 0 },
      })
    ).status(),
  ).toBe(409);
});
