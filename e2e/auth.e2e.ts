import { test, expect } from './fixtures';
import { completeSignup, openSettings } from './helpers';

test('join-code signup, logout, and login', async ({ page, bootstrap, newRowerSignup }) => {
  const signup = await newRowerSignup();
  const { email, password } = signup;
  await page.goto('/signup');
  await completeSignup(page, signup, bootstrap.teamCode);
  await openSettings(page);
  await page.getByRole('button', { name: /log out|sign out/i }).click();
  await page
    .getByRole('dialog', { name: 'Log Out?' })
    .getByRole('button', { name: 'Log Out', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    process.env.E2E_MOCK === '1'
      ? await page.evaluate(async () => (await fetch('/api/me')).status)
      : (await page.request.get('/api/me')).status(),
  ).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  const me =
    process.env.E2E_MOCK === '1'
      ? await page.evaluate(async () => (await fetch('/api/me')).json())
      : await (await page.request.get('/api/me')).json();
  expect(me.email).toBe(email);
});
test('Settings appearance and change-password sheet are accessible', async ({ makeRower }) => {
  const { page } = await makeRower();
  await openSettings(page);
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Change Password', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Change Password', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Current Password', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
