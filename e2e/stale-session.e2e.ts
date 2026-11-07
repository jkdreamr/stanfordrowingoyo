import { test, expect } from './fixtures';
import { csrfHeaders } from './api';

test('missing zone pace hint links to adding a test on Me', async ({ makeRower }) => {
  const { page } = await makeRower();
  await page.goto('/log');
  const hint = page.getByRole('link', { name: 'Add a test on Me' });
  await expect(hint).toHaveAttribute('href', '/me#erg-tests');
  await hint.click();
  const history = page.getByRole('region', { name: 'Erg Tests', exact: true });
  await expect(history).toBeInViewport();
  await history.getByRole('button', { name: 'Add Test', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add Test', exact: true })).toBeVisible();
});

for (const reason of [
  'password change',
  'admin reset',
  'admin removal',
  'invalid cookie',
] as const) {
  test(`stale session after ${reason} lands on Login without a request loop`, async ({
    makeRower,
    browser,
    adminPage,
  }, testInfo) => {
    const rower = await makeRower();
    const other = await browser.newContext({ ...testInfo.project.use });
    try {
      await expect(
        await other.request.post('/api/auth/login', {
          headers: csrfHeaders,
          data: { email: rower.user.email, password: rower.password },
        }),
      ).toBeOK();
      const page = await other.newPage();
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
      if (reason === 'password change') {
        const verification = await rower.context.request.post('/api/me/password/verify', {
          headers: csrfHeaders,
          data: { current_password: rower.password },
        });
        await expect(verification).toBeOK();
        const { reauth_token } = await verification.json();
        await expect(
          await rower.context.request.post('/api/me/password', {
            headers: csrfHeaders,
            data: { new_password: 'new-e2e-password-123', reauth_token },
          }),
        ).toBeOK();
      } else if (reason === 'admin reset') {
        await expect(
          await adminPage.request.post(`/api/admin/users/${rower.user.id}/reset-password`, {
            headers: csrfHeaders,
          }),
        ).toBeOK();
      } else if (reason === 'admin removal') {
        await expect(
          await adminPage.request.post(`/api/admin/users/${rower.user.id}/remove`, {
            headers: csrfHeaders,
            data: { confirmation_email: rower.user.email },
          }),
        ).toBeOK();
      } else await other.clearCookies();
      let requests = 0;
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/me')) requests++;
      });
      await page.clock.setSystemTime(Date.now() + 60000);
      await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
      await page.waitForTimeout(3000);
      console.log(`${reason}: ${requests} /api/me* requests in 3s`);
      expect(requests).toBeLessThan(5);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    } finally {
      await other.close();
    }
  });
}
