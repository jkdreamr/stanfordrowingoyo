import { chromium } from '@playwright/test';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { csrfHeaders } from './api';
import { openSettings, seedEntry } from './helpers';

const iphone = (name: string) => name === 'iphone-15';

async function stubPush(page: Page) {
  await page.addInitScript(() => {
    const state = { subscription: null as PushSubscription | null };
    const w = window as unknown as Record<string, unknown>;
    w.__push = state;
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'default' });
    Notification.requestPermission = async () => 'granted';
    const fake = (endpoint: string) =>
      ({
        endpoint,
        options: { applicationServerKey: null },
        toJSON: () => ({
          endpoint,
          keys: {
            p256dh:
              'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
            auth: 'BTBZMqHH6r4Tts7J_aSIgg',
          },
        }),
        unsubscribe: async () => {
          state.subscription = null;
          return true;
        },
      }) as unknown as PushSubscription;
    const pushManager = {
      getSubscription: async () => state.subscription,
      subscribe: async () =>
        (state.subscription = fake('https://fcm.googleapis.com/fcm/send/e2e-' + Date.now())),
    };
    // Chromium refuses service workers on the self-signed E2E origin; stub the registration.
    const registration = { pushManager } as unknown as ServiceWorkerRegistration;
    Object.assign(navigator.serviceWorker, {
      getRegistration: async () => registration,
      register: async () => registration,
    });
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      configurable: true,
      get: () => Promise.resolve(registration),
    });
  });
}

test('push toggle subscribes and unsubscribes this device', async ({ makeRower }, testInfo) => {
  test.skip(iphone(testInfo.project.name), 'iPhone Safari requires a Home Screen install');
  const a = await makeRower();
  await stubPush(a.page);
  await a.page.goto('/');
  await openSettings(a.page);
  const toggle = a.page.getByRole('switch', { name: 'Push Notifications', exact: true });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const put = a.page.waitForResponse(
    (r) => r.url().endsWith('/api/me/push') && r.request().method() === 'PUT',
  );
  await toggle.click();
  expect((await put).status()).toBe(204);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const remove = a.page.waitForResponse(
    (r) => r.url().endsWith('/api/me/push') && r.request().method() === 'DELETE',
  );
  await toggle.click();
  expect((await remove).status()).toBe(204);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('iPhone outside the Home Screen explains how to enable push', async ({
  makeRower,
}, testInfo) => {
  test.skip(!iphone(testInfo.project.name), 'iPhone-only behavior');
  const a = await makeRower();
  await a.page.goto('/');
  await openSettings(a.page);
  await expect(
    a.page.getByRole('switch', { name: 'Push Notifications', exact: true }),
  ).toBeDisabled();
  await expect(a.page.getByText('Add OYO to your Home Screen first.')).toBeVisible();
  await a.page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
  const sheet = a.page.getByRole('dialog', { name: 'Add to Home Screen' });
  await expect(sheet.getByText('Tap Share', { exact: true })).toBeVisible();
});

test('notifications refresh every minute and update the app badge', async ({ makeRower }) => {
  const a = await makeRower();
  const b = await makeRower();
  const title = `Badge ${a.user.id}`;
  const entry = await seedEntry(a, title);
  await a.page.addInitScript(() => {
    const badges: number[] = [];
    (window as unknown as { __badges: number[] }).__badges = badges;
    Object.assign(navigator, {
      setAppBadge: async (count?: number) => void badges.push(count ?? 0),
      clearAppBadge: async () => void badges.push(0),
    });
  });
  await a.page.clock.install();
  await a.page.goto('/');
  await expect(a.page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  const badges = () =>
    a.page.evaluate(() => (window as unknown as { __badges: number[] }).__badges);
  await expect.poll(badges).toContain(0);
  expect(
    (await b.context.request.post(`/api/entries/${entry.id}/kudos`, { headers: csrfHeaders })).ok(),
  ).toBe(true);
  const refreshed = a.page.waitForResponse((r) => r.url().endsWith('/api/notifications'));
  await a.page.clock.runFor(61_000);
  await refreshed;
  await expect.poll(badges).toContain(1);
});

test('install card uses the browser prompt and stays dismissed', async ({
  makeRower,
}, testInfo) => {
  const a = await makeRower();
  await a.page.goto('/');
  const card = a.page.getByRole('region', { name: 'Install App' });
  if (iphone(testInfo.project.name)) {
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Install', exact: true }).click();
    await expect(
      a.page.getByRole('dialog', { name: 'Add to Home Screen' }).getByText('Tap Add', {
        exact: true,
      }),
    ).toBeVisible();
    await a.page.keyboard.press('Escape');
  } else {
    await expect(card).toHaveCount(0);
    await a.page.evaluate(() => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {
          (window as unknown as { __prompted: boolean }).__prompted = true;
        },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
    });
    await card.getByRole('button', { name: 'Install', exact: true }).click();
    expect(
      await a.page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted),
    ).toBe(true);
    await expect(card).toHaveCount(0);
    await a.page.evaluate(() =>
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
          prompt: async () => {},
        }),
      ),
    );
  }
  await card.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(card).toHaveCount(0);
  await a.page.reload();
  await expect(a.page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('install card is hidden when already installed', async ({ makeRower }) => {
  const a = await makeRower();
  await a.page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === '(display-mode: standalone)'
        ? ({ ...original(query), matches: true, media: query } as MediaQueryList)
        : original(query);
  });
  await a.page.goto('/');
  await expect(a.page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await a.page.evaluate(() =>
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {},
      }),
    ),
  );
  await expect(a.page.getByRole('region', { name: 'Install App' })).toHaveCount(0);
});

test('service worker shows pushed notifications with same-origin links', async ({
  makeRower,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'CDP push delivery is Chromium-only');
  const a = await makeRower();
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--ignore-certificate-errors'],
  });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      baseURL: testInfo.project.use.baseURL,
      storageState: await a.context.storageState(),
    });
    await context.grantPermissions(['notifications']);
    const page = await context.newPage();
    await deliverPush(page);
  } finally {
    await browser.close();
  }
});

async function deliverPush(page: Page) {
  const a = { page, context: page.context() };
  await a.page.goto('/');
  await a.page.evaluate(async () => {
    const messages: unknown[] = [];
    (window as unknown as { __sw: unknown[] }).__sw = messages;
    navigator.serviceWorker.addEventListener('message', (event) => messages.push(event.data));
    await navigator.serviceWorker.ready;
  });
  const cdp = await a.context.newCDPSession(a.page);
  await cdp.send('ServiceWorker.enable');
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const match = registrations.find((r: { isDeleted: boolean }) => !r.isDeleted);
      if (match) resolve(match.registrationId);
    });
  });
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(a.page.url()).origin,
    registrationId,
    data: JSON.stringify({
      title: 'Avery',
      body: 'Gave kudos to Morning 6k',
      url: 'https://evil.example/x',
      tag: 'kudos:e2e',
      badge: 2,
    }),
  });
  await expect
    .poll(() => a.page.evaluate(() => (window as unknown as { __sw: unknown[] }).__sw))
    .toContainEqual({ type: 'oyo-push' });
  await expect
    .poll(() =>
      a.page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({
          title: n.title,
          body: n.body,
          tag: n.tag,
          url: (n.data as { url: string }).url,
        })),
      ),
    )
    .toEqual([
      { title: 'Avery', body: 'Gave kudos to Morning 6k', tag: 'kudos:e2e', url: '/notifications' },
    ]);
}
