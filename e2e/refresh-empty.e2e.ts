import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';

async function pull(target: Locator, horizontal = false) {
  await target.evaluate((element, sideways) => {
    const touch = (phase: string, x: number, y: number) => {
      const event = new Event(phase, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: phase === 'touchend' ? [] : [{ clientX: x, clientY: y }],
      });
      element.dispatchEvent(event);
    };
    touch('touchstart', 30, 100);
    if (sideways) touch('touchmove', 180, 120);
    touch('touchmove', 30, 260);
    touch('touchend', 30, 260);
  }, horizontal);
}
test('fresh rower empty states point to logging, feed and plan setup', async ({
  makeRower,
}, testInfo) => {
  const { page } = await makeRower();
  for (const path of ['/', '/me']) {
    await page.goto(path);
    const action = page.getByRole('link', { name: 'Log Workout', exact: true });
    await expect(action).toBeVisible();
    if (path === '/') {
      await action.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('home-empty.png') });
    }
    await action.click();
    await expect(page).toHaveURL(/\/log$/);
  }
  await page.goto('/plan?tab=mine');
  await page.getByRole('button', { name: 'Start Plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start Plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Blank', exact: true })).toBeVisible();
});
for (const [path, label, query] of [
  ['/', 'Home', '/api/stats/week'],
  ['/leaderboard', 'Leaderboard', '/api/leaderboard'],
  ['/notifications', 'Notifications', '/api/notifications'],
]) {
  test(`${label} pull refreshes visible data but ignores horizontal swipes and scroll`, async ({
    makeRower,
  }, testInfo) => {
    const { page } = await makeRower();
    await page.goto(path);
    const status = page.locator('.social-refresh-slot + [role="status"]');
    await expect(status).toBeAttached();
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    const target = status.locator('..');
    // A synthetic event exercises the app gesture without browser overscroll navigation.
    await page.evaluate(() => window.scrollTo(0, 0));
    const horizontalRequest = page.waitForRequest((req) => new URL(req.url()).pathname === query, {
      timeout: 300,
    });
    await pull(target, true);
    await expect(horizontalRequest).rejects.toThrow();
    await expect(status).toHaveText('');
    const response = page.waitForResponse(
      (res) => new URL(res.url()).pathname === query && res.request().method() === 'GET',
    );
    await pull(target);
    expect((await response).ok()).toBe(true);
    await expect(status).toHaveText(`${label} updated`);
    await page.screenshot({ path: testInfo.outputPath('refreshed.png') });
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = 'scroll-test-spacer';
      spacer.style.height = '2000px';
      document.body.append(spacer);
      window.scrollTo(0, 100);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const scrollRequest = page.waitForRequest((req) => new URL(req.url()).pathname === query, {
      timeout: 300,
    });
    await pull(target);
    await expect(scrollRequest).rejects.toThrow();
    await expect(status).toHaveText(`${label} updated`);
    await page.evaluate(() => document.getElementById('scroll-test-spacer')?.remove());
  });
}
