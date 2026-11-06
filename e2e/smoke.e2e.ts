import { test, expect } from '@playwright/test';

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
