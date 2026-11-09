import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DiveDay, DiveGuessResponse, GameDayLeaderboard } from '../shared/types';
import { DIVE_PROMPTS_PER_DAY, DIVE_TIERS, normalizeAnswer } from '../shared/games/dive';
import { diveSelectionFor } from '../worker/src/games/divePrompts';
import { answerSet } from '../worker/src/games/dive/sets';
import { matchAnswer, suggestAnswer, type AnswerSet } from '../worker/src/games/dive/matcher';

import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, seedEntry, waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });

function nearMiss(set: AnswerSet) {
  const canonicals = [
    set.gem.answer,
    ...set.answers
      .trim()
      .split('\n')
      .map((line) => line.split('\t')[1]),
  ];
  for (const canonical of canonicals) {
    const key = normalizeAnswer(canonical);
    if (key.length < 5 || key.length > 40) continue;
    const edits = key.length < 8 ? 2 : 3;
    const guesses: string[] = [];
    for (let i = 0; i <= key.length - edits; i++) {
      guesses.push(key.slice(0, i) + key.slice(i + edits));
    }
    for (let i = 0; i < key.length; i++) {
      const chars = [...key];
      for (let edit = 0; edit < edits; edit++) {
        const position = (i + Math.floor((edit * key.length) / edits)) % key.length;
        chars[position] = chars[position] === 'e' ? 'a' : 'e';
      }
      guesses.push(chars.join(''));
    }
    for (const typed of guesses) {
      if (typed.length < 4 || matchAnswer(typed, set).tier !== 'miss') continue;
      const suggestion = suggestAnswer(typed, set);
      if (suggestion?.canonical === canonical) return { typed, ...suggestion, canonical };
    }
  }
  throw new Error('No unambiguous near-miss outside the auto-accept band for this set');
}

test('Dive keeps guessing, accepts and rejects near misses, and times out a pending suggestion', async ({
  makeRower,
}, testInfo) => {
  test.skip(process.env.E2E_MOCK === '1', 'Requires the real Worker answer sets and test clock');
  test.setTimeout(180000);
  const date = {
    'desktop-chrome': '2026-11-13',
    'iphone-15': '2026-11-14',
    'pixel-7': '2026-11-15',
  }[testInfo.project.name]!;
  const rower = await makeRower();
  const { page, context } = rower;
  const clock = async (seconds: number) =>
    context.setExtraHTTPHeaders({
      ...testInfo.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': new Date(Date.parse(date + 'T18:00:00Z') + seconds * 1000).toISOString(),
    });
  await clock(0);
  await seedEntry(rower, 'Dive near-miss workout');
  const selection = diveSelectionFor(date);
  const sets = await Promise.all(selection.slice(0, 3).map((prompt) => answerSet(prompt.id)));
  const misses = sets.map(nearMiss);
  const shots = join(homedir(), 'dive-pr-shots');
  if (testInfo.project.name === 'iphone-15') await mkdir(shots, { recursive: true });
  async function capture(state: string) {
    if (testInfo.project.name !== 'iphone-15') return;
    await waitForSplash(page);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await page.screenshot({
        path: join(shots, `${state}-${colorScheme}.png`),
        animations: 'disabled',
      });
    }
    await page.emulateMedia({ colorScheme: 'light' });
  }
  async function guess(answer: string) {
    await page.getByLabel('Your Answer', { exact: true }).fill(answer);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/dive/guesses') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Dive', exact: true }).click();
    const saved = await response;
    expect(saved.status()).toBe(200);
    return (await saved.json()) as DiveGuessResponse;
  }
  const day = async () => {
    const response = await context.request.get('/api/games/dive/today');
    await expect(response).toBeOK();
    return (await response.json()) as DiveDay;
  };
  await page.goto('/games/dive');
  await waitForSplash(page);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.getByRole('heading', { name: selection[0].text, exact: true })).toBeVisible();
  const wrong = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
  expect(matchAnswer(wrong, sets[0]).tier).toBe('miss');
  expect(suggestAnswer(wrong, sets[0])).toBeNull();
  expect(await guess(wrong)).toEqual({ outcome: 'not_an_answer', attempts_left: 14 });
  const input = page.getByLabel('Your Answer', { exact: true });
  await expect(page.getByText('Not an answer', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  expect((await day()).answers).toHaveLength(0);
  await capture('not-an-answer');
  await clock(1);
  expect(await guess(misses[0].typed)).toMatchObject({
    outcome: 'suggestion',
    suggestion: misses[0].canonical,
  });
  await expect(page.locator('.dive-prompt').getByRole('status')).toContainText(
    `Did you mean ${misses[0].canonical}?`,
  );
  await expect(input).toBeFocused();
  await capture('suggestion');
  // Reload uses the stored suggestion, not a candidate supplied by the browser.
  await page.reload();
  await waitForSplash(page);
  await expect(page.locator('.dive-prompt').getByRole('status')).toContainText(
    `Did you mean ${misses[0].canonical}?`,
  );
  const accepting = page.waitForResponse((response) =>
    response.url().endsWith('/api/games/dive/suggestion'),
  );
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  const accepted = await accepting;
  expect(accepted.request().postDataJSON()).toEqual({ prompt_index: 0, accept: true });
  expect(await accepted.json()).toMatchObject({
    outcome: 'scored',
    answer: { canonical: misses[0].canonical, points: misses[0].points, tier: misses[0].tier },
  });
  await expect(
    page
      .getByRole('region', { name: 'Answer Result' })
      .getByText(misses[0].canonical, { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await clock(2);
  expect(await guess(misses[1].typed)).toMatchObject({
    outcome: 'suggestion',
    suggestion: misses[1].canonical,
  });
  const rejecting = page.waitForResponse((response) =>
    response.url().endsWith('/api/games/dive/suggestion'),
  );
  await page.getByRole('button', { name: 'No', exact: true }).click();
  const rejected = await rejecting;
  expect(rejected.request().postDataJSON()).toEqual({ prompt_index: 1, accept: false });
  expect(await rejected.json()).toMatchObject({ outcome: 'not_an_answer' });
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByText('Not an answer', { exact: true })).toBeVisible();
  expect((await day()).answers).toHaveLength(1);
  await clock(3);
  expect(await guess(misses[1].canonical)).toMatchObject({
    outcome: 'scored',
    answer: { canonical: misses[1].canonical },
  });
  await expect(page.getByRole('region', { name: 'Answer Result' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await clock(4);
  expect(await guess(misses[2].typed)).toMatchObject({ outcome: 'suggestion' });
  await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
  await clock(34);
  const timeout = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/games/dive/guesses') && response.request().method() === 'POST',
  );
  await page.reload();
  const timedOut = await timeout;
  expect(timedOut.request().postDataJSON()).toEqual({ prompt_index: 2, answer: '' });
  expect(await timedOut.json()).toMatchObject({
    outcome: 'scored',
    answer: { canonical: null, tier: 'miss', points: 0 },
  });
  await expect(
    page
      .getByRole('region', { name: 'Answer Result' })
      .getByRole('heading', { name: DIVE_TIERS.miss.label, exact: true }),
  ).toBeVisible();
  expect((await day()).answers[2]).toMatchObject({ canonical: null, tier: 'miss', points: 0 });
});

test('Dive unlocks, scores the first player immediately and keeps scores through moderation', async ({
  makeRower,
  adminPage,
}, testInfo) => {
  test.setTimeout(180000);
  const dates: Record<string, string> = {
    'desktop-chrome': '2026-11-10',
    'iphone-15': '2026-11-11',
    'pixel-7': '2026-11-12',
  };
  const date = dates[testInfo.project.name];
  const clockHeaders = {
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': `${date}T18:00:00Z`,
  };
  await adminPage.context().setExtraHTTPHeaders(clockHeaders);
  const selection = diveSelectionFor(date);
  const sets = await Promise.all(selection.map((prompt) => answerSet(prompt.id)));
  const choices = sets.map((set, i) =>
    i === 3
      ? null
      : i % 3 === 0
        ? set.gem
        : i % 3 === 1
          ? set.notable[0]
          : set.notable.find((item) => item.tier === 'deep')!,
  );
  const rower = await makeRower();
  const { page, context } = rower;
  const suffix = rower.user.id.slice(0, 8);
  const playerName = `Alex Rivera ${suffix}`;
  const teammateNames = ['Maya Chen', 'Sam Patel', 'Jordan Lee'].map((name) => `${name} ${suffix}`);
  await context.setExtraHTTPHeaders(clockHeaders);
  await expect(
    await context.request.patch('/api/me', { headers: csrfHeaders, data: { name: playerName } }),
  ).toBeOK();
  await page.goto('/games/dive');
  await expect(page.getByText("Log today's OYO to unlock", { exact: true })).toBeVisible();
  expect(
    (
      await context.request.post('/api/games/dive/answers', {
        headers: csrfHeaders,
        data: { prompt_index: 0, answer: choices[0]!.answer },
      })
    ).status(),
  ).toBe(403);
  await logEntry(page, 'erg', 'E', 10000, 'Morning Steady');
  const shots = join(homedir(), 'work', 'shots');
  await mkdir(shots, { recursive: true });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  if (testInfo.project.name === 'iphone-15') {
    await page.goto('/');
    await waitForSplash(page);
    const card = page.getByRole('link', { name: /Daily Games.*Play Today's Games/ });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(shots, 'home-iphone-light.png'), animations: 'disabled' });
  }
  await page.goto('/games');
  await waitForSplash(page);
  await expect(page.getByRole('link', { name: /Dive.*Play/ })).toBeVisible();
  if (testInfo.project.name === 'iphone-15')
    await page.screenshot({ path: join(shots, 'hub-iphone-light.png'), animations: 'disabled' });
  await page.goto('/games/dive');
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('heading', { name: selection[0].text, exact: true })).toBeVisible();
  const timerKey = `oyo:dive:${rower.user.id}:${date}:0`;
  const deadline = await page.evaluate((key) => localStorage.getItem(key), timerKey);
  expect(deadline).toBeTruthy();
  await context.setExtraHTTPHeaders({ ...clockHeaders, 'X-OYO-Test-Now': `${date}T18:00:01Z` });
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  const resumed = await context.request.get('/api/games/dive/today');
  expect((await resumed.json()).pending.deadline_ms_remaining).toBe(24000);
  if (testInfo.project.name === 'iphone-15') {
    await waitForSplash(page);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expect(page.getByLabel('Your Answer', { exact: true })).toBeVisible();
      await page.screenshot({
        path: join(shots, `phase3-iphone-${colorScheme}-play.png`),
        animations: 'disabled',
      });
    }
    await page.emulateMedia({ colorScheme: 'light' });
  }

  for (const [index, choice] of choices.entries()) {
    await expect(
      page.getByText(`${index + 1} of ${DIVE_PROMPTS_PER_DAY}`, { exact: true }),
    ).toBeVisible();
    const saving = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/dive/guesses') &&
        response.request().method() === 'POST',
    );
    if (choice) {
      await page.getByLabel('Your Answer', { exact: true }).fill(choice.answer);
      await page.getByRole('button', { name: 'Dive', exact: true }).click();
    } else {
      await context.setExtraHTTPHeaders({ ...clockHeaders, 'X-OYO-Test-Now': `${date}T18:00:29Z` });
      await page.reload();
    }
    const response = (await (await saving).json()) as DiveGuessResponse;
    expect(response.outcome).toBe('scored');
    if (response.outcome !== 'scored') throw new Error('Expected scored answer');
    const scored = response.answer;
    expect(scored).toMatchObject({
      canonical: choice?.answer ?? null,
      points: choice?.points ?? 0,
      tier: choice?.tier ?? 'miss',
    });
    const reveal = page.getByRole('region', { name: 'Answer Result' });
    await expect(reveal).toBeVisible();
    await expect(
      reveal.getByRole('heading', {
        name: DIVE_TIERS[choice?.tier ?? 'miss'].label,
        exact: true,
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      reveal.locator('.dive-answer-notes').getByText(sets[index].gem.answer, { exact: true }),
    ).toBeVisible();
    if (index === 0) {
      const first = (await (await context.request.get('/api/games/dive/today')).json()) as DiveDay;
      expect(first.score).toBe(100);
      expect(first.result?.score).toBe(100);
      await expect(page.locator('.dive-marker-sinking')).toHaveCSS('animation-name', 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect(page.locator('.dive-marker-sinking')).toHaveCSS('animation-name', 'dive-sink');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const [n, name] of teammateNames.entries()) {
        const teammate = await makeRower();
        await teammate.context.setExtraHTTPHeaders(clockHeaders);
        await expect(
          await teammate.context.request.patch('/api/me', { headers: csrfHeaders, data: { name } }),
        ).toBeOK();
        await seedEntry(teammate, 'Morning Row');
        for (const [prompt_index, set] of sets.entries()) {
          const answer = prompt_index === 0 && n < 2 ? set.gem.answer : set.notable[n % 3].answer;
          await expect(
            await teammate.context.request.post('/api/games/dive/answers', {
              headers: csrfHeaders,
              data: { prompt_index, answer },
            }),
          ).toBeOK();
        }
      }
    }
    if (index < DIVE_PROMPTS_PER_DAY - 1) {
      const starting = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/games/dive/start') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      expect((await starting).status()).toBe(200);
    } else await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your Dive', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team Answers', exact: true })).toBeVisible();
  const result = (await (await context.request.get('/api/games/dive/today')).json()) as DiveDay;
  expect(result.complete).toBe(true);
  expect(result.score).toBe(choices.reduce((score, choice) => score + (choice?.points ?? 0), 0));
  expect(result.reveal?.[0].groups.some((group) => group.count === 3 && group.mine)).toBe(true);
  expect(result.reveal?.some((prompt) => prompt.groups.some((group) => group.only_you))).toBe(true);
  const firstGroup = page
    .getByRole('region', { name: 'Team Answers' })
    .locator('details')
    .first()
    .locator('.dive-group')
    .filter({ hasText: choices[0]!.answer });
  for (const name of [playerName, ...teammateNames.slice(0, 2)])
    await expect(firstGroup.getByText(new RegExp(name))).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Dive Day Board' })
      .getByText('Live · 4 Players', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  if (testInfo.project.name === 'iphone-15') {
    await page.screenshot({
      path: join(shots, 'iphone-light-results.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({
      path: join(shots, 'iphone-dark-results.png'),
      fullPage: true,
      animations: 'disabled',
    });
    // Completed players have their own group on every prompt; use the valid empty-group
    // response shape to verify the mixed Team Answers state without mutating server data.
    const mixed = {
      ...result,
      reveal: result.reveal?.map((prompt, i) => (i === 1 ? { ...prompt, groups: [] } : prompt)),
    };
    await page.route('**/api/games/dive/today', (route) => route.fulfill({ json: mixed }));
    await page.reload();
    await waitForSplash(page);
    const teamAnswers = page.getByRole('region', { name: 'Team Answers' });
    const empty = teamAnswers.getByText('No teammates yet', { exact: true });
    await expect(empty).toBeVisible();
    await expect(teamAnswers.locator('.dive-empty-group')).toHaveCount(1);
    await expect(
      teamAnswers.locator('.dive-empty-group').getByText(selection[1].text, { exact: true }),
    ).toBeVisible();
    await expect(teamAnswers.locator('.dive-empty-group details')).toHaveCount(0);
    await expect(teamAnswers.locator('.dive-empty-group summary')).toHaveCount(0);
    await expect(
      teamAnswers.locator('details').first().getByText(choices[0]!.answer, { exact: false }),
    ).toBeVisible();
    await teamAnswers.evaluate((element) => {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 80);
    });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expect(empty).toBeInViewport();
      await page.screenshot({
        path: join(shots, `phase3-iphone-${colorScheme}-team-answers.png`),
        animations: 'disabled',
      });
    }
    await page.unroute('**/api/games/dive/today');
    await page.reload();
  }
  if (testInfo.project.name === 'desktop-chrome')
    await page.screenshot({
      path: join(shots, 'desktop-results.png'),
      fullPage: true,
      animations: 'disabled',
    });

  const canonical = result.answers[0].canonical!;
  await adminPage.goto('/games/dive');
  await adminPage.getByRole('button', { name: `Hide ${canonical}`, exact: true }).click();
  const sheet = adminPage.getByRole('dialog');
  await expect(
    sheet.getByText('Hide This Answer From Team View. Scores Stay The Same.'),
  ).toBeVisible();
  await sheet.getByRole('button', { name: 'Hide Answer', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(
    adminPage.getByRole('button', { name: `Unhide ${canonical}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  const moderated = (await (await context.request.get('/api/games/dive/today')).json()) as DiveDay;
  expect(moderated.answers[0]).toMatchObject({
    canonical,
    tier: result.answers[0].tier,
    points: result.answers[0].points,
    hidden: true,
  });
  expect(moderated.score).toBe(result.score);
  const board = (await (
    await context.request.get('/api/games/dive/leaderboard')
  ).json()) as GameDayLeaderboard;
  expect(board.rows.find((row) => row.me)?.score).toBe(result.score);
  await expect(
    page.getByRole('region', { name: 'Dive Log' }).getByText('Hidden From Team', { exact: true }),
  ).toBeVisible();
});

for (const role of ['coxswain', 'coach'] as const) {
  test(`${role} plays without OYO and only reviews or moderates after finishing`, async ({
    makeRower,
    adminPage,
  }, testInfo) => {
    const player = await makeRower();
    const date = `2026-11-${20 + ['desktop-chrome', 'iphone-15', 'pixel-7'].indexOf(testInfo.project.name) * 2 + (role === 'coach' ? 1 : 0)}`;
    const headers = {
      ...testInfo.project.use.extraHTTPHeaders,
      'X-OYO-Test-Now': date + 'T18:00:00Z',
    };
    await player.context.setExtraHTTPHeaders(headers);
    await adminPage.context().setExtraHTTPHeaders(headers);
    await expect(
      await adminPage.request.patch('/api/admin/users/' + player.user.id, {
        headers: csrfHeaders,
        data: { role },
      }),
    ).toBeOK();
    await expect(
      await adminPage.request.post('/api/games/dive/answers', {
        headers: csrfHeaders,
        data: { prompt_index: 0, answer: 'spoiler guard' },
      }),
    ).toBeOK();
    const before: DiveDay = await (
      await player.context.request.get('/api/games/dive/today')
    ).json();
    expect(before.access).toMatchObject({ unlocked: true, reason: 'staff' });
    expect(before.reveal).toBeNull();
    expect((await player.context.request.get('/api/games/dive/days/' + date)).status()).toBe(403);
    expect((await player.context.request.get('/api/games/dive/leaderboard')).status()).toBe(403);
    const body = { date, prompt_index: 0, normalized: 'spoiler guard', hidden: true };
    expect(
      (
        await player.context.request.patch('/api/games/dive/answers', {
          headers: csrfHeaders,
          data: body,
        })
      ).status(),
    ).toBe(403);
    const admin: DiveDay = await (await adminPage.request.get('/api/games/dive/today')).json();
    expect(admin.complete).toBe(false);
    expect(admin.reveal![0].groups).toHaveLength(1);
    await player.page.goto('/games/leaderboard');
    for (const title of ['Dive', 'Word Guess', 'Perception', 'Connections']) {
      const board = player.page.getByRole('region', { name: `${title} Day Board` });
      await expect(board.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(board.getByText('Play To See Today’s Board', { exact: true })).toBeVisible();
      await expect(board.getByRole('link')).toHaveCount(0);
    }
    if (role === 'coxswain' && testInfo.project.name === 'pixel-7') {
      await expect(player.page.locator('#launch-splash')).toHaveCount(0);
      await player.page.screenshot({
        path: testInfo.outputPath('locked-game-boards.png'),
        fullPage: true,
      });
    }
    await player.page.goto('/games/dive');
    await expect(player.page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
    await expect(player.page.getByRole('region', { name: 'Team Answers' })).toHaveCount(0);
    await expect(
      player.context.request.post('/api/games/dive/answers', {
        headers: csrfHeaders,
        data: { prompt_index: 0, answer: '' },
      }),
    ).resolves.toBeOK();
    expect((await player.context.request.get('/api/games/dive/leaderboard')).status()).toBe(403);
    for (let i = 1; i < DIVE_PROMPTS_PER_DAY; i++)
      await expect(
        await player.context.request.post('/api/games/dive/answers', {
          headers: csrfHeaders,
          data: { prompt_index: i, answer: '' },
        }),
      ).toBeOK();
    await player.page.reload();
    await expect(player.page.getByRole('region', { name: 'Team Answers' })).toBeVisible();
    await expect(
      player.page.getByRole('button', { name: 'Hide spoiler guard', exact: true }),
    ).toBeVisible();
    expect((await player.context.request.get('/api/games/dive/leaderboard')).status()).toBe(200);
    await expect(
      await player.context.request.patch('/api/games/dive/answers', {
        headers: csrfHeaders,
        data: body,
      }),
    ).toBeOK();
  });
}
