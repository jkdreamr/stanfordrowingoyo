import { test, expect } from './fixtures';
import { seedEntry, feedCard } from './helpers';

test('feed kudos and comments notify the author', async ({ makeRower }) => {
  const a = await makeRower();
  const b = await makeRower();
  const title = `Workout ${a.user.id}`;
  await seedEntry(a, title);
  await b.page.goto('/feed');
  await expect(b.page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible();
  const card = feedCard(b.page, title);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Kudos', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Kudos', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await a.page.goto('/feed');
  await feedCard(a.page, title).getByRole('button', { name: 'View 1 Kudos', exact: true }).click();
  const kudos = a.page.getByRole('dialog', { name: 'Kudos', exact: true });
  await expect(kudos.getByRole('link', { name: b.user.name, exact: true })).toBeVisible();
  await kudos.getByRole('link', { name: b.user.name, exact: true }).click();
  await expect(kudos).not.toBeVisible();
  await expect(a.page).toHaveURL(new RegExp(`/users/${b.user.id}$`));
  await card.getByRole('button', { name: /comment/i }).click();
  await b.page.getByLabel(/comment/i).fill(`Great work ${a.user.id}`);
  await b.page.getByRole('button', { name: /post comment|send comment/i }).click();
  await expect(b.page.getByText(`Great work ${a.user.id}`, { exact: true })).toBeVisible();
  const detailUrl = b.page.url();
  await b.page
    .getByRole('article')
    .getByRole('button', { name: /comment/i })
    .click();
  await expect(b.page.getByLabel('Comment', { exact: true })).toBeFocused();
  expect(b.page.url()).toBe(detailUrl);
  await b.page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(card).toBeVisible();
  await a.page.goto('/notifications');
  const notifications = a.page.getByRole('listitem').filter({ hasText: b.user.name });
  await expect(notifications.filter({ hasText: /kudos/i })).toContainText(title);
  await expect(notifications.filter({ hasText: /comment/i })).toContainText(title);
  await a.page
    .getByRole('listitem')
    .filter({ hasText: /gave kudos/ })
    .first()
    .getByRole('link')
    .click();
  await a.page.getByRole('button', { name: 'More', exact: true }).click();
  const actions = a.page.getByRole('dialog', { name: 'Workout Actions', exact: true });
  await expect(actions.getByRole('link', { name: 'Edit Workout', exact: true })).toHaveAttribute(
    'href',
    /\/log\?edit=/,
  );
  await actions.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  await expect(a.page.getByRole('dialog', { name: 'Delete Workout', exact: true })).toBeVisible();
  await a.page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
