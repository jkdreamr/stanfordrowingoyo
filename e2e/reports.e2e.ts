import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry } from './helpers';

test('author edits a comment and only new mentions notify', async ({ makeRower, adminPage }) => {
  test.skip(process.env.E2E_MOCK === '1', 'Requires shared backend sessions');
  const author = await makeRower();
  const first = await makeRower();
  const next = await makeRower();
  const entry = await seedEntry(author, `Edit Discussion ${author.user.id}`);
  const created = await author.context.request.post(`/api/entries/${entry.id}/comments`, {
    headers: csrfHeaders,
    data: { body: `Hello @${first.user.name}`, mention_ids: [first.user.id] },
  });
  await expect(created).toBeOK();
  const comment = await created.json();
  await author.page.goto(`/entries/${entry.id}`);
  const row = author.page.getByRole('listitem').filter({ hasText: `Hello @${first.user.name}` });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = author.page.getByRole('form', { name: 'Edit Comment', exact: true });
  await editor
    .getByRole('combobox', { name: 'Comment' })
    .fill(`Hello @${first.user.name} and @${next.user.name}`);
  await author.page.getByRole('option', { name: next.user.name, exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(author.page.getByText(/edited/, { exact: false })).toBeVisible();
  await expect(row.getByRole('link', { name: `@${next.user.name}`, exact: true })).toHaveAttribute(
    'href',
    `/users/${next.user.id}`,
  );
  await author.page.reload();
  await expect(author.page.getByText(/edited/, { exact: false })).toBeVisible();
  for (const person of [first, next]) {
    const notifications = await person.context.request.get('/api/notifications');
    const items = await notifications.json();
    expect(
      items.filter(
        (n: { kind: string; entry_id: string }) => n.kind === 'mention' && n.entry_id === entry.id,
      ),
    ).toHaveLength(1);
  }
  await adminPage.goto(`/entries/${entry.id}`);
  await expect(adminPage.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(adminPage.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  const forbidden = await adminPage.request.patch(`/api/comments/${comment.id}`, {
    headers: csrfHeaders,
    data: { body: 'Staff cannot edit this' },
  });
  expect(forbidden.status()).toBe(403);
});

test('rower reports workouts and comments, staff dismisses or deletes with an audit trail', async ({
  makeRower,
  adminPage,
}) => {
  test.skip(process.env.E2E_MOCK === '1', 'Requires shared backend sessions');
  const owner = await makeRower();
  const reporter = await makeRower();
  const entry = await seedEntry(owner, `Review Workout ${owner.user.id}`);
  await owner.context.request.post(`/api/entries/${entry.id}/comments`, {
    headers: csrfHeaders,
    data: { body: `Review Comment ${owner.user.id}` },
  });
  await reporter.page.goto(`/entries/${entry.id}`);
  await reporter.page.getByRole('button', { name: 'More', exact: true }).click();
  await reporter.page.getByRole('button', { name: 'Report Workout', exact: true }).click();
  const sheet = reporter.page.getByRole('dialog', { name: 'Report Workout' });
  await sheet.getByLabel('Reason (Optional)').fill(`Workout review ${reporter.user.id}`);
  await sheet.getByRole('button', { name: 'Send Report', exact: true }).click();
  await expect(reporter.page.getByText('Report sent', { exact: true })).toBeVisible();
  const privateQueue = await reporter.context.request.get('/api/admin/reports');
  expect(privateQueue.status()).toBe(403);
  await reporter.page.getByRole('button', { name: 'Report', exact: true }).click();
  const commentSheet = reporter.page.getByRole('dialog', { name: 'Report Comment' });
  await commentSheet.getByRole('button', { name: 'Send Report', exact: true }).click();
  await expect(commentSheet).not.toBeVisible();
  await adminPage.goto('/notifications');
  const notification = adminPage
    .getByRole('listitem')
    .filter({ hasText: reporter.user.name })
    .filter({ hasText: 'reported' })
    .first();
  await notification.getByRole('link').click();
  await expect(adminPage).toHaveURL(/\/admin\/reports$/);
  const workoutReport = adminPage
    .getByRole('article', { name: `Report by ${reporter.user.name}`, exact: true })
    .filter({ hasText: `Workout review ${reporter.user.id}` });
  await expect(workoutReport.getByText(entry.title, { exact: true })).toBeVisible();
  const duplicate = await reporter.context.request.post('/api/reports', {
    headers: csrfHeaders,
    data: { target_type: 'entry', target_id: entry.id, reason: 'duplicate' },
  });
  expect(duplicate.status()).toBe(200);
  await workoutReport.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(workoutReport).not.toBeVisible();
  const commentReport = adminPage.getByRole('article', {
    name: `Report by ${reporter.user.name}`,
    exact: true,
  });
  await expect(
    commentReport.getByText(`Review Comment ${owner.user.id}`, { exact: true }),
  ).toBeVisible();
  await commentReport.getByRole('button', { name: 'Delete Content', exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'Delete Reported Content' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(commentReport).not.toBeVisible();
  await adminPage.getByRole('radio', { name: 'Deleted', exact: true }).click();
  await expect(
    adminPage
      .getByRole('article', { name: `Report by ${reporter.user.name}`, exact: true })
      .getByText('Content Deleted'),
  ).toBeVisible();
  await reporter.page.reload();
  await expect(
    reporter.page.getByText(`Review Comment ${owner.user.id}`, { exact: true }),
  ).toHaveCount(0);
  await expect(
    reporter.page.getByRole('heading', { name: entry.title, exact: true }),
  ).toBeVisible();
  const audit = await adminPage.request.get('/api/admin/audit');
  const activity = await audit.json();
  expect(activity.items.some((row: { action: string }) => row.action === 'report.dismiss')).toBe(
    true,
  );
  expect(activity.items.some((row: { action: string }) => row.action === 'report.delete')).toBe(
    true,
  );
});
