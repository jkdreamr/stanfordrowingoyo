import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

async function checkTargets(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading', exact: true })).toHaveCount(0);
  const failures = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea'),
    ).flatMap((control) => {
      if (control.closest('[inert], [aria-hidden="true"]') || control.hidden) return [];
      // Only inline text links inside prose are exempt from standalone target sizes.
      if (control.matches('p a, .ui-prose a') && getComputedStyle(control).display === 'inline')
        return [];
      // Native visually-hidden radios use their enclosing label as the hit target.
      const target = control.matches('input[type="radio"], input[type="checkbox"]')
        ? (control.closest('label') ?? control)
        : control;
      const box = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (!box.width || !box.height || box.bottom < 0 || style.visibility === 'hidden') return [];
      return box.width < 43.9 || box.height < 43.9
        ? [
            `${control.tagName} ${control.getAttribute('aria-label') ?? control.textContent?.trim() ?? ''}: ${box.width}×${box.height}`,
          ]
        : [];
    });
  });
  expect(failures, page.url()).toEqual([]);
}

test('main screens and profile sheet have 44px targets', async ({ makeRower }, testInfo) => {
  const rower = await makeRower();
  const entry = await seedEntry(rower, 'Accessible Workout');
  const { page } = rower;
  for (const route of [
    '/',
    '/feed',
    `/entries/${entry.id}`,
    '/leaderboard',
    '/me',
    '/team',
    '/plan',
    '/notifications',
    '/announcements',
    '/settings',
    '/me/target',
    '/log',
    '/me/edit',
  ]) {
    await page.goto(route);
    await checkTargets(page);
  }
  await page.getByRole('button', { name: 'Change Profile Photo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile Photo', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await checkTargets(page);
  await page.screenshot({ path: testInfo.outputPath('profile-sheet.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change Profile Photo' })).toBeFocused();
});

test('staff screens have 44px targets', async ({ adminPage: page }, testInfo) => {
  for (const route of [
    '/admin',
    '/admin/roster',
    '/admin/compliance',
    '/admin/settings',
    '/admin/presets',
    '/admin/plan',
    '/admin/announcements',
    '/admin/export',
    '/admin/audit',
  ]) {
    await page.goto(route);
    await checkTargets(page);
  }
  await page.screenshot({ path: testInfo.outputPath('admin-audit.png') });
});

test('authentication screens have 44px targets', async ({ page }) => {
  for (const route of ['/login', '/signup']) {
    await page.goto(route);
    await checkTargets(page);
  }
});
