import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, waitForSplash } from './helpers';
import { dealRound } from '../worker/src/games/deal/generate';
import { applyDealOp, DEAL_MIN_STEP_MS, type DealOp } from '../shared/games/deal';
import type { DealDay } from '../shared/types';

test.use({ serviceWorkers: 'block' });

test('Deal gates workouts, resumes the clock, validates moves and completes five rounds on the board', async ({
  makeRower,
}, testInfo) => {
  test.setTimeout(180000);
  const date = (
    {
      'desktop-chrome': '2026-11-16',
      'iphone-15': '2026-11-17',
      'pixel-7': '2026-11-18',
    } as Record<string, string>
  )[testInfo.project.name];
  const { page, context } = await makeRower();
  await context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': `${date}T18:00:00Z`,
  });
  const startedAt = Date.now(),
    base = Date.parse(`${date}T18:00:00Z`);
  let offset = 0;
  await page.route('**/api/games/deal/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-oyo-test-now': new Date(base + Date.now() - startedAt + offset).toISOString(),
      },
    }),
  );
  const tap = async (locator: Locator) =>
    testInfo.project.use.hasTouch ? locator.tap() : locator.click();
  await page.goto('/games/deal');
  await waitForSplash(page);
  await expect(page.getByText("Log today's OYO to unlock", { exact: true })).toBeVisible();
  const locked = await context.request.post('/api/games/deal/start', {
    headers: csrfHeaders,
    data: { round: 0, date },
  });
  expect(locked.status()).toBe(403);
  expect((await locked.json()).error.code).toBe('GAME_LOCKED');
  await logEntry(page, 'erg', 'E', 10000, 'Deal Unlock Workout');
  await page.goto('/games/deal');
  await waitForSplash(page);
  for (let round = 0; round < 5; round++) {
    const puzzle = dealRound(date, round);
    await expect(
      page.getByRole('heading', { name: `Round ${round + 1} of 5`, exact: true }),
    ).toBeVisible();
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/deal/start') && r.request().method() === 'POST',
    );
    await tap(page.getByRole('button', { name: 'Deal Cards', exact: true }));
    const start = await started;
    expect(start.ok(), await start.text()).toBe(true);
    const day = (await start.json()) as DealDay;
    expect(day.active?.cards).toEqual(puzzle.cards);
    expect(day.active?.goal).toBe(puzzle.goal);
    await expect(page.locator('.deal-board')).toHaveAttribute('data-ready', 'true');
    if (round === 0) {
      const values = puzzle.cards.map((c) => c.value);
      const a = values.indexOf(Math.min(...values)),
        b = values.indexOf(Math.max(...values));
      expect(a).not.toBe(b);
      await tap(page.locator('.deal-card').nth(a));
      await tap(page.getByRole('button', { name: 'Subtract', exact: true }));
      await tap(page.locator('.deal-card').nth(b));
      await expect(
        page.getByRole('region', { name: 'Deal', exact: true }).getByRole('status'),
      ).toHaveText('Must Be a Whole Number Above Zero');
      await expect(page.locator('.deal-card')).toHaveCount(puzzle.cards.length);
      const before = page.getByRole('timer');
      const toMs = (text: string) => {
        const [m, s] = text.split(':').map(Number);
        return (m * 60 + s) * 1000;
      };
      const previous = toMs((await before.textContent())!);
      offset += 2000;
      const resumed = page.waitForResponse((r) => r.url().endsWith('/deal/today'));
      await page.reload();
      const resumedDay = (await (await resumed).json()) as DealDay;
      expect(resumedDay.active?.cards).toEqual(puzzle.cards);
      expect(resumedDay.active!.elapsedMs).toBeGreaterThan(previous + 1500);
      await expect(page.getByRole('timer')).toBeVisible();
      expect(toMs((await page.getByRole('timer').textContent())!)).toBeGreaterThan(previous + 1500);
      await expect(page.locator('.deal-resume')).toBeVisible();
    }
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/deal/${round === 1 ? 'skip' : 'answer'}`) &&
        r.request().method() === 'POST',
    );
    if (round === 1) {
      await tap(page.getByRole('button', { name: 'Skip (+1:00)', exact: true }));
      await expect(
        page.getByRole('button', { name: 'Tap Again to Skip', exact: true }),
      ).toBeVisible();
      await tap(page.getByRole('button', { name: 'Tap Again to Skip', exact: true }));
    } else {
      offset += (puzzle.cards.length - 1) * DEAL_MIN_STEP_MS;
      const live = new Map(puzzle.cards.map((card, id) => [id, { value: card.value, slot: id }]));
      const button = (id: number) =>
        page
          .locator('.deal-card')
          .nth(
            [...live.entries()]
              .sort((a, b) => a[1].slot - b[1].slot)
              .findIndex(([key]) => key === id),
          );
      const names: Record<DealOp, string> = {
        '+': 'Add',
        '-': 'Subtract',
        '*': 'Multiply',
        '/': 'Divide',
      };
      for (const [i, step] of puzzle.solution.entries()) {
        const a = live.get(step.a)!,
          b = live.get(step.b)!;
        await tap(button(step.a));
        await tap(page.getByRole('button', { name: names[step.op], exact: true }));
        await tap(button(step.b));
        live.delete(step.a);
        live.delete(step.b);
        live.set(puzzle.cards.length + i, {
          value: applyDealOp(a.value, step.op, b.value)!,
          slot: b.slot,
        });
        await expect(page.locator('.deal-card')).toHaveCount(live.size);
      }
    }
    const response = await saved;
    expect(response.ok(), await response.text()).toBe(true);
    const next = (await response.json()) as DealDay;
    expect(next.round).toBe(round + 1);
    await expect(
      page.getByRole('heading', { name: `Round ${round + 1} Complete`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(round === 1 ? 'No One Has Solved It Yet' : 'You Set the Team Best', {
        exact: true,
      }),
    ).toBeVisible();
    const values = new Map(puzzle.cards.map((c, id) => [id, c.value]));
    for (const [i, step] of puzzle.solution.entries()) {
      const a = values.get(step.a)!,
        b = values.get(step.b)!,
        value = applyDealOp(a, step.op, b)!;
      values.set(puzzle.cards.length + i, value);
      const symbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[step.op];
      const line = page.getByRole('list', { name: 'Solution' }).getByRole('listitem').nth(i);
      await expect(line).toHaveText(`${a} ${symbol} ${b} = ${value}`);
      await expect(line).toBeVisible();
    }
    if (round === 1) await expect(page.getByText('Skipped +1:00', { exact: true })).toBeVisible();
    await tap(
      page.getByRole('button', { name: round === 4 ? 'See Results' : 'Next Round', exact: true }),
    );
  }
  const result = page.getByRole('region', { name: 'Your Result', exact: true });
  await expect(result).toBeVisible();
  await expect(result.locator('.tabular-nums').first()).toHaveText(/^\d+:\d{2}\.\d$/);
  await expect(result).toContainText('4 of 5 Solved');
  const board = page.getByRole('region', { name: 'Deal Day Board', exact: true });
  await expect(board).toBeVisible();
  await expect(board).toContainText('· You');
});
