import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { waitForSplash } from './helpers';
import type { ArcadeDay, ArcadeRunStart } from '../shared/types';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

async function shot(page: Page, project: string, name: string) {
  if (!process.env.E2E_SHOTS_DIR) return;
  await waitForSplash(page);
  await page.screenshot({
    path: join(process.env.E2E_SHOTS_DIR, `arcade-${project}-${name}.png`),
    animations: 'disabled',
    scale: 'css',
  });
}

test('daily arcade unlocks, plays, saves three attempts and cleans up on leaving', async ({
  makeRower,
}, testInfo) => {
  const { page, context, user } = await makeRower();
  const project = testInfo.project.name;
  const headers = {
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': '2026-12-14T18:00:00Z',
  };
  await context.setExtraHTTPHeaders(headers);
  const date = '2026-12-14';
  const endpoint = '/api/games/chicken-crossing';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/games/chicken-crossing');
  await waitForSplash(page);
  await expect(page.getByRole('link', { name: 'Log Workout' })).toBeVisible();
  const locked = await context.request.post(`${endpoint}/runs/start`, {
    headers: csrfHeaders,
    data: { date },
  });
  expect(locked.status()).toBe(403);
  expect((await locked.json()).error.code).toBe('GAME_LOCKED');

  const saved = await context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: { date, modality: 'erg', zone: 'E', distance_m: 6000, title: 'Arcade Unlock', notes: '' },
  });
  await expect(saved).toBeOK();
  const { id: entryId } = await saved.json();
  try {
    await page.goto('/games');
    await expect(page.getByRole('heading', { name: 'Arcade', exact: true })).toBeVisible();
    await shot(page, project, 'hub');
    await page.getByRole('link', { name: /Chicken Crossing/ }).click();
    await expect(page.getByText('Runs Left 3 of 3')).toBeVisible();
    await shot(page, project, 'intro');
    const originalOverflow = await page.evaluate(() => document.body.style.overflow);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const stage = page.locator('.arcade-stage');
    const canvas = stage.locator('canvas');
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();
    await expect(stage).toHaveCSS('position', 'fixed');
    const bounds = await stage.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.y).toBe(0);
    expect(bounds?.width).toBe(page.viewportSize()!.width);
    expect(bounds?.height).toBe(page.viewportSize()!.height);
    await expect
      .poll(() =>
        canvas.evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          return pixels.some((value, index) => index % 4 === 3 && value > 0);
        }),
      )
      .toBe(true);
    // Give the real-worker validator elapsed time without slowing the browser simulation.
    await context.setExtraHTTPHeaders({ ...headers, 'X-OYO-Test-Now': '2026-12-14T18:01:00Z' });
    if (project === 'desktop-chrome') await page.keyboard.press('ArrowUp');
    else await canvas.tap({ position: { x: 180, y: 400 } });
    await expect(stage.locator('.arcade-stage-score')).not.toHaveText('0');
    for (const direction of ['ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(direction);
      await page.waitForTimeout(200);
    }
    await shot(page, project, 'play');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await shot(page, project, 'play-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await expect(stage).toHaveCSS('touch-action', 'none');
    expect(
      await page.evaluate(() => ({
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      })),
    ).toEqual({ html: 'hidden', body: 'hidden' });
    if (project === 'desktop-chrome') await page.mouse.wheel(0, 600);
    else if (project === 'pixel-7') {
      const touch = await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 180, y: 350 }],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 180, y: 550 }],
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else {
      await canvas.dispatchEvent('touchstart', {
        touches: [{ identifier: 1, clientX: 180, clientY: 600 }],
      });
      await canvas.dispatchEvent('touchmove', {
        touches: [{ identifier: 1, clientX: 180, clientY: 100 }],
      });
      await canvas.dispatchEvent('touchend', { touches: [] });
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await shot(page, project, 'pause');
    await page.getByRole('button', { name: 'End Run', exact: true }).click();
    const over = page.getByRole('region', { name: 'Run Over' });
    await expect(over).toBeVisible();
    await expect(over).toContainText('Run Ended');
    await expect(over).toContainText('Runs Left 2 of 3');
    await shot(page, project, 'over');
    const first = (await (await context.request.get(`${endpoint}/today`)).json()) as ArcadeDay;
    expect(first.runs[0].status).toBe('finished');
    expect(first.runs[0].stats).toMatchObject({ death: 'quit' });
    await expect(page.getByRole('region', { name: 'Chicken Crossing Day Board' })).toContainText(
      user.name,
    );
    await page.getByRole('button', { name: 'Play Again', exact: true }).click();
    await expect(stage).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL('/games');
    await expect(stage).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(originalOverflow);

    const thirdResponse = await context.request.post(`${endpoint}/runs/start`, {
      headers: csrfHeaders,
      data: { date },
    });
    await expect(thirdResponse).toBeOK();
    const third = (await thirdResponse.json()) as ArcadeRunStart;
    expect(third.attempt).toBe(3);
    expect(third.runs[1].status).toBe('abandoned');
    await expect(
      await context.request.post(`${endpoint}/runs/finish`, {
        headers: csrfHeaders,
        data: {
          date,
          run: third.run,
          score: 0,
          stats: { rows: 0, coins: 0, hops: 0, death: 'quit', duration_ms: 0 },
        },
      }),
    ).toBeOK();
    const exhausted = await context.request.post(`${endpoint}/runs/start`, {
      headers: csrfHeaders,
      data: { date },
    });
    expect(exhausted.status()).toBe(409);
    expect((await exhausted.json()).error.code).toBe('NO_RUNS_LEFT');
    await page.goto('/games/chicken-crossing');
    await expect(page.getByText('Runs Left 0 of 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Play/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Chicken Crossing Day Board' })).toContainText(
      user.name,
    );
    const board = await (await context.request.get(`${endpoint}/leaderboard`)).json();
    expect(board.rows.find((row: { user: { id: string } }) => row.user.id === user.id).score).toBe(
      first.best,
    );
    expect(errors).toEqual([]);
  } finally {
    await expect(
      await context.request.delete(`/api/entries/${entryId}`, { headers: csrfHeaders }),
    ).toBeOK();
  }
});
