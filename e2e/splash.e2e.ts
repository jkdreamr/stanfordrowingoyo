import { test, expect } from './fixtures';

/** Records how the splash left (handoff or curtain) and what the page looked like then. */
function recordLaunchExit() {
  addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('launch-splash');
    if (!splash) return;
    const observer = new MutationObserver(() => {
      if (!splash.classList.contains('is-leaving')) return;
      observer.disconnect();
      const root = document.documentElement;
      const hero = document.querySelector('.drive-hero')?.getBoundingClientRect();
      root.dataset.launchExit = splash.classList.contains('is-handoff') ? 'handoff' : 'curtain';
      root.dataset.launchState = JSON.stringify({
        inert: document.getElementById('root')!.hasAttribute('inert'),
        launching: root.classList.contains('launching'),
        covered: root.classList.contains('launch-handoff'),
        pointer: getComputedStyle(splash).pointerEvents,
        inset: ['top', 'right', 'bottom', 'left'].map((side) =>
          parseFloat(splash.style.getPropertyValue(`--handoff-${side}`)),
        ),
        hero: hero && [hero.top, innerWidth - hero.right, innerHeight - hero.bottom, hero.left],
      });
    });
    observer.observe(splash, { attributes: true, attributeFilter: ['class'] });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`cold lazy route paints the splash backdrop without hydration warnings (${theme})`, async ({
    adminPage: page,
    browserName,
  }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (/HydrateFallback|initial hydration/.test(message.text())) warnings.push(message.text());
    });
    let release!: () => void;
    const chunk = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      /\/(?:assets\/Games-[^/]+\.js|src\/pages\/Games\.tsx)(?:\?.*)?$/,
      async (route) => {
        await chunk;
        await route.continue();
      },
    );
    try {
      await page.goto('/games', { waitUntil: 'domcontentloaded' });
      const fallback = page.locator('#root [role="status"][aria-label="Opening OYO"]');
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveCSS('background-color', 'rgb(140, 21, 21)');
      await expect(page.locator('#launch-splash')).toHaveCount(0);
      await expect(fallback).toBeInViewport({ ratio: 1 });
      if (browserName !== 'webkit')
        await page.screenshot({ path: testInfo.outputPath('lazy-route-fallback.png') });
      release();
      await expect(page.getByRole('heading', { name: 'Daily Games', exact: true })).toBeVisible();
      await expect(fallback).toHaveCount(0);
      expect(warnings).toEqual([]);
    } finally {
      release();
    }
  });

  test(`cold launch paints inline and dismisses after auth (${theme})`, async ({
    adminPage: page,
  }) => {
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
    let release!: () => void;
    const auth = new Promise<void>((resolve) => {
      release = resolve;
    });
    let boot!: () => void;
    const bundle = new Promise<void>((resolve) => {
      boot = resolve;
    });
    await page.route(/\/(?:assets\/.*\.js|src\/main\.tsx)(?:\?.*)?$/, async (route) => {
      await bundle;
      await route.continue();
    });
    await page.route('**/api/me', async (route) => {
      const response = await route.fetch();
      await auth;
      await route.fulfill({ response });
    });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      const splash = page.getByRole('status', { name: 'Opening OYO' });
      await expect(splash).toBeVisible();
      await expect(page.locator('#root')).toBeEmpty();
      const markBeforeBoot = await splash
        .locator('.splash-mark')
        .evaluate((mark) => [mark.clientWidth, mark.clientHeight]);
      boot();
      await page.waitForLoadState('domcontentloaded');
      const markAfterBoot = await splash
        .locator('.splash-mark')
        .evaluate((mark) => [mark.clientWidth, mark.clientHeight]);
      expect(markAfterBoot).toEqual(markBeforeBoot);
      await expect(splash).toHaveCSS('background-color', 'rgb(140, 21, 21)');
      await expect(page.locator('#root')).toHaveAttribute('inert', '');
      await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
        'content',
        '#8C1515',
      );
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await expect(splash.locator('.splash-photo')).toHaveCount(0);
      await expect(splash.locator('.splash-mark img')).toHaveClass(/is-loaded/);
      await expect(splash.locator('.splash-mark')).toHaveCSS('animation-name', 'splash-mark-enter');
      await expect(splash.locator('.splash-wordmark')).toHaveCSS('font-weight', '500');
      const letters = splash.locator('.splash-wordmark span');
      await expect(letters).toHaveText(['O', 'Y', 'O']);
      expect(
        await letters.evaluateAll((spans) =>
          spans.map((span) => {
            const style = getComputedStyle(span);
            return `${style.animationName} ${style.animationDelay}`;
          }),
        ),
      ).toEqual(['splash-letter 0.22s', 'splash-letter 0.28s', 'splash-letter 0.34s']);
      await splash.evaluate(async (element) => {
        await Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      const mark = await splash.locator('.splash-mark').boundingBox();
      const viewport = page.viewportSize()!;
      expect(Math.abs(mark!.x + mark!.width / 2 - viewport.width / 2)).toBeLessThan(1);
      expect(Math.abs(mark!.y + mark!.height / 2 - (viewport.height / 2 - 24))).toBeLessThan(1);
      // The puddle ripples spread from the mark's center.
      const water = (await splash.locator('.splash-water').boundingBox())!;
      expect(Math.abs(water.x - (mark!.x + mark!.width / 2))).toBeLessThan(1);
      expect(Math.abs(water.y - (mark!.y + mark!.height / 2))).toBeLessThan(1);
      release();
      await expect(splash).toHaveCount(0, { timeout: 1800 });
      await expect(page.locator('#root')).not.toHaveAttribute('inert');
      await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
      // Browser chrome matches the page's paper once the splash is gone.
      await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
        'content',
        theme === 'dark' ? '#000000' : '#FFFFFF',
      );
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
      );
    } finally {
      boot();
      release();
    }
  });
}

test('does not recreate the splash on navigation or background return', async ({
  adminPage: page,
}) => {
  await page.goto('/');
  await expect(page.locator('#launch-splash')).toHaveCount(0);
  await page.evaluate(() => {
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          Array.from(record.addedNodes).some(
            (node) =>
              node instanceof Element &&
              (node.id === 'launch-splash' || node.querySelector('#launch-splash')),
          ),
        )
      ) {
        document.documentElement.dataset.splashReappeared = 'true';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  for (const name of ['Feed', 'Leaderboard', 'Me', 'Home']) {
    await page
      .locator('.shell-sidebar, .shell-tabbar')
      .getByRole('link', { name, exact: true })
      .filter({ visible: true })
      .click();
    await expect(page.locator('#launch-splash')).toHaveCount(0);
  }
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-splash-reappeared');
  await expect(page.locator('#launch-splash')).toHaveCount(0);
});

test('slow/failed portrait and reduced motion do not hold the app behind the splash', async ({
  adminPage: page,
}) => {
  await page.addInitScript(recordLaunchExit);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseImages!: () => void;
  const images = new Promise<void>((resolve) => {
    releaseImages = resolve;
  });
  await page.route('**/splash/**', async (route) => {
    await images;
    await route.abort();
  });
  let release!: () => void;
  const auth = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/me', async (route) => {
    const response = await route.fetch();
    await auth;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const splash = page.locator('#launch-splash');
    await expect(splash).toBeVisible();
    await expect(splash.locator('.splash-mark')).toHaveCSS('animation-name', 'none');
    await expect(splash.locator('.splash-wordmark span').first()).toHaveCSS(
      'animation-name',
      'none',
    );
    await expect(splash.locator('.splash-mark img')).toHaveCSS('opacity', '0');
    await expect(splash).toHaveCSS('transition-duration', '0.12s');
    release();
    await expect(splash).toHaveCount(0, { timeout: 1800 });
    await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.launchExit)).toBe('curtain');
  } finally {
    releaseImages();
    release();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`launch on Home hands the painted splash off to the Week Hero (${theme})`, async ({
    adminPage: page,
  }) => {
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
    await page.addInitScript(recordLaunchExit);
    await page.goto('/', { waitUntil: 'commit' });
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-launch-exit', 'handoff');
    const state = JSON.parse((await root.getAttribute('data-launch-state'))!);
    // Input returns the moment the exit starts, exactly as with the curtain.
    expect(state).toMatchObject({ inert: false, launching: false, covered: true, pointer: 'none' });
    // The sheet contracts onto the hero's own box.
    state.inset.forEach((value: number, i: number) =>
      expect(Math.abs(value - state.hero[i])).toBeLessThan(1),
    );
    const hero = page.locator('.drive-hero');
    await expect(hero).toHaveCSS('animation-name', 'none');
    await expect(page.locator('#launch-splash')).toHaveCount(0, { timeout: 1000 });
    await expect(root).not.toHaveClass(/launch-handoff/);
    await expect(hero.getByRole('progressbar', { name: 'Weekly Target' })).toBeVisible();
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      theme === 'dark' ? '#000000' : '#FFFFFF',
    );
  });
}

test('launch on another tab keeps the curtain', async ({ adminPage: page }) => {
  await page.addInitScript(recordLaunchExit);
  await page.goto('/feed', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-launch-exit', 'curtain');
  await expect(page.locator('html')).not.toHaveAttribute('data-handoff');
  await expect(page.locator('#launch-splash')).toHaveCount(0, { timeout: 1800 });
});
