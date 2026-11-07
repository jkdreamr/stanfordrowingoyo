import { test, expect } from './fixtures';

for (const theme of ['light', 'dark'] as const) {
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
      await expect(splash.locator('.splash-wordmark')).toHaveCSS('animation-delay', '0.08s');
      await splash.evaluate(async (element) => {
        await Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      const mark = await splash.locator('.splash-mark').boundingBox();
      const viewport = page.viewportSize()!;
      expect(Math.abs(mark!.x + mark!.width / 2 - viewport.width / 2)).toBeLessThan(1);
      expect(Math.abs(mark!.y + mark!.height / 2 - (viewport.height / 2 - 24))).toBeLessThan(1);
      release();
      await expect(splash).toHaveCount(0, { timeout: 1800 });
      await expect(page.locator('#root')).not.toHaveAttribute('inert');
      await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
      await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
        'content',
        theme === 'dark' ? '#121214' : '#F7F7FA',
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
    await expect(splash.locator('.splash-wordmark')).toHaveCSS('animation-name', 'none');
    await expect(splash.locator('.splash-mark img')).toHaveCSS('opacity', '0');
    await expect(splash).toHaveCSS('transition-duration', '0.12s');
    release();
    await expect(splash).toHaveCount(0, { timeout: 1800 });
    await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  } finally {
    releaseImages();
    release();
  }
});
