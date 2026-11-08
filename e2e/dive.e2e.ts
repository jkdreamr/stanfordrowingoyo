import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DiveAnswerResult, DiveDay, GameDayLeaderboard } from '../shared/types';
import { DIVE_PROMPTS_PER_DAY, DIVE_TIERS } from '../shared/games/dive';
import { diveSelectionFor } from '../worker/src/games/divePrompts';
import { answerSet } from '../worker/src/games/dive/sets';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { logEntry, seedEntry, waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });

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
  await expect(page.getByText('Games Locked', { exact: true })).toBeVisible();
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
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), timerKey)).toBe(deadline);
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
    await page.getByLabel('Your Answer', { exact: true }).fill(choice?.answer ?? 'zzzzzzzzzz');
    const saving = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/dive/answers') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Dive', exact: true }).click();
    const scored = (await (await saving).json()) as DiveAnswerResult;
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
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
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
