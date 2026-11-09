import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

async function verifyExit(page: Page, dialog: Locator, opener: Locator, label: string) {
  await expect
    .poll(() =>
      dialog.evaluate((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === 'running' || animation.pending),
      ),
    )
    .toBe(false);
  await page.screenshot({ path: `/home/ubuntu/sheet-exit-${label}-open.png` });
  const target = await dialog.evaluate(async (element) => {
    const original = element.animate;
    const started = new Promise<Animation>((resolve) => {
      element.animate = (...args) => {
        const animation = original.apply(element, args);
        animation.pause();
        if (!(animation.effect instanceof KeyframeEffect)) throw new Error('Missing dialog effect');
        animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
        resolve(animation);
        return animation;
      };
    });
    element.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
    try {
      const animation = await started;
      return (animation.effect as KeyframeEffect).getKeyframes().at(-1)?.transform;
    } finally {
      element.animate = original;
    }
  });
  const wide = await page.evaluate(() => matchMedia('(min-width: 1024px)').matches);
  expect(target).toBe(wide ? 'scale(0.96)' : 'translateY(100%)');
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog).toHaveAttribute('data-closing', 'true');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.screenshot({ path: `/home/ubuntu/sheet-exit-${label}-mid.png` });
  await dialog.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.play();
  });
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
}

test('Kudos and conditionally mounted actions retain their exit and restore focus', async ({
  makeRower,
}, testInfo) => {
  test.setTimeout(60_000);
  const a = await makeRower();
  const b = await makeRower();
  const errors: string[] = [];
  a.page.on('pageerror', (error) => errors.push(error.message));
  const title = `Sheet Exit ${a.user.id}`;
  const entry = await seedEntry(a, title);
  await b.page.goto(`/entries/${entry.id}`);
  await b.page.getByRole('button', { name: 'Kudos', exact: true }).click();
  await expect(b.page.getByRole('button', { name: 'View 1 Kudo', exact: true })).toBeVisible();
  await a.page.goto(`/entries/${entry.id}`);
  const opener = a.page.getByRole('button', { name: 'View 1 Kudo', exact: true });
  await opener.click();
  const kudos = a.page.getByRole('dialog', { name: 'Kudos', exact: true });
  await expect(kudos.getByRole('link', { name: b.user.name, exact: true })).toBeVisible();
  await verifyExit(a.page, kudos, opener, `${testInfo.project.name}-kudos`);
  await opener.click();
  await expect(kudos).toBeVisible();
  await a.page.keyboard.press('Escape');
  await expect(kudos).not.toBeVisible();
  await expect(opener).toBeFocused();
  await a.page.emulateMedia({ reducedMotion: 'reduce' });
  await opener.click();
  const reducedDialog = await kudos.elementHandle();
  await kudos.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await reducedDialog!.evaluate((element) => (element as HTMLDialogElement).open)).toBe(
    false,
  );
  await expect(opener).toBeFocused();
  await a.page.emulateMedia({ reducedMotion: 'no-preference' });
  await a.page.goto(`/entries/${entry.id}`);
  const more = a.page.getByRole('button', { name: 'More', exact: true });
  await more.click();
  const actions = a.page.getByRole('dialog', { name: 'Workout Actions', exact: true });
  await verifyExit(a.page, actions, more, `${testInfo.project.name}-actions`);
  await more.click();
  await expect(actions).toBeVisible();
  await actions.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  const confirm = a.page.getByRole('dialog', { name: 'Delete Workout', exact: true });
  await expect(confirm).toBeVisible();
  await expect(actions).not.toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await expect(more).toBeFocused();
  expect(await a.page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(errors).toEqual([]);
});
