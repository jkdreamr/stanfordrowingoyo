import { test, expect } from './fixtures';

test('join-code signup, logout, and login', async ({ page, bootstrap, newRowerSignup }) => {
  test.fixme(
    true,
    'Screen Signup not built yet (web/src/pages/Signup.tsx is a stub) — enable when it lands; Login and Settings are also stubs',
  );
  const { email, password, name } = await newRowerSignup();
  await page.goto('/signup');
  await page.getByLabel(/team.*code|join code/i).fill(bootstrap.teamCode);
  await page.getByRole('button', { name: /continue|next/i }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: /continue|next/i }).click();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await page.getByRole('button', { name: /continue|next/i }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
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
