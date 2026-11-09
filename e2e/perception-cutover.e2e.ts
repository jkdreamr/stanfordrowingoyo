import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, waitForSplash } from './helpers';
import { perceptionClock, perceptionTitles, playPerception } from './perception';
import { perceptionLineup } from '../worker/src/games/perceptionV2';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 180_000 });

test('an old brief cannot consume a new-day round after a workout on another tab', async ({
  makeRower,
}, info) => {
  const { page, context } = await makeRower();
  const entries: string[] = [];
  const clock = async (iso: string) =>
    context.setExtraHTTPHeaders({ ...info.project.use.extraHTTPHeaders, 'X-OYO-Test-Now': iso });
  const workout = async (date: string) => {
    const saved = await context.request.post('/api/entries', {
      headers: csrfHeaders,
      data: {
        date,
        modality: 'erg',
        zone: 'E',
        distance_m: 1000,
        title: 'Other tab workout',
        notes: '',
      },
    });
    await expect(saved).toBeOK();
    entries.push((await saved.json()).id);
  };
  try {
    await clock('2026-11-10T07:59:00Z');
    await workout('2026-11-09');
    await page.goto('/games/perception');
    await waitForSplash(page);
    await expect(page.getByRole('heading', { name: 'Inner Clock', exact: true })).toBeVisible();
    await clock('2026-11-10T08:00:01Z');
    await workout('2026-11-10');
    const started = page.waitForResponse(
      (response) =>
        response.url().endsWith('/perception/start') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    const rejected = await started;
    expect(rejected.status()).toBe(409);
    expect(await rejected.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
    await expect(page.getByRole('alert')).toHaveText('A New Day Has Started. Reload to Play.');
    const day = await (await context.request.get('/api/games/perception/today')).json();
    expect(day).toMatchObject({
      date: '2026-11-10',
      access: { unlocked: true, reason: 'workout' },
      round: 0,
      scores: {},
      done: false,
    });
    await page.screenshot({
      path: `/home/ubuntu/perception-runtime-stale-brief-${info.project.name}.png`,
    });
    await page.reload();
    await waitForSplash(page);
    await expect(page.getByRole('heading', { name: 'Inner Clock', exact: true })).toHaveCount(0);
    await perceptionClock(page, '2026-11-10');
    const recovered = await playPerception(page, '2026-11-10');
    expect(recovered).toBe(500);
    await page.screenshot({
      path: `/home/ubuntu/perception-runtime-recovered-${info.project.name}.png`,
    });
    console.log(
      `ROLLOVER ${info.project.name} stale start=409 DAY_CHANGED; new-day recovery=500/500`,
    );
  } finally {
    for (const id of entries)
      await expect(
        await context.request.delete(`/api/entries/${id}`, { headers: csrfHeaders }),
      ).toBeOK();
  }
});

for (const date of ['2026-11-10', '2026-11-11']) {
  test(`cutover ${date} plays all rounds, persists result, board and share`, async ({
    makeRower,
  }, info) => {
    const { page, context } = await makeRower();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await context.setExtraHTTPHeaders({
      ...info.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': `${date}T18:00:00Z`,
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => sessionStorage.setItem('shared-result', text) },
      });
    });
    await page.goto('/');
    await waitForSplash(page);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/entries') && response.request().method() === 'POST',
    );
    await logEntry(page, 'erg', 'E', 1000, 'Cutover runtime');
    const response = await saved;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON().date).toBe(date);
    const { id } = await response.json();
    try {
      await perceptionClock(page, date);
      const score = await playPerception(page, date, async (round, stage) => {
        if (stage === 'answer')
          await page.screenshot({
            path: `/home/ubuntu/perception-runtime-${date}-${info.project.name}-${round}.png`,
          });
      });
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByText('Result Copied', { exact: true })).toBeVisible();
      const share = await page.evaluate(() => sessionStorage.getItem('shared-result'));
      expect(share).toContain(`${score}/500`);
      expect(share).toContain(date);
      await page.screenshot({
        path: `/home/ubuntu/perception-runtime-${date}-${info.project.name}-result.png`,
      });
      await page.reload();
      await waitForSplash(page);
      await expect(page.getByRole('region', { name: 'Your Result' })).toContainText(
        `${score} / 500`,
      );
      await expect(page.getByRole('region', { name: 'Perception Day Board' })).toContainText(
        '· You',
      );
      expect(errors).toEqual([]);
      console.log(
        `RUNTIME ${date} ${info.project.name} score=${score}/500 result+board+share+reload OK console_errors=0`,
      );
    } finally {
      await expect(
        await context.request.delete(`/api/entries/${id}`, { headers: csrfHeaders }),
      ).toBeOK();
    }
  });
}

test('LA midnight preserves legacy results and safely rejects an old active round', async ({
  makeRower,
}, info) => {
  const { page, context } = await makeRower();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let clock = Date.parse('2026-11-10T07:50:00Z'),
    wall = Date.now();
  const setClock = async (iso: string) => {
    clock = Date.parse(iso);
    wall = Date.now();
    await context.setExtraHTTPHeaders({
      ...info.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': iso,
    });
  };
  await page.route('**/api/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-oyo-test-now': new Date(clock + Date.now() - wall).toISOString(),
      },
    }),
  );
  await setClock('2026-11-10T07:50:00Z');
  const entries: string[] = [];
  const workout = async (date: string) => {
    const saved = await context.request.post('/api/entries', {
      headers: csrfHeaders,
      data: {
        date,
        modality: 'erg',
        zone: 'E',
        distance_m: 1000,
        title: 'Midnight runtime',
        notes: '',
      },
    });
    await expect(saved).toBeOK();
    entries.push((await saved.json()).id);
  };
  try {
    await workout('2026-11-09');
    const legacyScore = await playPerception(page, '2026-11-09');
    await setClock('2026-11-10T08:01:00Z');
    const historical = await (
      await context.request.get('/api/games/perception/results/me?date=2026-11-09')
    ).json();
    expect(historical.score).toBe(legacyScore);
    expect(historical.payload.rounds).toEqual(['clock', 'color', 'dot', 'pattern', 'reaction']);
    await page.goto('/games/leaderboard');
    await page.getByRole('button', { name: 'Previous Day', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Perception Day Board' })).toContainText('· You');
    await expect(page.getByRole('region', { name: 'Perception Day Board' })).toContainText(
      String(legacyScore),
    );
    await page.screenshot({
      path: `/home/ubuntu/perception-runtime-history-${info.project.name}.png`,
    });
    expect(errors).toEqual([]);
  } finally {
    for (const id of entries)
      await expect(
        await context.request.delete(`/api/entries/${id}`, { headers: csrfHeaders }),
      ).toBeOK();
  }

  const active = await makeRower();
  await active.context.setExtraHTTPHeaders({
    ...info.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': '2026-11-10T07:59:00Z',
  });
  const saved = await active.context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: '2026-11-09',
      modality: 'erg',
      zone: 'E',
      distance_m: 1000,
      title: 'Active midnight',
      notes: '',
    },
  });
  await expect(saved).toBeOK();
  const { id } = await saved.json();
  try {
    active.page.on('pageerror', (error) => errors.push(error.message));
    await active.page.goto('/games/perception');
    await waitForSplash(active.page);
    await expect(
      active.page.getByRole('heading', { name: 'Inner Clock', exact: true }),
    ).toBeVisible();
    await active.page.getByRole('button', { name: 'Ready', exact: true }).click();
    const hold = active.page.getByRole('button', { name: 'Press and Hold', exact: true });
    await hold.waitFor();
    await active.context.setExtraHTTPHeaders({
      ...info.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': '2026-11-10T08:00:01Z',
    });
    await hold.focus();
    await active.page.keyboard.down('Space');
    await active.page.waitForTimeout(300);
    await active.page.keyboard.up('Space');
    await expect(active.page.getByRole('alert')).toHaveText(
      'A New Day Has Started. Reload to Play.',
    );
    await active.page.screenshot({
      path: `/home/ubuntu/perception-runtime-midnight-${info.project.name}.png`,
    });
    const day = await (await active.context.request.get('/api/games/perception/today')).json();
    expect(day).toMatchObject({
      date: '2026-11-10',
      access: { unlocked: true, reason: 'no_oyo' },
      round: 0,
      scores: {},
      done: false,
    });
    await active.page.reload();
    await waitForSplash(active.page);
    await expect(
      active.page.getByRole('heading', {
        name: perceptionTitles[perceptionLineup('2026-11-10')[0]],
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      `MIDNIGHT ${info.project.name} old active round rejected safely; new day clean; legacy history OK`,
    );
  } finally {
    await expect(
      await active.context.request.delete(`/api/entries/${id}`, { headers: csrfHeaders }),
    ).toBeOK();
  }
});
