import { test, expect } from './fixtures';
import { join } from 'node:path';

test('erg tests record PRs, update bests, edit, delete and stay team-visible read-only', async ({
  makeRower,
}, testInfo) => {
  const rower = await makeRower(),
    teammate = await makeRower();
  const { page } = rower;
  const config = await (await rower.context.request.get('/api/config')).json();
  await page.goto('/me');
  const history = page.getByRole('region', { name: 'Erg Tests' });
  await expect(history.getByText('No Tests Yet')).toBeVisible();
  async function add(time: string, date: string) {
    await history.getByRole('button', { name: 'Add Test' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add Test' });
    await sheet.getByLabel('Date', { exact: true }).fill(date);
    await sheet.getByLabel('Time', { exact: true }).fill(time);
    await sheet.getByRole('button', { name: 'Save Test' }).click();
    await expect(sheet).not.toBeVisible();
  }
  const previous = new Date(config.today + 'T12:00:00Z');
  previous.setUTCDate(previous.getUTCDate() - 7);
  const date = previous.toISOString().slice(0, 10);
  await add('6:40.0', date);
  await add('6:20.0', config.today);
  await expect(history.getByText('PR', { exact: true })).toHaveCount(2);
  const best = history.locator('dl > div').filter({ hasText: 'Best 2k' });
  await expect(best).toContainText('1:35.0');
  await expect(best).toContainText('6:20.0');
  await expect(history.getByRole('figure', { name: '2k PR Timeline' })).toBeVisible();
  if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR) {
    await page.getByRole('button', { name: 'Dismiss Notification' }).click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        localStorage.setItem('theme', value);
        document.documentElement.classList.toggle('dark', value === 'dark');
      }, theme);
      await history.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `erg-history-${theme}.png`),
        animations: 'disabled',
        fullPage: true,
      });
      await history.getByRole('button', { name: 'Add Test' }).click();
      const sheet = page.getByRole('dialog', { name: 'Add Test' });
      await sheet.getByLabel('Time', { exact: true }).fill('6:15.0');
      await expect(sheet.getByRole('button', { name: 'Save Test' })).toBeInViewport();
      await page.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `erg-sheet-${theme}.png`),
        animations: 'disabled',
      });
      await sheet.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(sheet).not.toBeVisible();
    }
  }
  await history.getByRole('button', { name: `Edit 2k Test ${config.today}` }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Test' });
  await edit.getByRole('radio', { name: 'Split', exact: true }).click();
  await edit.getByLabel('Split', { exact: true }).fill('1:30.0');
  await expect(edit.locator('output')).toHaveText('6:00.0');
  await edit.getByRole('button', { name: 'Save Test' }).click();
  await expect(edit).not.toBeVisible();
  await expect(best).toContainText('1:30.0');
  await expect(best).toContainText('6:00.0');
  await teammate.page.goto('/users/' + rower.user.id);
  const publicHistory = teammate.page.getByRole('region', { name: 'Erg Tests' });
  await expect(publicHistory.getByText('PR', { exact: true })).toHaveCount(2);
  await expect(publicHistory.getByRole('button', { name: 'Add Test' })).toHaveCount(0);
  await expect(publicHistory.getByRole('button', { name: /Edit 2k Test/ })).toHaveCount(0);
  await history.getByRole('button', { name: `Edit 2k Test ${config.today}` }).click();
  await edit.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete Test?' })
    .getByRole('button', { name: 'Delete Test', exact: true })
    .click();
  await expect(history.getByText('PR', { exact: true })).toHaveCount(1);
  await expect(best).toContainText('1:40.0');
  await expect(best).toContainText('6:40.0');
});
