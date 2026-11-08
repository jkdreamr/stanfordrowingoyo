import { test, expect } from './fixtures';
import { waitForSplash } from './helpers';

test('ambient water stays behind cards and respects reduced motion', async ({ makeRower }) => {
  const { page } = await makeRower();
  await waitForSplash(page);
  const layer = page.locator('.ambient-water');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveAttribute('data-ready', 'true');
  const currents = await layer.locator('.ambient-water__caustic').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const animation = element.getAnimations()[0];
      const frames = (animation.effect as KeyframeEffect).getKeyframes();
      const end = new DOMMatrix(String(frames.at(-1)!.transform));
      return {
        tile: style.backgroundSize.split(' ').map(parseFloat),
        distance: [Math.abs(end.m41), Math.abs(end.m42)],
        repeat: style.backgroundRepeat,
        direction: animation.effect!.getTiming().direction,
        easing: animation.effect!.getTiming().easing,
      };
    }),
  );
  for (const current of currents) {
    expect(current.distance).toEqual(current.tile);
    expect(current.repeat).toBe('repeat');
    expect(current.direction).toBe('normal');
    expect(current.easing).toBe('linear');
  }
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
