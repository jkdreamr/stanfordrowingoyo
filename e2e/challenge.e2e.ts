import { test, expect } from './fixtures';
import { addDays } from '../shared/dates';
import { logEntry } from './helpers';
import { join } from 'node:path';

test.describe.configure({ mode: 'serial' });
test('staff creates a challenge, rower contributes, staff ends it', async ({
  adminPage,
  makeRower,
}, testInfo) => {
  const rower = await makeRower();
  const config = await (await rower.context.request.get('/api/config')).json();
  const title = `E2E Team Distance ${testInfo.project.name}`;
  await adminPage.goto('/admin');
  await adminPage.getByRole('link', { name: 'Challenges', exact: true }).click();
  await adminPage.getByRole('button', { name: 'New Challenge', exact: true }).click();
  const sheet = adminPage.getByRole('dialog', { name: 'New Challenge', exact: true });
  await sheet.getByLabel('Title', { exact: true }).fill(title);
  await sheet.getByLabel('Goal', { exact: true }).fill('5000');
  await sheet.getByLabel('End Date', { exact: true }).fill(addDays(config.today, 12));
  if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR)
    for (const theme of ['light', 'dark']) {
      await sheet.locator('.ui-sheet-body').evaluate((el) => {
        el.scrollTop = 0;
      });
      await adminPage.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme,
      );
      await adminPage.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `challenge-sheet-${theme}.png`),
        animations: 'disabled',
      });
    }
  await sheet.getByRole('button', { name: 'Save Challenge', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const article = adminPage.getByRole('article', { name: title, exact: true });
  await expect(article).toBeVisible();
  await logEntry(rower.page, 'erg', 'E', 10000, 'E2E Challenge Erg');
  const card = rower.page.getByRole('region', { name: 'Team Challenges' });
  await expect(card.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(card.getByRole('progressbar', { name: title })).toHaveAttribute(
    'aria-valuenow',
    /\d+/,
  );
  const progress = Number(
    await card.getByRole('progressbar', { name: title }).getAttribute('aria-valuenow'),
  );
  expect(progress).toBeGreaterThanOrEqual(10000);
  if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR)
    await rower.page.getByRole('button', { name: 'Dismiss Notification' }).click();
  if (testInfo.project.name === 'iphone-15' && process.env.E2E_SHOTS_DIR)
    for (const theme of ['light', 'dark']) {
      await rower.page.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme,
      );
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await rower.page.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `home-challenge-${theme}.png`),
        animations: 'disabled',
      });
      await adminPage.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme,
      );
      await adminPage.reload();
      await expect(article).toBeVisible();
      await adminPage.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
        theme,
      );
      await adminPage.screenshot({
        path: join(process.env.E2E_SHOTS_DIR, `challenge-list-${theme}.png`),
        animations: 'disabled',
      });
    }
  await article.getByRole('button', { name: 'End Challenge', exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'End Challenge?', exact: true })
    .getByRole('button', { name: 'End Challenge', exact: true })
    .click();
  await expect(article.getByText('Ended', { exact: true })).toBeVisible();
  await rower.page.reload();
  await expect(rower.page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await article.getByRole('button', { name: 'Delete', exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'Delete Challenge?', exact: true })
    .getByRole('button', { name: 'Delete Challenge', exact: true })
    .click();
  await expect(article).toHaveCount(0);
});
