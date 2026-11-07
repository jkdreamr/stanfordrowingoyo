import { test, expect } from './fixtures';
import { seedEntry, feedCard } from './helpers';
import { csrfHeaders } from './api';

test('admin changes a rower role persistently', async ({ adminPage, makeRower }) => {
  const rower = await makeRower();
  await adminPage.goto('/admin');
  await adminPage.getByRole('link', { name: /^Roster/ }).click();
  await adminPage.getByRole('searchbox', { name: 'Search People' }).fill(rower.user.email);
  const row = adminPage.getByRole('button').filter({ hasText: rower.user.name });
  await row.click();
  const sheet = adminPage.getByRole('dialog', { name: 'Edit Person', exact: true });
  await sheet.getByRole('combobox', { name: 'Role', exact: true }).selectOption('coxswain');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await adminPage.reload();
  await adminPage.getByRole('searchbox', { name: 'Search People' }).fill(rower.user.email);
  await row.click();
  await expect(sheet.getByRole('combobox', { name: 'Role', exact: true })).toHaveValue('coxswain');
  const response = await rower.context.request.get('/api/me');
  await expect(response).toBeOK();
  expect((await response.json()).role).toBe('coxswain');
});

test('rower cannot enter Admin', async ({ makeRower }) => {
  const { page } = await makeRower();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Staff Only', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back To Home' })).toHaveAttribute('href', '/');
  await page.goto('/admin/roster');
  await expect(page.getByRole('heading', { name: 'Staff Only', exact: true })).toBeVisible();
});

test('staff manages roster names, CSV and claimed accounts', async ({ adminPage, makeRower }) => {
  const unique = crypto.randomUUID().slice(0, 8);
  const name = `E2E Roster ${unique}`;
  await adminPage.goto('/admin/roster');
  await adminPage.getByRole('button', { name: 'Add Name', exact: true }).click();
  const add = adminPage.getByRole('dialog', { name: 'Add Name', exact: true });
  await add.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await add.getByRole('button', { name: 'Add Name', exact: true }).click();
  await expect(add).not.toBeVisible();
  const search = adminPage.getByRole('searchbox', { name: 'Search People' });
  await search.fill(name);
  const row = adminPage.getByRole('button').filter({ hasText: name });
  await row.click();
  const edit = adminPage.getByRole('dialog', { name: 'Edit Person', exact: true });
  await edit.getByRole('textbox', { name: 'Name', exact: true }).fill(`${name} Renamed`);
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(row).toContainText(`${name} Renamed`);
  await row.click();
  await edit.getByRole('button', { name: 'Delete Name', exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'Delete Name?', exact: true })
    .getByRole('button', { name: 'Delete Name', exact: true })
    .click();
  await expect(row).toHaveCount(0);

  await adminPage.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const csv = adminPage.getByRole('dialog', { name: 'Import CSV', exact: true });
  await csv
    .getByRole('textbox', { name: 'CSV', exact: true })
    .fill('Invalid,bad,rower,normal,,2029');
  await expect(csv.getByRole('button', { name: 'Import 1 Name', exact: true })).toBeDisabled();
  await expect(csv.getByRole('cell', { name: 'Email is invalid.', exact: true })).toBeVisible();
  await csv
    .getByRole('textbox', { name: 'CSV', exact: true })
    .fill(`name,email,role,group,side,class_year\n"${name}, CSV",,rower,frosh,both,2029`);
  await csv.getByRole('button', { name: 'Import 1 Name', exact: true }).click();
  await expect(csv.getByText('Imported 1 Name', { exact: true })).toBeVisible();
  await csv.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(row).toContainText(`${name}, CSV`);

  const rower = await makeRower();
  await adminPage.reload();
  await search.fill(rower.user.email);
  const claimed = adminPage.getByRole('button').filter({ hasText: rower.user.name });
  await claimed.click();
  await edit.getByRole('button', { name: /^Reset Password/ }).click();
  await adminPage
    .getByRole('dialog', { name: 'Reset Password?', exact: true })
    .getByRole('button', { name: 'Reset Password', exact: true })
    .click();
  await expect(
    edit.getByRole('textbox', { name: 'Temporary Password', exact: true }),
  ).not.toHaveValue('');
  const temporaryPassword = await edit
    .getByRole('textbox', { name: 'Temporary Password', exact: true })
    .inputValue();
  expect((await rower.context.request.get('/api/me')).status()).toBe(401);
  await rower.page.goto('/login');
  await rower.page.getByLabel('Email', { exact: true }).fill(rower.user.email);
  await rower.page.getByLabel('Password', { exact: true }).fill(temporaryPassword);
  await rower.page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(rower.page).toHaveURL(/\/change-password/);
  await expect(rower.page.getByLabel('Current Password', { exact: true })).toHaveCount(0);
  await rower.page.getByLabel('New Password', { exact: true }).fill('e2e-permanent-password');
  await rower.page.getByLabel('Confirm Password', { exact: true }).fill('e2e-permanent-password');
  await rower.page.getByRole('button', { name: 'Change Password', exact: true }).click();
  await expect(rower.page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  expect(await (await rower.context.request.get('/api/me')).json()).toMatchObject({
    must_change_password: false,
  });
  await edit.getByRole('button', { name: 'Done', exact: true }).click();
  await claimed.click();
  await expect(edit.getByRole('textbox', { name: 'Temporary Password', exact: true })).toHaveCount(
    0,
  );
  await edit.getByRole('button', { name: /^Unlink Account/ }).click();
  await adminPage
    .getByRole('dialog', { name: 'Unlink Account?', exact: true })
    .getByRole('button', { name: 'Unlink Account', exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  await search.fill(rower.user.name);
  await expect(adminPage.getByRole('button').filter({ hasText: rower.user.name })).toContainText(
    'Unclaimed',
  );
});

test('admin deletes a rower post through the staff API', async ({ adminPage, makeRower }) => {
  const rower = await makeRower();
  const title = `Delete ${rower.user.id}`;
  const entry = await seedEntry(rower, title);
  await expect(await rower.context.request.get(`/api/entries/${entry.id}`)).toBeOK();
  const other = await makeRower();
  expect(
    (
      await other.context.request.delete(`/api/entries/${entry.id}`, {
        headers: csrfHeaders,
      })
    ).status(),
  ).toBe(403);
  const deleted = await adminPage.request.delete(`/api/entries/${entry.id}`, {
    headers: csrfHeaders,
  });
  expect(deleted.status()).toBe(204);
  expect((await rower.context.request.get(`/api/entries/${entry.id}`)).status()).toBe(404);
  const feed = await rower.context.request.get('/api/entries?scope=feed');
  await expect(feed).toBeOK();
  expect((await feed.json()).items).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: entry.id })]),
  );
});

test('admin deletes a rower post from the feed', async ({ adminPage, makeRower }) => {
  const rower = await makeRower();
  const title = `Delete ${rower.user.id}`;
  const entry = await seedEntry(rower, title);
  await rower.page.goto('/feed');
  await expect(feedCard(rower.page, title)).toBeVisible();
  await adminPage.goto(`/entries/${entry.id}`);
  await adminPage.getByRole('button', { name: 'More', exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'Workout Actions', exact: true })
    .getByRole('button', { name: 'Delete Workout', exact: true })
    .click();
  await adminPage
    .getByRole('dialog', { name: 'Delete Workout', exact: true })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(async () => {
    await rower.page.reload();
    await expect(feedCard(rower.page, title)).toHaveCount(0);
  }).toPass();
});

test('staff moderates another rower comment without deleting the workout', async ({
  adminPage,
  makeRower,
}) => {
  const author = await makeRower();
  const commenter = await makeRower();
  const title = `Moderate ${author.user.id}`;
  const entry = await seedEntry(author, title);
  const body = `Comment to moderate ${commenter.user.id}`;
  await commenter.page.goto(`/entries/${entry.id}`);
  await commenter.page.getByRole('combobox', { name: 'Comment', exact: true }).fill(body);
  await commenter.page.getByRole('button', { name: 'Post Comment', exact: true }).click();
  await expect(commenter.page.getByText(body, { exact: true })).toBeVisible();

  await adminPage.goto(`/entries/${entry.id}`);
  const comment = adminPage.getByRole('listitem').filter({ hasText: body });
  await comment.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmation = adminPage.getByRole('dialog', { name: 'Delete Comment', exact: true });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(comment).toBeVisible();
  await comment.getByRole('button', { name: 'Delete', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(comment).toHaveCount(0);
  await commenter.page.reload();
  await expect(commenter.page.getByText(body, { exact: true })).toHaveCount(0);
  await expect(commenter.page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await author.page.goto('/feed');
  await expect(feedCard(author.page, title)).toBeVisible();
});
