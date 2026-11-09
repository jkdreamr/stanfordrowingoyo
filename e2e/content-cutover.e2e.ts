import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import { dailyAnswer } from '../worker/src/games/wordGuess';
import { connectionsPuzzleFor } from '../worker/src/games/connectionsPuzzles';
import { CONTENT_CUTOVER, REPLAY_DATE } from '../worker/src/games/contentSchedule';

test.use({ serviceWorkers: 'block' });

for (const date of [REPLAY_DATE, CONTENT_CUTOVER]) {
  test(`server-owned Word Guess and Connections complete, resume and share on ${date}`, async ({
    makeRower,
  }, testInfo) => {
    test.setTimeout(120_000);
    const { page, context } = await makeRower();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.setExtraHTTPHeaders({
      ...testInfo.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': `${date}T18:00:00Z`,
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => sessionStorage.setItem('content-share', text) },
      });
    });
    await expect(
      await context.request.post('/api/entries', {
        headers: csrfHeaders,
        data: {
          date,
          modality: 'erg',
          zone: 'E',
          distance_m: 6000,
          title: 'E2E Content',
          notes: '',
        },
      }),
    ).toBeOK();
    const answer = dailyAnswer(date);
    const puzzle = connectionsPuzzleFor(date);
    for (const game of ['wordguess', 'connections'] as const) {
      await page.goto(`/games/${game}`);
      await waitForSplash(page);
      await expect(page.getByText(/replay|content cutover|new content schedule/i)).toHaveCount(0);
      if (game === 'wordguess') {
        await expect(page.getByRole('grid', { name: 'Word Guess Board' })).toBeVisible();
        const day = await (await context.request.get('/api/games/wordguess/today')).json();
        expect(day).toMatchObject({ date, answer: null, guesses: [], done: false });
        if (testInfo.project.name === 'desktop-chrome') {
          await page.keyboard.type(answer);
          await page.keyboard.press('Enter');
        } else {
          for (const letter of answer)
            await page
              .getByRole('button', { name: new RegExp(`^${letter.toUpperCase()}(,|$)`) })
              .tap();
          await page.getByRole('button', { name: 'Enter', exact: true }).tap();
        }
        await expect(page.getByRole('row', { name: 'Guess 1', exact: true })).toHaveText(
          answer.toUpperCase(),
        );
      } else {
        const day = await (await context.request.get('/api/games/connections/today')).json();
        expect(day).toMatchObject({ date, groups: null, solved: [], finished: false });
        for (const group of puzzle.groups) {
          const words = page.getByRole('group', { name: 'Words' });
          for (const word of group.words)
            await words.getByRole('button', { name: word, exact: true }).click();
          await page.getByRole('button', { name: 'Submit', exact: true }).click();
          await expect(
            words.getByRole('button', { name: group.words[0], exact: true }),
          ).toHaveCount(0);
          if (group.level === 0) {
            await page.reload();
            await waitForSplash(page);
            await expect(page.getByText(group.name, { exact: true })).toBeVisible();
          }
        }
      }
      await expect(page.getByRole('region', { name: 'Your Result' })).toBeVisible();
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByText('Result Copied', { exact: true })).toBeVisible();
      const shared = await page.evaluate(() => sessionStorage.getItem('content-share'));
      expect(shared).toContain(date);
      expect(shared).not.toContain('2026-11-08');
      expect(shared?.toLowerCase()).not.toContain(answer);
      for (const group of puzzle.groups) expect(shared).not.toContain(group.name);
      await page.reload();
      await waitForSplash(page);
      await expect(page.getByRole('region', { name: 'Your Result' })).toBeVisible();
      const title = game === 'wordguess' ? 'Word Guess' : 'Connections';
      await expect(page.getByRole('region', { name: `${title} Day Board` })).toContainText('· You');
      const result = await (await context.request.get(`/api/games/${game}/results/me`)).json();
      expect(result).toMatchObject({ date, score: game === 'wordguess' ? 6 : 8 });
    }
    const games = await (await context.request.get('/api/games')).json();
    expect(games).toMatchObject({ date, streak: { current: 1, best: 1 } });
    expect(games.results).toHaveLength(2);
    expect(games.games.map((game: { id: string }) => game.id).sort()).toEqual([
      'connections',
      'perception',
      'wordguess',
    ]);
    expect(errors).toEqual([]);
  });
}
