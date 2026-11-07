import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry } from './helpers';

for (const staff of [false, true]) {
  test(`${staff ? 'staff' : 'owner'} deletes a workout without refetching removed resources`, async ({
    makeRower,
    adminPage,
  }) => {
    const rower = await makeRower();
    const entry = await seedEntry(rower, `QA Delete ${crypto.randomUUID().slice(0, 8)}`);
    const commentResponse = await rower.context.request.post(`/api/entries/${entry.id}/comments`, {
      headers: csrfHeaders,
      data: { body: 'QA discussion' },
    });
    await expect(commentResponse).toBeOK();
    const page = staff ? adminPage : rower.page;
    const missing: string[] = [];
    page.on('response', (response) => {
      if (
        response.status() === 404 &&
        new URL(response.url()).pathname.startsWith(`/api/entries/${entry.id}`)
      )
        missing.push(response.url());
    });
    await page.goto(`/entries/${entry.id}`);
    await expect(page.getByText('QA discussion', { exact: true })).toBeVisible();
    if (staff) {
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Delete Comment', exact: true })
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      await expect(page.getByText('QA discussion', { exact: true })).not.toBeVisible();
    }
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Delete Workout', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible();
    expect(missing).toEqual([]);
    if (staff) {
      await page.goto('/admin/audit');
      await expect(
        page.getByText(`Joshua Koo deleted the workout “${entry.title}”`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('Joshua Koo deleted a comment', { exact: true }).first(),
      ).toBeVisible();
    }
  });
}
