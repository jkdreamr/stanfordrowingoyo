import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { feedCard, seedEntry } from './helpers';
import { csrfHeaders } from './api';

async function doubleTap(target: Locator, mobile: boolean, whitespace = false) {
  await target.scrollIntoViewIfNeeded();
  const bounds = (await target.boundingBox())!;
  const options = whitespace ? { position: { x: bounds.width - 2, y: bounds.height - 2 } } : {};
  if (mobile) {
    const point = options.position ?? { x: bounds.width / 2, y: bounds.height / 2 };
    const x = bounds.x + point.x,
      y = bounds.y + point.y;
    // Locator actionability waits between taps can exceed the gesture window in WebKit.
    await target.page().touchscreen.tap(x, y);
    await target.page().touchscreen.tap(x, y);
  } else await target.dblclick(options);
}
test('double-tap gives once on feed body, photos and detail; single taps and viewer zoom survive', async ({
  makeRower,
}, testInfo) => {
  const author = await makeRower();
  const viewer = await makeRower();
  const entry = await seedEntry(author, `Double Tap ${author.user.id}`);
  const base64 = await author.page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#8c1515';
    ctx.fillRect(0, 0, 600, 400);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const upload = await author.context.request.post('/api/images', {
    headers: { ...csrfHeaders, 'Content-Type': 'image/png' },
    data: Buffer.from(base64, 'base64'),
  });
  await expect(upload).toBeOK();
  const image = await upload.json();
  const updated = await author.context.request.patch(`/api/entries/${entry.id}`, {
    headers: csrfHeaders,
    data: { image_ids: [image.id] },
  });
  await expect(updated).toBeOK();
  const { page } = viewer;
  const mobile = !!testInfo.project.use.isMobile;
  let posts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === `/api/entries/${entry.id}/kudos`
    )
      posts++;
  });
  await page.goto('/feed');
  const card = feedCard(page, entry.title);
  const kudos = card.getByRole('button', { name: 'Kudos', exact: true });
  if (!mobile) {
    await card.getByText('Distance', { exact: true }).dblclick();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('Distance');
    await expect(kudos).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
  }
  await doubleTap(card.locator('dl'), mobile, true);
  await expect(kudos).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('button', { name: 'View 1 Kudos', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/feed$/);
  await doubleTap(card.getByRole('button', { name: 'Open Photo 1' }), mobile);
  await expect(kudos).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(posts).toBe(1);
  await kudos.click();
  await expect(kudos).toHaveAttribute('aria-pressed', 'false');
  await expect(kudos).toBeEnabled();
  await doubleTap(card.getByRole('button', { name: 'Open Photo 1' }), mobile);
  await expect(kudos).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('button', { name: 'View 1 Kudos', exact: true })).toBeVisible();
  const burst = card.locator('.social-heart-burst');
  await expect(burst).toBeVisible();
  await burst.evaluate((element) => {
    for (const animation of element.getAnimations()) {
      animation.pause();
      animation.currentTime = 180;
    }
  });
  await card.screenshot({ path: testInfo.outputPath('heart-burst.png') });
  expect(posts).toBe(2);
  await card.getByText('Distance', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/entries/${entry.id}$`));
  await expect(page.getByRole('heading', { name: 'Comments', exact: true })).toBeVisible();
  const detail = page.getByRole('article');
  const detailKudos = detail.getByRole('button', { name: 'Kudos', exact: true });
  await detailKudos.click();
  await expect(detailKudos).toHaveAttribute('aria-pressed', 'false');
  await expect(detailKudos).toBeEnabled();
  await doubleTap(detail.getByRole('button', { name: 'Open Photo 1' }), mobile);
  await expect(detailKudos).toHaveAttribute('aria-pressed', 'true');
  await expect(detail.getByRole('button', { name: 'View 1 Kudos', exact: true })).toBeVisible();
  const photo = detail.getByRole('button', { name: 'Open Photo 1' });
  await photo.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await doubleTap(dialog.locator('.social-zoom-slide'), mobile);
  await expect(dialog.locator('.social-zoom-image')).toHaveCSS('transform', /matrix\(2,/);
  expect(posts).toBe(3);
});
