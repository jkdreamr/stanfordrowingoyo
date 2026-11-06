import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

test('join-code signup, logout, and login', async ({ page, bootstrap }, testInfo) => {
  test.fixme(
    true,
    'Screen Signup not built yet (web/src/pages/Signup.tsx is a stub) — enable when it lands; Login and Settings are also stubs',
  );
  const email = `e2e+${testInfo.project.name}-${randomUUID()}@example.com`;
  const password = 'e2e-dev-rower-password-1';
  await page.goto('/signup');
  await page.getByLabel('Name', { exact: true }).fill('E2E Signup');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel(/team.*code|join code/i).fill(bootstrap.teamCode);
  await page.getByRole('button', { name: /sign up|create account/i }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: /log out|sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/me')).status()).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(await page.request.get('/api/me')).toBeOK();
});
