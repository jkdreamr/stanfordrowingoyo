import { test, expect } from './fixtures';
import { waitForSplash } from './helpers';

test('procedural water changes pixels behind content and freezes under reduced motion', async ({
  makeRower,
}) => {
  const { page } = await makeRower();
  await waitForSplash(page);
  const layer = page.locator('.ambient-water');
  const canvas = layer.locator('canvas');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('width', '64');
  const hero = page.getByRole('link', { name: 'Weekly Progress. Change Your Target', exact: true });
  const box = await hero.boundingBox();
  expect(box).not.toBeNull();
  expect(
    await page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && !hit.closest('.ambient-water') && !!hit.closest('a');
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    ),
  ).toBe(true);
  const first = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(2000);
  expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(layer).toHaveAttribute('data-paused', 'true');
  const frozen = await canvas.getAttribute('data-frame');
  await page.waitForTimeout(500);
  await expect(canvas).toHaveAttribute('data-frame', frozen!);
  await page.emulateMedia({ contrast: 'more' });
  await expect(layer).toBeHidden();
});
