import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry, waitForSplash } from './helpers';

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
  await expect
    .poll(() =>
      page.locator('main').evaluate((main) => ({
        animations: main.getAnimations().length,
        opacity: main.style.opacity,
        transform: main.style.transform,
        willChange: main.style.willChange,
      })),
    )
    .toEqual({ animations: 0, opacity: '', transform: '', willChange: '' });
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
  test.setTimeout(60_000);
  const rower = await makeRower();
  await seedEntry(rower, 'Swipe Morning Erg', 10000);
  const { page } = rower;
  await page.reload();
  await waitForSplash(page);
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

async function sampleTransition(
  page: Page,
  destination: '/feed' | '/leaderboard',
  action: () => Promise<void>,
) {
  const sampling = page.evaluate(async (destination) => {
    const state = window as typeof window & { tabSampleDoneAt: number | null };
    state.tabSampleDoneAt = null;
    const nav = document.querySelector<HTMLElement>('nav.shell-tabbar')!;
    const baseline = nav.getBoundingClientRect();
    const violations: string[] = [];
    const frames: {
      path: string;
      heading: string;
      opacity: number;
      transform: string;
      y: number;
      text: boolean;
    }[] = [];
    let transitions = 0;
    const original = document.startViewTransition;
    if (original)
      document.startViewTransition = function (...args) {
        transitions++;
        return original.apply(this, args);
      };
    const deadline = performance.now() + 10_000;
    let settledAt: number | null = null;
    try {
      do {
        const rect = nav.getBoundingClientRect();
        if (
          ['x', 'y', 'width', 'height'].some(
            (key) =>
              Math.abs(
                (rect[key as keyof DOMRect] as number) - (baseline[key as keyof DOMRect] as number),
              ) > 0.1,
          )
        )
          violations.push('tab bar moved');
        for (const label of ['Home', 'Feed', 'Leaderboard', 'Me']) {
          const nodes = Array.from(nav.querySelectorAll('a > span')).filter(
            (node) => node.textContent === label && node.getClientRects().length > 0,
          );
          if (nodes.length !== 1) violations.push(`${label}: ${nodes.length} labels`);
          for (const node of nodes) {
            const box = node.getBoundingClientRect();
            if (
              !nav.contains(
                document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
              )
            )
              violations.push(`${label}: obscured`);
          }
        }
        const log = nav.querySelector('.shell-log-tab')!.getBoundingClientRect();
        if (Math.abs(log.x + log.width / 2 - rect.x - rect.width / 2) > 1)
          violations.push('Log is not centered');
        for (const element of Array.from(document.querySelectorAll('*'))) {
          const name = getComputedStyle(element).getPropertyValue('view-transition-name');
          if (name && name !== 'none') violations.push(`snapshot name: ${name}`);
        }
        const main = document.querySelector('main')!;
        const style = getComputedStyle(main);
        const pin = main.querySelector<HTMLElement>('.leaderboard-pin');
        const ownRow = main.querySelector<HTMLElement>('[data-rank-id] a[href="/me"]');
        if (pin && ownRow) {
          const row = ownRow.getBoundingClientRect();
          const header = main.querySelector('.ui-page-nav')?.getBoundingClientRect().bottom ?? 0;
          const pinStyle = getComputedStyle(pin);
          if (pinStyle.visibility === 'visible' && Number(pinStyle.opacity) !== 1)
            violations.push('pin crossfades over ranking text');
          if (
            row.bottom > header &&
            row.top < rect.top &&
            row.right > 0 &&
            row.left < innerWidth &&
            pinStyle.visibility === 'visible' &&
            Number(pinStyle.opacity) > 0
          )
            violations.push('pin visible over an on-screen own row');
        }
        if (document.documentElement.hasAttribute('data-entered')) {
          for (const element of Array.from(
            main.querySelectorAll(
              '.podium-card, .drive-col, .drive-bar, .sc-draw, .sc-fill-in, .sc-end',
            ),
          ))
            if (getComputedStyle(element).animationName !== 'none')
              violations.push('replayed child entrance');
        }
        frames.push({
          path: location.pathname,
          heading: main.querySelector('h1')?.textContent ?? '',
          opacity: Number(style.opacity),
          transform: style.transform,
          y: scrollY,
          text: !!main.textContent?.trim(),
        });
        if (
          state.tabSampleDoneAt !== null &&
          location.pathname === destination &&
          main.querySelector('h1')?.textContent ===
            (destination === '/feed' ? 'Feed' : 'Leaderboard') &&
          main.getAnimations().length === 0 &&
          !main.style.opacity &&
          !main.style.transform &&
          !main.style.willChange
        )
          settledAt ??= performance.now();
        else settledAt = null;
        await new Promise(requestAnimationFrame);
      } while (
        performance.now() < deadline &&
        (settledAt === null || performance.now() < settledAt + 350)
      );
    } finally {
      if (original) document.startViewTransition = original;
    }
    return {
      frames,
      violations: [...new Set(violations)],
      transitions,
      settled: settledAt !== null && performance.now() >= settledAt + 350,
    };
  }, destination);
  try {
    await action();
  } finally {
    await page.evaluate(() => {
      (window as typeof window & { tabSampleDoneAt: number | null }).tabSampleDoneAt =
        performance.now();
    });
  }
  const result = await sampling;
  expect(result.settled).toBe(true);
  expect(result.transitions).toBe(0);
  expect(result.violations).toEqual([]);
  expect(result.frames.length).toBeGreaterThan(3);
  return result.frames;
}

async function tapTab(page: Page, name: string) {
  await page.locator('.shell-tabbar').getByRole('link', { name, exact: true }).click();
}

function expectTapArrival(
  frames: { heading: string; opacity: number; text: boolean }[],
  oldHeading: string,
) {
  expect(frames.every((frame) => frame.text)).toBe(true);
  expect(
    frames.filter((frame) => frame.heading === oldHeading).every((frame) => frame.opacity > 0),
  ).toBe(true);
  const arrival = frames.filter((frame) => frame.heading !== oldHeading);
  expect(arrival.length).toBeGreaterThan(0);
  expect(
    arrival.every(
      (frame, index) => index === 0 || frame.opacity >= arrival[index - 1].opacity - 0.001,
    ),
  ).toBe(true);
}

test('tab taps and swipe commits keep live navigation stable and restore cached scroll before arrival', async ({
  makeRower,
}, info) => {
  test.skip(info.project.name === 'desktop-chrome');
  test.setTimeout(60_000);
  const rower = await makeRower();
  for (let i = 0; i < 5; i++) await seedEntry(rower, `Transition Erg ${i}`);
  for (let i = 0; i < 3; i++) {
    const rival = await makeRower();
    await seedEntry(rival, `Transition rival ${i}`, 200000);
  }
  const { page } = rower;
  await page.reload();
  await waitForSplash(page);
  await tapTab(page, 'Leaderboard');
  await page.getByRole('heading', { name: 'Leaderboard', exact: true }).waitFor();
  await expect(page.locator('.leaderboard-pin')).toHaveCount(1);
  await tapTab(page, 'Feed');
  await page.getByRole('article').first().waitFor();
  await expect
    .poll(() => page.locator('main').evaluate((main) => main.getAnimations().length))
    .toBe(0);
  await page.evaluate(() => scrollTo(0, 160));
  const saved = await page.evaluate(() => scrollY);
  expect(saved).toBeGreaterThan(100);
  const out = await sampleTransition(page, '/leaderboard', () => tapTab(page, 'Leaderboard'));
  expectTapArrival(out, 'Feed');
  expect(out.some((frame) => frame.heading === 'Leaderboard')).toBe(true);
  const back = await sampleTransition(page, '/feed', () => tapTab(page, 'Feed'));
  expectTapArrival(back, 'Leaderboard');
  const arrivals = back.filter((frame) => frame.path === '/feed' && frame.heading === 'Feed');
  expect(arrivals.length).toBeGreaterThan(0);
  expect(arrivals.every((frame) => Math.abs(frame.y - saved) <= 1)).toBe(true);
  const swipeOut = await sampleTransition(page, '/leaderboard', () => swipe(page, 290, 80, 180));
  expect(swipeOut.some((frame) => frame.heading === 'Leaderboard')).toBe(true);
  expect(
    swipeOut.filter((frame) => frame.path === '/leaderboard' && frame.opacity <= 0.001).length,
  ).toBeLessThanOrEqual(1);
  expect(
    swipeOut.filter(
      (frame) => frame.path === '/leaderboard' && frame.heading === 'Feed' && frame.opacity > 0.05,
    ),
  ).toEqual([]);
  const swipeBack = await sampleTransition(page, '/feed', () => swipe(page, 80, 290, 180));
  expect(
    swipeBack.filter(
      (frame) => frame.path === '/feed' && frame.heading === 'Leaderboard' && frame.opacity > 0.05,
    ),
  ).toEqual([]);
  const swipeArrivals = swipeBack.filter(
    (frame) => frame.path === '/feed' && frame.heading === 'Feed',
  );
  expect(swipeArrivals.length).toBeGreaterThan(0);
  expect(swipeArrivals.every((frame) => Math.abs(frame.y - saved) <= 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(saved, 0);
});

test('reduced motion, active tabs and rapid retargeting leave no stale main styles', async ({
  makeRower,
}, info) => {
  test.skip(info.project.name === 'desktop-chrome');
  const { page } = await makeRower();
  await waitForSplash(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frames = await sampleTransition(page, '/feed', () => tapTab(page, 'Feed'));
  expect(frames.every((frame) => frame.transform === 'none')).toBe(true);
  const swipeFrames = await sampleTransition(page, '/leaderboard', () => swipe(page, 290, 80, 180));
  expect(swipeFrames.every((frame) => frame.transform === 'none')).toBe(true);
  await expect(page).toHaveURL(/\/leaderboard$/);
  await tapTab(page, 'Leaderboard');
  expect(await page.locator('main').evaluate((main) => main.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await sampleTransition(page, '/feed', async () => {
    await tapTab(page, 'Me');
    await tapTab(page, 'Home');
    await tapTab(page, 'Feed');
  });
  await expect(page).toHaveURL(/\/feed$/);
  expect(
    await page.locator('main').evaluate((main) => ({
      transform: main.style.transform,
      opacity: main.style.opacity,
      willChange: main.style.willChange,
      animations: main.getAnimations().length,
    })),
  ).toEqual({ transform: '', opacity: '', willChange: '', animations: 0 });
});
