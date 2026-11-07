import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import { completeSignup, openSettings, seedEntry } from './helpers';
import { csrfHeaders } from './api';

test('Download My Data saves only the signed-in account data as JSON', async ({ makeRower }) => {
  const rower = await makeRower();
  const teammate = await makeRower();
  const own = await seedEntry(rower, `Export ${rower.user.id}`);
  const other = await seedEntry(teammate, `Other ${teammate.user.id}`);
  const comment = `Export Comment ${rower.user.id}`;
  await expect(
    await rower.context.request.post(`/api/entries/${other.id}/comments`, {
      headers: csrfHeaders,
      data: { body: comment },
    }),
  ).toBeOK();
  await expect(
    await rower.context.request.post(`/api/entries/${other.id}/kudos`, { headers: csrfHeaders }),
  ).toBeOK();
  const config = await (await rower.context.request.get('/api/config')).json();
  for (const [person, note] of [
    [rower, 'Export Private Plan'],
    [teammate, 'Other Private Plan'],
  ] as const) {
    await expect(
      await person.context.request.put('/api/me/plan', {
        headers: csrfHeaders,
        data: {
          start_date: config.current_week_start,
          sessions: [
            { week: 1, day: 0, slot: 'AM', modality: 'erg', zone: 'E', distance_m: 10000, note },
          ],
          rest_days: [],
        },
      }),
    ).toBeOK();
  }
  await openSettings(rower.page);
  const downloaded = rower.page.waitForEvent('download');
  await rower.page.getByRole('button', { name: /^Download My Data/ }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('oyo-my-data.json');
  const raw = await readFile((await download.path())!, 'utf8');
  const data = JSON.parse(raw);
  expect(data.profile.id).toBe(rower.user.id);
  expect(data.workouts.map((entry: { id: string }) => entry.id)).toEqual([own.id]);
  expect(data.kudos_given).toEqual([
    expect.objectContaining({ entry_id: other.id, user_id: rower.user.id }),
  ]);
  expect(raw).toContain(own.id);
  expect(raw).toContain(comment);
  expect(raw).toContain('Export Private Plan');
  expect(raw).not.toContain('Other Private Plan');
  expect(raw).not.toContain(teammate.user.email);
  expect(raw).not.toMatch(/password_hash|token_hash|csrf|session_token/);
  const csv = await rower.context.request.get('/api/me/export/workouts');
  await expect(csv).toBeOK();
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain(own.id);
  expect(await csv.text()).not.toContain(other.id);
});

test('admin confirms permanent rower removal and linked content disappears', async ({
  adminPage,
  makeRower,
}, testInfo) => {
  const rower = await makeRower();
  const teammate = await makeRower();
  const own = await seedEntry(rower, `Remove ${rower.user.id}`);
  const other = await seedEntry(teammate, `Keep ${teammate.user.id}`);
  await expect(
    await rower.context.request.put('/api/me/plan', {
      headers: csrfHeaders,
      data: {
        start_date: mondayOf(teamToday()),
        rest_days: [],
        sessions: [],
      },
    }),
  ).toBeOK();
  const comment = `Remove Comment ${rower.user.id}`;
  await expect(
    await rower.context.request.post(`/api/entries/${other.id}/comments`, {
      headers: csrfHeaders,
      data: { body: comment },
    }),
  ).toBeOK();
  await expect(
    await rower.context.request.post(`/api/entries/${other.id}/kudos`, { headers: csrfHeaders }),
  ).toBeOK();
  await expect(
    await teammate.context.request.patch(`/api/entries/${other.id}`, {
      headers: csrfHeaders,
      data: { tagged_user_ids: [rower.user.id] },
    }),
  ).toBeOK();
  await expect(
    await teammate.context.request.post(`/api/entries/${other.id}/comments`, {
      headers: csrfHeaders,
      data: { body: `Kept mention @${rower.user.name}`, mention_ids: [rower.user.id] },
    }),
  ).toBeOK();
  await adminPage.goto('/admin/roster');
  await adminPage.getByRole('searchbox', { name: 'Search People' }).fill(rower.user.email);
  await adminPage.getByRole('button').filter({ hasText: rower.user.name }).click();
  await adminPage
    .getByRole('dialog', { name: 'Edit Person', exact: true })
    .getByRole('button', { name: 'Remove Account', exact: true })
    .click();
  const sheet = adminPage.getByRole('dialog', { name: 'Remove Account?', exact: true });
  const remove = sheet.getByRole('button', { name: 'Remove', exact: true });
  await expect(remove).toBeDisabled();
  await sheet.getByLabel('Confirm Email', { exact: true }).fill('incorrect@example.com');
  await expect(remove).toBeDisabled();
  await sheet.getByLabel('Confirm Email', { exact: true }).fill(rower.user.email);
  await expect(remove).toBeEnabled();
  for (const colorScheme of ['light', 'dark'] as const) {
    await adminPage.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    if (colorScheme === 'dark') await expect(adminPage.locator('html')).toHaveClass(/dark/);
    else await expect(adminPage.locator('html')).not.toHaveClass(/dark/);
    await adminPage.screenshot({
      path: testInfo.outputPath(`remove-${testInfo.project.name}-${colorScheme}.png`),
      fullPage: true,
    });
  }
  await remove.click();
  await expect(sheet).not.toBeVisible();
  await expect(adminPage.getByRole('button').filter({ hasText: rower.user.name })).toHaveCount(0);
  expect((await rower.context.request.get('/api/me')).status()).toBe(401);
  expect((await teammate.context.request.get(`/api/entries/${own.id}`)).status()).toBe(404);
  await expect(await teammate.context.request.get(`/api/entries/${other.id}`)).toBeOK();
  expect(
    (await (await teammate.context.request.get(`/api/entries/${other.id}`)).json()).tagged,
  ).toEqual([]);
  const keptComments = await (
    await teammate.context.request.get(`/api/entries/${other.id}/comments`)
  ).json();
  expect(keptComments).toEqual([
    expect.objectContaining({ body: `Kept mention @${rower.user.name}`, mentions: [] }),
  ]);
  expect(
    await (await teammate.context.request.get(`/api/entries/${other.id}/comments`)).json(),
  ).not.toEqual(expect.arrayContaining([expect.objectContaining({ body: comment })]));
  expect(
    await (await teammate.context.request.get(`/api/entries/${other.id}/kudos`)).json(),
  ).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: rower.user.id })]));
  expect(await (await teammate.context.request.get('/api/leaderboard')).json()).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ user: expect.objectContaining({ id: rower.user.id }) }),
    ]),
  );
  await rower.page.reload();
  await expect(rower.page).toHaveURL(/\/login\?next=/);
  await expect(rower.page.getByLabel('Email', { exact: true })).toBeVisible();
  const audit = await (await adminPage.request.get('/api/admin/audit')).json();
  expect(audit.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: 'user.remove', target: rower.user.id }),
    ]),
  );
  expect(JSON.stringify(audit)).not.toContain(rower.user.email);
  await adminPage.goto('/admin/audit');
  await expect(adminPage.getByText(/permanently removed a rower account/).first()).toBeVisible();
  await expect(
    adminPage.getByText(/1 workout.*1 comment.*1 kudos.*1 private plan/).first(),
  ).toBeVisible();
});

test('signup intro completes once across devices and can reopen from Settings', async ({
  page,
  browser,
  bootstrap,
  newRowerSignup,
}, testInfo) => {
  const signup = await newRowerSignup();
  await page.goto('/signup');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
  await completeSignup(page, signup, bootstrap.teamCode, false);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Training Zones', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E-meters', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your Weekly Target', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await openSettings(page);
  await page.getByRole('link', { name: 'Quick Intro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E-meters', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const other = await browser.newContext({
    ...testInfo.project.use,
    baseURL: testInfo.project.use.baseURL,
  });
  try {
    await expect(
      await other.request.post('/api/auth/login', {
        data: { email: signup.email, password: signup.password },
        headers: csrfHeaders,
      }),
    ).toBeOK();
    const secondPage = await other.newPage();
    await secondPage.goto('/');
    await expect(secondPage.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
    expect((await (await other.request.get('/api/me/intro')).json()).completed_at).toBeTruthy();
  } finally {
    await other.close();
  }
});

test('privacy is public and Settings links to it in light and dark', async ({
  page,
  makeRower,
}, testInfo) => {
  await page.goto('/signup');
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy Notice', exact: true })).toBeVisible();
  await expect(page.getByText(/My Fortnight plans are visible only to you/)).toBeVisible();
  await expect(page.getByText('November 6, 2026')).toBeVisible();
  await expect(page.getByText(/contact a team admin or coxswain in the app/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team Directory', exact: true })).toHaveAttribute(
    'href',
    '/team',
  );
  const rower = await makeRower();
  await openSettings(rower.page);
  for (const theme of ['Light', 'Dark'] as const) {
    await rower.page.getByRole('radio', { name: theme, exact: true }).click();
    await rower.page.getByRole('link', { name: 'Quick Intro', exact: true }).click();
    await expect(rower.page.getByRole('heading', { name: 'E-meters', exact: true })).toBeVisible();
    await rower.page.screenshot({
      path: testInfo.outputPath(`intro-${testInfo.project.name}-${theme.toLowerCase()}.png`),
      fullPage: true,
    });
    await rower.page.getByRole('button', { name: 'Skip', exact: true }).click();
    await rower.page.getByRole('link', { name: 'Privacy', exact: true }).click();
    await expect(
      rower.page.getByRole('heading', { name: 'Privacy Notice', exact: true }),
    ).toBeVisible();
    expect(
      await rower.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await rower.page.screenshot({
      path: testInfo.outputPath(`privacy-${testInfo.project.name}-${theme.toLowerCase()}.png`),
      fullPage: true,
    });
    await rower.page.getByRole('link', { name: 'Settings', exact: true }).click();
  }
});
