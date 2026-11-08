import { test, expect } from './fixtures';
import { waitForSplash } from './helpers';

test('ambient water stays behind cards and respects reduced motion', async ({ makeRower }) => {
  const { page } = await makeRower();
  await waitForSplash(page);
  const layer = page.locator('.ambient-water');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveAttribute('data-ready', 'true');
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      layer.evaluate(
        (element) =>
          document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return target instanceof Element && (target === element || element.contains(target));
          }).length,
      ),
    )
    .toBe(0);
});
