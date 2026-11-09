import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry, waitForSplash } from './helpers';
import { higherLowerPuzzle } from '../worker/src/games/higherlower';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 180_000 });
const titleCase = (text: string) => text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
async function shots(page: Page, project: string, state: string) {
  if (!['iphone-15', 'pixel-7', 'desktop-chrome'].includes(project)) return;
  const dir = join(process.env.HOME!, 'hl-shots');
  await mkdir(dir, { recursive: true });
  for (const theme of project === 'desktop-chrome' ? ['light'] : ['light', 'dark']) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle('dark', dark),
      theme === 'dark',
    );
    await page.screenshot({
      path: join(dir, `${project}-${theme}-${state}.png`),
      scale: 'css',
      animations: 'disabled',
    });
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}
test('locked, perfect, resumed and losing attempts, accessible controls and sharing', async ({
  makeRower,
}, testInfo) => {
  const project = testInfo.project.name;
  const offset = ['desktop-chrome', 'iphone-15', 'pixel-7'].indexOf(project);
  const date = `2026-11-${String(16 + offset).padStart(2, '0')}`;
  const rower = await makeRower();
  const { page, context } = rower;
  await context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': date + 'T18:00:00Z',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => sessionStorage.setItem('hl-share', text) },
    });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/games/higherlower');
  await waitForSplash(page);
  await expect(page.getByRole('link', { name: 'Log Workout' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Next Item' })).toHaveCount(0);
  await seedEntry(rower, 'Higher or Lower Unlock');
  await page.reload();
  await waitForSplash(page);
  const { category, chain } = higherLowerPuzzle(date);
  for (let step = 0; step < 20; step++) {
    const higher = chain[step + 1].value > chain[step].value;
    const label = titleCase(higher ? category.higherLabel : category.lowerLabel);
    const button = page.getByRole('button', {
      name: `${label} Than ${chain[step].name}`,
      exact: true,
    });
    await expect(button).toBeEnabled();
    if (step === 2) {
      await page.reload();
      await waitForSplash(page);
      await expect(button).toBeEnabled();
      await expect(page.getByRole('region', { name: 'Current Item' })).toContainText(
        chain[step].name,
      );
      await shots(page, project, 'mid-game');
      if (['iphone-15', 'pixel-7'].includes(project)) {
        const viewport = page.viewportSize()!;
        for (const [name, width, height] of [
          ['narrow', 320, 640],
          ['landscape', 740, 360],
        ] as const) {
          await page.setViewportSize({ width, height });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await shots(page, project, `${name}-mid-game`);
        }
        await page.setViewportSize(viewport);
      }
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    }
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/games/higherlower/guess') &&
        response.request().method() === 'POST',
    );
    await button.click();
    await (await response).finished();
    if (step === 2) {
      await page.clock.runFor(1000);
      await expect(page.locator('.hl-correct')).toBeVisible();
      await shots(page, project, 'reveal');
      await page.clock.resume();
    }
  }
  const result = page.getByRole('region', { name: 'Your Result' });
  await expect(result).toContainText('20 / 20');
  await expect(result).toContainText('Perfect Run');
  await shots(page, project, 'result');
  await result.getByRole('button', { name: 'Share', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('hl-share')))
    .toContain('20 / 20');
  expect(await page.evaluate(() => sessionStorage.getItem('hl-share'))).not.toContain(
    chain[0].name,
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your Result' })).toContainText('20 / 20');

  const loser = await makeRower();
  const lossDate = `2026-11-${String(23 + offset).padStart(2, '0')}`;
  await loser.context.setExtraHTTPHeaders({
    ...testInfo.project.use.extraHTTPHeaders,
    'X-OYO-Test-Now': lossDate + 'T18:00:00Z',
  });
  await seedEntry(loser, 'Higher or Lower Loss');
  await loser.page.emulateMedia({ reducedMotion: 'reduce' });
  await loser.page.goto('/games/higherlower');
  await waitForSplash(loser.page);
  const losing = higherLowerPuzzle(lossDate);
  const wrong =
    losing.chain[1].value > losing.chain[0].value
      ? losing.category.lowerLabel
      : losing.category.higherLabel;
  await loser.page
    .getByRole('button', { name: `${titleCase(wrong)} Than ${losing.chain[0].name}`, exact: true })
    .click();
  await expect(loser.page.getByRole('region', { name: 'Your Result' })).toContainText('0 / 20');
  await expect(loser.page.getByRole('region', { name: 'Your Result' })).toContainText(
    `Missed on ${losing.chain[1].name}`,
  );
  await expect(loser.page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
});
