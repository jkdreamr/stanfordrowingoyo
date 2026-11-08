import { test, expect } from './fixtures';
import { csrfHeaders } from './api';

test('a live announcement alert opens its exact announcement despite a stale list', async ({
  makeRower,
  adminPage,
}) => {
  const rower = await makeRower();
  const create = async (title: string) => {
    const response = await adminPage.request.post('/api/announcements', {
      headers: csrfHeaders,
      data: { title, body: title + ' body', pinned: false },
    });
    await expect(response).toBeOK();
    return response.json();
  };
  const older = await create(`Older notice ${rower.user.id}`);
  await rower.page.goto('/notifications');
  const alerts = rower.page.getByRole('button', { name: /posted an announcement/ });
  await expect(alerts.first()).toBeVisible();
  const latest = await create(`New notice ${rower.user.id}`);
  const refreshed = rower.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/notifications' &&
      response.request().method() === 'GET',
  );
  await rower.page.evaluate(() =>
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', { data: { type: 'oyo-push' } }),
    ),
  );
  await refreshed;
  const latestAlert = rower.page.locator(`button[data-announcement-id="${latest.id}"]`);
  await expect(latestAlert).toBeVisible();
  await latestAlert.click();
  const sheet = rower.page.getByRole('dialog', { name: 'Announcements', exact: true });
  await expect(sheet.getByRole('heading', { name: latest.title, exact: true })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: older.title, exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    await adminPage.request.delete(`/api/announcements/${latest.id}`, { headers: csrfHeaders }),
  ).toBeOK();
  await latestAlert.click();
  await expect(sheet.getByText('Announcement removed', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: latest.title, exact: true })).toHaveCount(0);
  const close = sheet.getByRole('button', { name: 'Close', exact: true });
  const box = await close.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  await close.click();
  await rower.page.goto(`/announcements?announcement=${latest.id}`);
  await expect(rower.page.getByText('Announcement removed', { exact: true })).toBeVisible();
  await expect(rower.page.getByRole('article')).toHaveCount(0);
});
