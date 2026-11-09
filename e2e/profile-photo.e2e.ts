import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { feedCard, logEntry } from './helpers';
import { csrfHeaders } from './api';

async function loadedImage(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
}

async function testPhoto(page: Page) {
  if (process.env.OYO_PHOTO)
    return {
      name: 'portrait.jpg',
      mimeType: 'image/jpeg',
      buffer: await readFile(process.env.OYO_PHOTO),
    };
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#bfd5d9';
    context.fillRect(0, 0, 800, 500);
    for (let i = 0; i < 8; i++) {
      context.fillStyle = i % 2 ? '#8c1515' : '#294a57';
      context.fillRect(i * 100, 160 + i * 20, 70, 220);
    }
    context.fillStyle = '#e7ba8c';
    context.beginPath();
    context.arc(400, 150, 100, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`profile photo in ${colorScheme} mode`, () => {
    test.use({ colorScheme });
    test('rower crops, saves and removes a photo across Me and the feed', async ({
      makeRower,
    }, testInfo) => {
      const rower = await makeRower();
      const { page, context } = rower;
      await page.emulateMedia({ colorScheme });
      if (process.env.OYO_SCREENSHOT_DIR) {
        await page.setViewportSize({ width: 393, height: 852 });
        const name = colorScheme === 'light' ? 'Alex Morgan' : 'Jamie Morgan';
        const response = await context.request.patch('/api/me', {
          headers: csrfHeaders,
          data: { name },
        });
        await expect(response).toBeOK();
        rower.user.name = name;
        await page.reload();
      }
      const title = process.env.OYO_SCREENSHOT_DIR
        ? `${colorScheme === 'light' ? 'Morning' : 'Afternoon'} Steady State`
        : `Photo workout ${rower.user.id}`;
      const screenshot = async (name: string) => {
        if (process.env.OYO_SCREENSHOT_DIR && testInfo.project.name === 'iphone-15') {
          expect(page.viewportSize()).toEqual({ width: 393, height: 852 });
          expect(await page.evaluate(() => devicePixelRatio)).toBe(3);
          const dismiss = page.getByRole('button', { name: 'Dismiss Notification', exact: true });
          if (await dismiss.isVisible()) await dismiss.click();
          await expect(
            page.getByRole('status', { name: 'Loading Mileage Chart', exact: true }),
          ).toHaveCount(0);
          await page.screenshot({
            path: join(process.env.OYO_SCREENSHOT_DIR, `${name}-${colorScheme}.png`),
            animations: 'disabled',
          });
        }
      };
      const navigate = async (name: 'Me' | 'Feed') => {
        await page
          .locator('.shell-sidebar, .shell-tabbar')
          .getByRole('link', { name, exact: true })
          .filter({ visible: true })
          .click();
      };
      await logEntry(page, 'erg', 'E', 5000, title);
      await navigate('Feed');
      await expect(feedCard(page, title)).toBeVisible();
      await expect(feedCard(page, title).locator('.ui-avatar img')).toHaveCount(0);
      await navigate('Me');
      await expect(page.getByRole('link', { name: 'Add Photo', exact: true })).toBeVisible();
      await screenshot('me-no-photo');
      await page.getByRole('link', { name: 'Add Photo', exact: true }).click();
      await page.getByRole('button', { name: 'Change Profile Photo', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Profile Photo', exact: true });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Remove Photo', exact: true })).toHaveCount(0);
      await screenshot('edit-sheet');
      await page.locator('input[type="file"]:not([capture])').setInputFiles(await testPhoto(page));
      const crop = page.getByRole('dialog', { name: 'Move and Scale', exact: true });
      const done = crop.getByRole('button', { name: 'Done', exact: true });
      await expect(crop).toBeVisible();
      await expect(done).toBeEnabled();
      await crop.getByLabel('Zoom', { exact: true }).fill('1.5');
      await crop.evaluate(async (dialog) => {
        await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
      });
      const viewport = crop.getByRole('group', { name: /Photo crop/ });
      const box = await viewport.boundingBox();
      expect(box).not.toBeNull();
      const beforePan = await crop
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() =>
          crop.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
        )
        .not.toBe(beforePan);
      await expect(crop.getByLabel('Zoom', { exact: true })).toHaveValue('1.5');
      await screenshot('crop');
      await done.click();
      await expect(crop).not.toBeVisible();
      await loadedImage(
        page.getByRole('button', { name: 'Change Profile Photo', exact: true }).locator('img'),
      );
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/\/me$/);
      await expect(page.getByRole('link', { name: 'Add Photo', exact: true })).toHaveCount(0);
      const meAvatar = page
        .getByRole('link', { name: 'Change Profile Photo', exact: true })
        .locator('img');
      await loadedImage(meAvatar);
      const meImage = await context.request.get('/api/me');
      await expect(meImage).toBeOK();
      const imageId: string = (await meImage.json()).avatar_image_id;
      expect(imageId).toBeTruthy();
      const imageResponse = await context.request.get(`/api/images/${imageId}`);
      await expect(imageResponse).toBeOK();
      const bytes = await imageResponse.body();
      expect(
        await meAvatar.evaluate((image: HTMLImageElement) => [
          image.naturalWidth,
          image.naturalHeight,
        ]),
      ).toEqual([512, 512]);
      await screenshot('me-photo');
      await navigate('Feed');
      const feedAvatar = feedCard(page, title).locator('.ui-avatar img');
      await loadedImage(feedAvatar);
      const feedBytes = await feedAvatar.evaluate(async (image: HTMLImageElement) =>
        Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())),
      );
      expect(Buffer.from(feedBytes).equals(bytes)).toBe(true);
      await feedCard(page, title).scrollIntoViewIfNeeded();
      await screenshot('feed-photo');
      await navigate('Me');
      await page.getByRole('link', { name: 'Change Profile Photo', exact: true }).click();
      await page.getByRole('button', { name: 'Change Profile Photo', exact: true }).click();
      await sheet.getByRole('button', { name: 'Remove Photo', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Change Profile Photo', exact: true }).locator('img'),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/\/me$/);
      await expect(page.getByRole('link', { name: 'Add Photo', exact: true })).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Add Photo', exact: true }).locator('.ui-avatar'),
      ).toHaveText(
        rower.user.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join(''),
      );
      await navigate('Feed');
      await expect(feedCard(page, title).locator('.ui-avatar img')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
    });
  });
}
