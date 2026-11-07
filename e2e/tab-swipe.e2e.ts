import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

async function swipe(page: Page, from = 290, to = 80, y = 240, endY = y) {
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from, y }],
    });
    for (let i = 1; i <= 8; i++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from + ((to - from) * i) / 8, y: y + ((endY - y) * i) / 8 }],
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.evaluate(
      async ({ from, to, y, endY }) => {
        const target = document.elementFromPoint(from, y)!;
        const send = (type: string, x: number, cy: number) => {
          const point = {
            identifier: 1,
            target,
            clientX: x,
            clientY: cy,
            pageX: x + scrollX,
            pageY: cy + scrollY,
            screenX: x,
            screenY: cy,
          };
          let touch: Touch;
          try {
            touch = new Touch(point);
          } catch {
            touch = point as unknown as Touch;
          }
          const touches = type === 'touchend' ? [] : [touch];
          let event: Event;
          try {
            event = new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              touches,
              targetTouches: touches,
              changedTouches: [touch],
            });
          } catch {
            event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperties(event, {
              touches: { value: touches },
              changedTouches: { value: [touch] },
            });
          }
          target.dispatchEvent(event);
        };
        send('touchstart', from, y);
        for (let i = 1; i <= 8; i++) {
          send('touchmove', from + ((to - from) * i) / 8, y + ((endY - y) * i) / 8);
          await new Promise(requestAnimationFrame);
        }
        send('touchend', to, endY);
      },
      { from, to, y, endY },
    );
  }
  await page.waitForTimeout(500);
}

test('mouse drag does not switch tabs', async ({ makeRower }, info) => {
  test.skip(info.project.name !== 'desktop-chrome');
  const { page } = await makeRower();
  await page.mouse.move(500, 250);
  await page.mouse.down();
  await page.mouse.move(100, 250, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);
});

test('touch tabs respect boundaries, exclusions and reduced motion', async ({
  makeRower,
}, info) => {
  test.skip(info.project.name === 'desktop-chrome');
  const rower = await makeRower();
  await seedEntry(rower, 'Swipe Morning Erg', 10000);
  const { page } = rower;
  await page.reload();
  if (info.project.name === 'iphone-15' && process.env.SWIPE_SCREENSHOTS) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        localStorage.setItem('theme', theme);
      }, theme);
      await page.reload();
      await page.getByRole('heading', { name: 'This Week', exact: true }).waitFor();
      await page.locator('.quick-presets').waitFor();
      await page.evaluate(async () => {
        const target = document.querySelector('main h1')!;
        const send = (type: string, x: number) => {
          const point = { identifier: 1, target, clientX: x, clientY: 240 };
          let touch: Touch;
          try {
            touch = new Touch(point);
          } catch {
            touch = point as unknown as Touch;
          }
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'touches', { value: [touch] });
          target.dispatchEvent(event);
        };
        send('touchstart', 290);
        send('touchmove', 180);
        await new Promise(requestAnimationFrame);
      });
      await page.screenshot({
        path: `${process.env.SWIPE_SCREENSHOTS}/${theme}-home-mid-drag.png`,
      });
      await page.locator('main').dispatchEvent('touchcancel');
      await swipe(page);
      await expect(page).toHaveURL(/\/feed$/);
      await page.screenshot({ path: `${process.env.SWIPE_SCREENSHOTS}/${theme}-feed.png` });
      await page.goto('/');
    }
  }
  const presets = page.locator('.quick-presets');
  await presets.scrollIntoViewIfNeeded();
  const chips = (await presets.boundingBox())!;
  await swipe(page, 290, 80, chips.y + chips.height / 2);
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => scrollTo(0, 0));
  await swipe(page, 80, 290);
  await expect(page).toHaveURL(/\/$/);
  await swipe(page, 10, 290);
  await expect(page).toHaveURL(/\/$/);
  await swipe(page, 180, 180, 440, 180);
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => scrollTo(0, 0));
  for (const route of ['/feed', '/leaderboard', '/me']) {
    await swipe(page);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
  await swipe(page);
  await expect(page).toHaveURL(/\/me$/);
  const plot = page.locator('[data-no-tab-swipe][role="img"]');
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!;
  await swipe(page, box.x + box.width * 0.3, box.x + box.width * 0.8, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/me$/);
  await page.evaluate(() => scrollTo(0, 0));
  for (const route of ['/leaderboard', '/feed', '/']) {
    await swipe(page, 80, 290);
    await expect(page).toHaveURL(new RegExp(route === '/' ? '/$' : `${route}$`));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await swipe(page);
  await expect(page).toHaveURL(/\/feed$/);
  await page.evaluate(() => scrollTo(0, 120));
  const saved = await page.evaluate(() => scrollY);
  await swipe(page, 290, 80, 160);
  await expect(page).toHaveURL(/\/leaderboard$/);
  await swipe(page, 80, 290, 160);
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(saved, 0);
});
