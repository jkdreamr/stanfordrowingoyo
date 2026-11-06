import { test, expect } from './fixtures';
import { seedEntry, feedCard } from './helpers';

test('admin changes a rower role persistently', async ({ adminPage, makeRower }) => {
  test.fixme(
    true,
    'Screen Roster not built yet (web/src/pages/admin/Roster.tsx is a stub) — enable when it lands',
  );
  const rower = await makeRower();
  await adminPage.goto('/admin');
  await adminPage.getByRole('link', { name: 'Roster', exact: true }).click();
  const row = adminPage.getByRole('row').filter({ hasText: rower.user.email });
  await row.getByRole('combobox', { name: /role/i }).selectOption('coxswain');
  await row.getByRole('button', { name: /save/i }).click();
  await adminPage.reload();
  await expect(row.getByRole('combobox', { name: /role/i })).toHaveValue('coxswain');
  const response = await rower.context.request.get('/api/me');
  await expect(response).toBeOK();
  expect((await response.json()).role).toBe('coxswain');
});

test('rower cannot enter Admin', async ({ makeRower }) => {
  test.fixme(
    true,
    'Screen Admin not built yet (web/src/pages/Admin.tsx is a stub) — enable when it lands; routes.tsx has no role guard',
  );
  const { page } = await makeRower();
  await page.goto('/admin');
  await expect(async () => {
    const redirected = new URL(page.url()).pathname !== '/admin';
    const forbidden = await page.getByText(/forbidden|access denied|not authorized/i).isVisible();
    expect(redirected || forbidden).toBe(true);
  }).toPass();
});

test('admin deletes a rower post from the feed', async ({ adminPage, makeRower }) => {
  test.fixme(
    true,
    'Screen Feed not built yet (web/src/pages/Feed.tsx is a stub) — enable when it lands; EntryDetail is also a stub',
  );
  const rower = await makeRower();
  const title = `Delete ${rower.user.id}`;
  const entry = await seedEntry(rower, title);
  await rower.page.goto('/feed');
  await expect(feedCard(rower.page, title)).toBeVisible();
  await adminPage.goto(`/entries/${entry.id}`);
  adminPage.once('dialog', (dialog) => dialog.accept());
  await adminPage.getByRole('button', { name: /delete/i }).click();
  const confirm = adminPage.getByRole('dialog');
  if (await confirm.isVisible())
    await confirm.getByRole('button', { name: /delete|confirm/i }).click();
  await expect(async () => {
    await rower.page.reload();
    await expect(feedCard(rower.page, title)).toHaveCount(0);
  }).toPass();
});
