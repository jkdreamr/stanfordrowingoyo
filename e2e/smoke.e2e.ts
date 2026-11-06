import { test, expect } from './fixtures';
import { csrfHeaders } from './api';

test('shell, manifest, and health load without backend auth', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Stanford Rowing OYO');
  await expect(
    page.getByRole('heading', { name: 'Stanford Rowing OYO', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  const manifestPath = await page.evaluate(() =>
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute('href'),
  );
  expect(manifestPath).toBeTruthy();
  const manifest = await request.get(manifestPath!);
  await expect(manifest).toBeOK();
  expect(await manifest.json()).toMatchObject({
    name: 'Stanford Rowing OYO',
    display: 'standalone',
  });
  const health = await request.get('/api/health');
  await expect(health).toBeOK();
  expect(await health.json()).toMatchObject({ ok: true, schema_version: expect.any(Number) });
});

test('unauthenticated visitors are shown Login', async ({ page }) => {
  test.fixme(
    true,
    'Screen Login not built yet (web/src/pages/Login.tsx is a stub) — enable when it lands; routes.tsx currently shows Home without auth',
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('Secure session cookie authenticates an in-page localhost request', async ({
  page,
  bootstrap,
  newRowerSignup,
}) => {
  test.skip(!bootstrap.backendReady, 'Backend API not implemented yet');
  const signup = await newRowerSignup();
  await page.goto('/');
  const status = await page.evaluate(
    async ({ body, headers }) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await response.text();
      return response.status;
    },
    { body: signup.body, headers: csrfHeaders },
  );
  expect([200, 201]).toContain(status);
  const me = await page.evaluate(async () => {
    const response = await fetch('/api/me');
    return { status: response.status, body: await response.json() };
  });
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ email: signup.email, name: signup.name });
  const cookie = (await page.context().cookies()).find((c) => c.name === 'oyo_session');
  expect(cookie).toMatchObject({ secure: true, httpOnly: true });
});
