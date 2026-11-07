import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { completeSignup, openSettings } from './helpers';
import { csrfHeaders } from './api';

async function watchPasswordRequests(page: Page) {
  await page.evaluate(() => {
    sessionStorage.setItem('passwordRequests', '[]');
    const original = window.fetch;
    window.fetch = (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin)
        .pathname;
      if (path.startsWith('/api/me/password')) {
        const calls = JSON.parse(sessionStorage.getItem('passwordRequests')!);
        calls.push({ path, body: JSON.parse(String(init?.body)) });
        sessionStorage.setItem('passwordRequests', JSON.stringify(calls));
      }
      return original(input, init);
    };
  });
}
async function logOut(page: Page) {
  if (new URL(page.url()).pathname !== '/settings') await openSettings(page);
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Log Out?' })
    .getByRole('button', { name: 'Log Out', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
}
async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
}

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
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
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
test('Settings verifies then changes the password, with an inline current-password error', async ({
  makeRower,
}) => {
  const { page, user, password } = await makeRower();
  await watchPasswordRequests(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Change Password', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Change Password', exact: true });
  await dialog.getByLabel('Current Password', { exact: true }).fill('incorrect-password');
  await dialog.getByLabel('New Password', { exact: true }).fill('replacement-password');
  await dialog.getByLabel('Confirm Password', { exact: true }).fill('replacement-password');
  await dialog.getByRole('button', { name: 'Change Password', exact: true }).click();
  await expect(dialog.locator('#current-password-help')).toHaveText(
    'Current password is incorrect.',
  );
  await expect(dialog.getByLabel('New Password', { exact: true })).toHaveValue(
    'replacement-password',
  );
  await dialog.getByLabel('Current Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Change Password', exact: true }).click();
  await expect(page.getByText('Password changed', { exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('passwordRequests')!));
  expect(calls.map((call: { path: string }) => call.path)).toEqual([
    '/api/me/password/verify',
    '/api/me/password/verify',
    '/api/me/password',
  ]);
  expect(calls[1].body).toEqual({ current_password: password });
  expect(calls[2].body).toEqual({
    new_password: 'replacement-password',
    reauth_token: expect.any(String),
  });
  await logOut(page);
  await logIn(page, user.email, password);
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await logIn(page, user.email, 'replacement-password');
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
});
test('temporary-password login forces a new password without current-password verification', async ({
  makeRower,
  adminPage,
}) => {
  const { page, user } = await makeRower();
  await logOut(page);
  let temporary_password: string;
  if (process.env.E2E_MOCK === '1') {
    temporary_password = await page.evaluate(async (id) => {
      const post = async (path: string, body?: unknown) =>
        fetch(`/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      const login = await post('/auth/login', {
        email: 'joskoo@stanford.edu',
        password: 'password',
      });
      if (!login.ok) throw new Error('Mock admin login failed');
      const response = await post(`/admin/users/${id}/reset-password`);
      if (!response.ok) throw new Error('Mock password reset failed');
      const result = await response.json();
      await post('/auth/logout');
      return result.temporary_password;
    }, user.id);
  } else {
    const response = await adminPage.request.post(`/api/admin/users/${user.id}/reset-password`, {
      headers: csrfHeaders,
    });
    await expect(response).toBeOK();
    ({ temporary_password } = await response.json());
  }
  await watchPasswordRequests(page);
  await logIn(page, user.email, temporary_password);
  await expect(page).toHaveURL(/\/change-password/);
  await expect(
    page.getByRole('heading', { name: 'Change Your Password', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Current Password', { exact: true })).toHaveCount(0);
  await page.getByLabel('New Password', { exact: true }).fill('permanent-password');
  await page.getByLabel('Confirm Password', { exact: true }).fill('permanent-password');
  await page.getByRole('button', { name: 'Change Password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('passwordRequests')!)),
  ).toEqual([{ path: '/api/me/password', body: { new_password: 'permanent-password' } }]);
  await logOut(page);
  await logIn(page, user.email, 'permanent-password');
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
});
