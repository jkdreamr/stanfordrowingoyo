import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });

test('launch games omit Dive from Home, hub and boards and redirect disabled links', async ({
  makeRower,
  adminPage,
}, testInfo) => {
  test.setTimeout(90_000);
  const { page, context } = await makeRower();
  const response = await context.request.get('/api/games');
  await expect(response).toBeOK();
  const games = await response.json();
  expect(games.games.map((game: { id: string }) => game.id).sort()).toEqual([
    'connections',
    'perception',
    'wordguess',
  ]);
  for (const request of [context.request, adminPage.request]) {
    expect((await request.get('/api/games/dive/today')).status()).toBe(404);
    expect(
      (
        await request.post('/api/games/dive/answers', {
          headers: csrfHeaders,
          data: { prompt_index: 0, answer: 'test' },
        })
      ).status(),
    ).toBe(404);
  }
  const sizes = testInfo.project.name === 'iphone-15' ? [360, 393] : [undefined];
  const themes = testInfo.project.name === 'iphone-15' ? ['light', 'dark'] : ['light'];
  const dir = process.env.E2E_LAUNCH_SHOTS_DIR;
  if (dir) await mkdir(dir, { recursive: true });
  for (const width of sizes) {
    if (width) await page.setViewportSize({ width, height: 852 });
    for (const theme of themes) {
      for (const [path, name] of [
        ['/', 'home'],
        ['/games', 'hub'],
        ['/games/leaderboard', 'boards'],
      ]) {
        await page.goto(path);
        await waitForSplash(page);
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          theme === 'dark',
        );
        if (name === 'home') {
          const card = page.getByRole('link', { name: /Daily Games/ });
          await expect(card).toBeVisible();
          await card.scrollIntoViewIfNeeded();
        } else if (name === 'hub') {
          for (const title of ['Word Guess', 'Connections', 'Perception'])
            await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
          await expect(
            page.locator('a[href^="/games/"]').filter({ hasText: /Locked|Play/ }),
          ).toHaveCount(3);
        } else {
          await expect(page.getByRole('region', { name: / Day Board$/ })).toHaveCount(3);
          for (const title of ['Word Guess', 'Connections', 'Perception'])
            await expect(page.getByRole('region', { name: `${title} Day Board` })).toBeVisible();
        }
        await expect(page.getByRole('link', { name: /\bDive\b/ })).toHaveCount(0);
        await expect(page.getByText(/\bDive\b/)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (dir && width)
          await page.screenshot({
            path: join(dir, `${name}-${width}-${theme}.png`),
            fullPage: name !== 'home',
            animations: 'disabled',
          });
      }
    }
  }
  for (const path of ['/games/dive', '/games/dive/archive']) {
    await page.goto(path);
    await expect(page).toHaveURL('/games');
    await expect(page.getByRole('heading', { name: 'Daily Games', exact: true })).toBeVisible();
  }
});
