import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

test.use({ serviceWorkers: 'block' });

async function touch(plot: Locator, type: string, fraction: number, dy = 0) {
  return plot.evaluate(
    (node, { type, fraction, dy }) => {
      const box = node.getBoundingClientRect();
      const point = {
        identifier: 1,
        target: node,
        clientX: box.left + box.width * fraction,
        clientY: box.top + box.height / 2 + dy,
      };
      const touches = type === 'touchend' || type === 'touchcancel' ? [] : [point];
      const event = document.createEvent('TouchEvent');
      event.initEvent(type, true, true);
      Object.defineProperties(event, {
        touches: { value: touches },
        targetTouches: { value: touches },
        changedTouches: { value: [point] },
      });
      return !node.dispatchEvent(event);
    },
    { type, fraction, dy },
  );
}

async function scrub(page: Page, plot: Locator) {
  await plot.evaluate((node) => {
    node.closest('section')!.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -80);
  });
  await touch(plot, 'touchstart', 0);
  await expect(plot.locator('span')).toHaveCount(3);
  const first = await plot.locator('span').last().textContent();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(await touch(plot, 'touchmove', 0.5, 30)).toBe(true);
  await expect(plot.locator('span').last()).not.toHaveText(first!);
  const middle = await plot.locator('span').last().textContent();
  expect(await touch(plot, 'touchmove', 1, -30)).toBe(true);
  await expect(plot.locator('span').last()).not.toHaveText(middle!);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
}

test('hold and drag scrubs Me and teammate mileage without claiming a quick swipe', async ({
  makeRower,
  adminPage,
  isMobile,
}, testInfo) => {
  const rower = await makeRower();
  await seedEntry(rower, 'Touch chart erg', 10000);
  for (const page of [rower.page, adminPage]) {
    await page.goto(page === rower.page ? '/me' : `/users/${rower.user.id}`);
    const region = page.getByRole('region', { name: 'Season Mileage' });
    const plot = region.getByRole('img', { name: /^Cumulative E-meters/ });
    await expect(plot).toBeVisible();
    if (isMobile) {
      await scrub(page, plot);
      if (process.env.GRAPH_SHOTS && page === rower.page) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(
            (theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
            theme,
          );
          await page.screenshot({
            path: `${process.env.GRAPH_SHOTS}/scrub-${testInfo.project.name}-${theme}.png`,
            animations: 'disabled',
          });
        }
      }
      await touch(plot, 'touchend', 1);
      await expect(plot.locator('span')).toHaveCount(0);
      await touch(plot, 'touchstart', 0.5);
      expect(await touch(plot, 'touchmove', 0.5, 50)).toBe(false);
      await touch(plot, 'touchend', 0.5, 50);
      await expect(plot.locator('span')).toHaveCount(0);
      await page.evaluate(() => window.scrollBy(0, 100));
      if (testInfo.project.name === 'pixel-7' && page === rower.page) {
        await plot.scrollIntoViewIfNeeded();
        const box = (await plot.boundingBox())!;
        const session = await page.context().newCDPSession(page);
        const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
          session.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
          });
        const before = await page.evaluate(() => window.scrollY);
        await send('touchStart', box.x + 10, box.y + 100);
        await expect(plot.locator('span')).toHaveCount(3);
        const date = await plot.locator('span').last().textContent();
        await send('touchMove', box.x + box.width - 10, box.y + 130);
        await expect(plot.locator('span').last()).not.toHaveText(date!);
        expect(await page.evaluate(() => window.scrollY)).toBe(before);
        await send('touchEnd', 0, 0);
        await expect(plot.locator('span')).toHaveCount(0);
        await send('touchStart', box.x + 30, box.y + 160);
        for (const offset of [130, 100, 70, 40, 10])
          await send('touchMove', box.x + 30, box.y + offset);
        await send('touchEnd', 0, 0);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
        await expect(plot.locator('span')).toHaveCount(0);
        await session.detach();
      }
    } else {
      await plot.scrollIntoViewIfNeeded();
      const box = (await plot.boundingBox())!;
      await page.mouse.move(box.x, box.y + 100);
      await expect(plot.locator('span')).toHaveCount(3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width, box.y + 100);
      await page.mouse.up();
      await expect(plot.locator('span')).toHaveCount(0);
    }
  }
});

test('Olympic podium positions, heights, profile links and fourth place persist across metrics', async ({
  makeRower,
  page,
}, testInfo) => {
  const rower = await makeRower();
  await page.context().addCookies(await rower.context.cookies());
  await page.route('**/api/leaderboard?*', (route) =>
    route.fulfill({
      json: [
        { ...rower.user, id: 'first', name: 'Jordan Lee' },
        rower.user,
        { ...rower.user, id: 'third', name: 'Sam Rivera' },
        { ...rower.user, id: 'fourth', name: 'Alex Chen' },
      ].map((user, i) => ({
        user,
        rank: i + 1,
        total_m: 40000 - i * 10000,
        target_m: 50000,
        percent: 80 - i * 20,
        streak: 0,
      })),
    }),
  );
  await page.goto('/leaderboard');
  for (const metric of ['% of Target', 'Meters', 'Season']) {
    await page.getByRole('radio', { name: metric, exact: true }).click();
    const podium = page.getByRole('list', { name: 'Top Three' });
    const spots = podium.getByRole('link');
    await expect(spots).toHaveCount(3);
    await expect
      .poll(async () => {
        const boxes = await spots.evaluateAll((nodes) =>
          nodes.map((n) => {
            const b = n.getBoundingClientRect();
            return { x: b.x, height: b.height, width: b.width };
          }),
        );
        return (
          boxes.length === 3 &&
          boxes[1].x < boxes[0].x &&
          boxes[0].x < boxes[2].x &&
          boxes[0].height > boxes[1].height &&
          boxes[1].height > boxes[2].height &&
          boxes.every((b) => b.width >= 44 && b.height >= 44)
        );
      })
      .toBe(true);
    await expect(spots.nth(1)).toContainText('You');
    await expect(spots.nth(1)).toHaveAttribute('href', '/me');
    await expect(spots.nth(0)).toHaveAttribute('href', '/users/first');
    await expect(page.locator('ol[start="4"]')).toContainText('Alex Chen');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('list', { name: 'Top Three' }).scrollIntoViewIfNeeded();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
      theme,
    );
    const colors = await page
      .getByRole('list', { name: 'Top Three' })
      .getByRole('link')
      .evaluateAll((cards) => {
        const luminance = (color: string) =>
          color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const contrast = (ink: string, fill: string) => {
          const a = luminance(ink),
            b = luminance(fill);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        return cards.map((card) => {
          const style = getComputedStyle(card);
          const badge = getComputedStyle(card.querySelector('.podium-rank')!);
          const you = Array.from(card.querySelectorAll('span')).find(
            (span) => span.textContent === 'You',
          );
          return {
            medal: card.getAttribute('data-medal'),
            background: style.backgroundColor,
            ratios: [
              contrast(style.color, style.backgroundColor),
              contrast(badge.color, badge.backgroundColor),
              ...(you ? [contrast(getComputedStyle(you).color, style.backgroundColor)] : []),
            ],
          };
        });
      });
    expect(colors.map((card) => card.medal)).toEqual(['gold', 'silver', 'bronze']);
    expect(colors.flatMap((card) => card.ratios).every((ratio) => ratio >= 4.5)).toBe(true);
    expect(new Set(colors.map((card) => card.background)).size).toBe(3);
    console.log(
      `${testInfo.project.name} ${theme} minimum podium text contrast=${Math.min(...colors.flatMap((card) => card.ratios)).toFixed(2)}:1`,
    );
    if (process.env.GRAPH_SHOTS) {
      await page.screenshot({
        path: `${process.env.GRAPH_SHOTS}/podium-${testInfo.project.name}-${theme}.png`,
        animations: 'disabled',
      });
    }
  }
  await page.getByRole('list', { name: 'Top Three' }).getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/\/me$/);
});
