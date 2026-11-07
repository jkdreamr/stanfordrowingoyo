import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { Api } from '../shared/types';
import { IDEMPOTENCY_HEADER } from '../shared/headers';
import { test, expect, type Rower } from './fixtures';
import { feedCard } from './helpers';

test.skip(
  process.env.E2E_MOCK === '1',
  'Reload and lost-response coverage requires the real backend',
);
test.use({ persistentRower: true, serviceWorkers: 'block' });

async function storedDraft(page: Page, userId: string) {
  return page.evaluate(
    (id) =>
      new Promise<{ idempotencyKey: string; draft: { notes: string }; photos: unknown[] } | null>(
        (resolve, reject) => {
          const request = indexedDB.open('oyo-log-drafts', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const read = db.transaction('drafts').objectStore('drafts').get(id);
            read.onsuccess = () => {
              db.close();
              resolve(read.result ?? null);
            };
            read.onerror = () => {
              db.close();
              reject(read.error);
            };
          };
        },
      ),
    userId,
  );
}

async function fillDraft(rower: Rower, note: string, photo = false) {
  const { page } = rower;
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/log');
  await page.getByLabel('Meters', { exact: true }).fill('8000');
  await page.getByLabel('Notes', { exact: true }).fill(note);
  await page.getByLabel('Title', { exact: true }).fill(note);
  if (photo) {
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#8c1515';
      ctx.fillRect(0, 0, 120, 80);
      ctx.fillStyle = '#f7f7fa';
      ctx.fillRect(12, 32, 96, 8);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('Photos', { exact: true }).setInputFiles({
      name: 'rowing.png',
      mimeType: 'image/png',
      buffer: Buffer.from(base64, 'base64'),
    });
  }
  await expect
    .poll(async () => {
      const saved = await storedDraft(page, rower.user.id);
      return { notes: saved?.draft.notes, photos: saved?.photos.length };
    })
    .toEqual({ notes: note, photos: photo ? 1 : 0 });
}

async function matchingEntries(rower: Rower, note: string) {
  const response = await rower.context.request.get('/api/entries?scope=mine');
  await expect(response).toBeOK();
  const entries: Api['GET /api/entries']['response'] = await response.json();
  expect(entries.next_cursor).toBeNull();
  return entries.items.filter((entry) => entry.notes === note && entry.user_id === rower.user.id);
}

async function phoneScreenshots(page: Page, testInfo: TestInfo, name: string) {
  if (!process.env.OYO_SCREENSHOT_DIR || testInfo.project.name !== 'iphone-15') return;
  await page.setViewportSize({ width: 393, height: 852 });
  expect(page.viewportSize()).toEqual({ width: 393, height: 852 });
  if (name === 'log-draft-restored')
    await page.getByRole('button', { name: 'Discard', exact: true }).focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    else await expect(page.locator('html')).not.toHaveClass(/dark/);
    if (name === 'log-draft-restored')
      await expect(page.getByText('Draft Restored', { exact: true })).toBeVisible();
    await page.screenshot({
      path: join(process.env.OYO_SCREENSHOT_DIR, `${name}-${colorScheme}.png`),
      animations: 'disabled',
    });
  }
}

test('restores fields and a photo after reload, posts once and clears the draft', async ({
  makeRower,
}, testInfo) => {
  const rower = await makeRower();
  const { page } = rower;
  const note = `Restored workout ${rower.user.id}`;
  await fillDraft(rower, note, true);
  const key = (await storedDraft(page, rower.user.id))!.idempotencyKey;
  await page.reload();
  await expect(page.getByText('Draft Restored', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Meters', { exact: true })).toHaveValue('8000');
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue(note);
  const photo = page.getByAltText('Selected photo 1', { exact: true });
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(120);
  await phoneScreenshots(page, testInfo, 'log-draft-restored');
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/entries') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().headers()[IDEMPOTENCY_HEADER.toLowerCase()]).toBe(key);
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await page.goto('/feed');
  await expect(feedCard(page, note)).toHaveCount(1);
  await expect(feedCard(page, note)).toBeVisible();
  expect(await matchingEntries(rower, note)).toHaveLength(1);
  await page.goto('/log');
  await expect(page.getByLabel('Meters', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('');
  await expect(page.getByAltText('Selected photo 1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Draft Restored', { exact: true })).toHaveCount(0);
  expect(await storedDraft(page, rower.user.id)).toBeNull();
});

test('Discard on the restore toast clears the draft across another reload', async ({
  makeRower,
}) => {
  const rower = await makeRower();
  const { page } = rower;
  await fillDraft(rower, `Discarded workout ${rower.user.id}`, true);
  await page.reload();
  await expect(page.getByText('Draft Restored', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByLabel('Meters', { exact: true })).toHaveValue('');
  await expect.poll(() => storedDraft(page, rower.user.id)).toBeNull();
  await page.reload();
  await expect(page.getByLabel('Meters', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('');
  await expect(page.getByAltText('Selected photo 1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Draft Restored', { exact: true })).toHaveCount(0);
});

test('retries a committed create with a lost response using the same key', async ({
  makeRower,
}) => {
  const rower = await makeRower();
  const { page } = rower;
  const note = `Lost response ${rower.user.id}`;
  await fillDraft(rower, note);
  const keys: (string | undefined)[] = [];
  await page.route('**/api/entries', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()[IDEMPOTENCY_HEADER.toLowerCase()]);
    if (keys.length === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(await matchingEntries(rower, note)).toHaveLength(1);
});

test('shows Offline across pages and posts once after reconnecting', async ({
  makeRower,
}, testInfo) => {
  const rower = await makeRower();
  const { page, context } = rower;
  await page.goto('/log');
  await expect(page.getByLabel('Meters', { exact: true })).toBeVisible();
  const offline = page.getByRole('status').filter({ hasText: /^Offline$/ });
  await context.setOffline(true);
  await expect(offline).toBeVisible();
  await phoneScreenshots(page, testInfo, 'log-offline');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await expect(offline).toBeVisible();
  await context.setOffline(false);
  await expect(offline).toHaveCount(0);
  const note = `Offline workout ${rower.user.id}`;
  await fillDraft(rower, note);
  await context.setOffline(true);
  await expect(offline).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Meters', { exact: true })).toBeDisabled();
  await context.setOffline(false);
  await expect(offline).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  expect(await matchingEntries(rower, note)).toHaveLength(1);
});
