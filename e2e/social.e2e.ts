import { test, expect } from './fixtures';
import { seedEntry, feedCard } from './helpers';

test('feed kudos and comments notify the author', async ({ makeRower }) => {
  test.fixme(
    true,
    'Screen Feed not built yet (web/src/pages/Feed.tsx is a stub) — enable when it lands; Notifications is also a stub',
  );
  const a = await makeRower();
  const b = await makeRower();
  const title = `Workout ${a.user.id}`;
  await seedEntry(a, title);
  await b.page.goto('/feed');
  const card = feedCard(b.page, title);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /kudos/i }).click();
  await card.getByRole('button', { name: /comment/i }).click();
  await b.page.getByLabel(/comment/i).fill(`Great work ${a.user.id}`);
  await b.page.getByRole('button', { name: /post comment|send comment/i }).click();
  await a.page.goto('/notifications');
  const notifications = a.page.getByRole('listitem').filter({ hasText: b.user.name });
  await expect(notifications.filter({ hasText: /kudos/i })).toContainText(title);
  await expect(notifications.filter({ hasText: /comment/i })).toContainText(title);
});
