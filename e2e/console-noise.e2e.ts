import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry } from './helpers';

test('logout makes no failed requests and login still works', async ({ makeRower }) => {
  const rower = await makeRower();
  const page = rower.page;
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Log Out', exact: true })).toBeVisible();
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/'))
      failed.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Log Out?' })
    .getByRole('button', { name: 'Log Out', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(failed).toEqual([]);
  await page.getByLabel('Email', { exact: true }).fill(rower.user.email);
  await page.getByLabel('Password', { exact: true }).fill(rower.password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  expect(failed).toEqual([]);
});

test('retained inactive-author posts never fetch that user’s stats after deleting a workout', async ({
  makeRower,
  adminPage,
}) => {
  const author = await makeRower();
  const entry = await seedEntry(author, `Inactive author ${crypto.randomUUID().slice(0, 8)}`);
  const deactivated = await adminPage.request.patch(`/api/admin/users/${author.user.id}`, {
    headers: csrfHeaders,
    data: { active: false },
  });
  await expect(deactivated).toBeOK();
  const viewer = await makeRower();
  const own = await seedEntry(viewer, 'Delete before browsing');
  const page = viewer.page;
  const failed: string[] = [];
  const perUser: string[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && url.pathname.startsWith('/api/'))
      failed.push(`${response.status()} ${url.pathname}${url.search}`);
    if (
      url.searchParams.get('user') === author.user.id ||
      url.pathname === `/api/users/${author.user.id}` ||
      url.searchParams.get('scope') === `user:${author.user.id}`
    )
      perUser.push(`${response.status()} ${url.pathname}${url.search}`);
  });
  await page.goto(`/entries/${own.id}`);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete Workout', exact: true })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
  const title = page.getByRole('link', { name: entry.title, exact: true });
  await title.scrollIntoViewIfNeeded();
  await expect(title).toBeVisible();
  await page.getByRole('link', { name: author.user.name, exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'No Longer On The Team', exact: true }),
  ).toBeVisible();
  expect(perUser).toEqual([]);
  expect(failed).toEqual([]);
});
