import { test, expect } from './fixtures';
import { feedCard } from './helpers';

test('tagging and mentions notify teammates across separate sessions', async ({
  makeRower,
}, testInfo) => {
  test.skip(process.env.E2E_MOCK === '1', 'Requires shared real-backend sessions');
  const a = await makeRower();
  const b = await makeRower();
  const title = `Tagged Workout ${a.user.id}`;
  await a.page.goto('/log');
  await a.page.getByLabel('Meters', { exact: true }).fill('10000');
  await a.page.getByLabel('Title', { exact: true }).fill(title);
  await a.page.getByRole('button', { name: 'Tag Teammates', exact: true }).click();
  const picker = a.page.getByRole('dialog', { name: 'Tag Teammates', exact: true });
  await picker.getByLabel('Search Teammates').fill(b.user.name);
  await picker.getByRole('button', { name: b.user.name, exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await a.page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(a.page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await a.page.goto('/feed');
  const card = feedCard(a.page, title);
  await expect(
    card.getByRole('button', { name: `with ${b.user.name}`, exact: true }),
  ).toBeVisible();
  await b.page.goto('/notifications');
  const tag = b.page
    .getByRole('listitem')
    .filter({ hasText: 'tagged you in' })
    .filter({ hasText: title });
  await tag.getByRole('link').click();
  await expect(b.page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const entryUrl = b.page.url();
  await a.page.goto(entryUrl);
  const composer = a.page.getByRole('combobox', { name: 'Comment', exact: true });
  await composer.fill(`@${b.user.name}`);
  await a.page.getByRole('option', { name: b.user.name, exact: true }).click();
  await expect(composer).toHaveValue(`@${b.user.name} `);
  await composer.fill(`Strong session @${b.user.name} — see you tomorrow.`);
  await a.page.getByRole('button', { name: 'Post Comment', exact: true }).click();
  await expect(a.page.getByRole('link', { name: `@${b.user.name}`, exact: true })).toHaveAttribute(
    'href',
    `/users/${b.user.id}`,
  );
  const mention = a.page.getByRole('link', { name: `@${b.user.name}`, exact: true });
  await expect(mention).toHaveCSS('display', 'inline');
  await mention.locator('..').screenshot({ path: testInfo.outputPath('inline-mention.png') });
  await expect(card.getByRole('button', { name: '1 Comment', exact: true })).toBeVisible();
  await b.page.goto('/notifications');
  const notification = b.page
    .getByRole('listitem')
    .filter({ hasText: 'mentioned you in' })
    .filter({ hasText: title });
  await notification.getByRole('link').click();
  await expect(b.page).toHaveURL(`${entryUrl}#comments`);
  await b.page.getByRole('link', { name: `@${b.user.name}`, exact: true }).click();
  await expect(b.page).toHaveURL(new RegExp(`/users/${b.user.id}$`));
});
