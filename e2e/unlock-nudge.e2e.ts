import { join } from 'node:path';
import { test, expect } from './fixtures';
import { waitForSplash } from './helpers';

test('locked Daily Games opens Log and unlocks immediately after saving', async ({
  makeRower,
}, info) => {
  const { page } = await makeRower();
  await waitForSplash(page);
  const shots = async (name: string) => {
    if (!process.env.E2E_SHOTS_DIR) return;
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        theme === 'dark',
      );
      await page.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `${name}-${info.project.name}-${theme}.png`),
        animations: 'disabled',
      });
    }
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
  };
  const title = page.getByRole('heading', { name: "Log today's OYO to unlock", exact: true });
  await expect(title).toBeVisible();
  await title.scrollIntoViewIfNeeded();
  await shots('locked-home');
  await page.getByRole('link', { name: 'Daily Games', exact: true }).click();
  await expect(title).toBeVisible();
  await shots('locked-hub');
  await page.getByRole('link', { name: 'Log Workout', exact: true }).click();
  await expect(page).toHaveURL(/\/log$/);
  await page.getByRole('textbox', { name: 'Meters', exact: true }).fill('6000');
  await page.getByLabel('Title', { exact: true }).fill('Evening OYO');
  await page.getByRole('button', { name: /save|log workout/i }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await expect(title).toHaveCount(0);
  await expect(page.locator('.save-celebration')).toHaveCount(0);
  const dismiss = page.getByRole('button', { name: 'Dismiss Notification', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  const games = page.getByRole('link', { name: /Daily Games/ });
  await expect(games).toContainText("Play Today's Games");
  await games.scrollIntoViewIfNeeded();
  await shots('unlocked-home');
});
