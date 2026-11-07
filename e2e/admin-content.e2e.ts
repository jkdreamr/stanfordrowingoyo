import { randomUUID } from 'node:crypto';
import type { Preset, Settings } from '../shared/types';
import { equivalentMeters } from '../shared/math';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';

test('staff creates, edits, reorders and toggles presets persistently', async ({
  adminPage,
}, testInfo) => {
  const name = `E2E Preset ${randomUUID()}`;
  const zone = ({ 'desktop-chrome': 'A', 'iphone-15': 'B', 'pixel-7': 'C/B' } as const)[
    testInfo.project.name as 'desktop-chrome' | 'iphone-15' | 'pixel-7'
  ];
  const settings: Settings = await (await adminPage.request.get('/api/admin/settings')).json();
  await adminPage.goto('/admin/presets');
  await adminPage.getByRole('radio', { name: 'Run', exact: true }).click();
  for (const suffix of ['First', 'Second']) {
    await adminPage.getByRole('button', { name: 'Add Preset', exact: true }).click();
    const sheet = adminPage.getByRole('dialog', { name: 'Add Preset', exact: true });
    await expect(sheet.getByRole('button', { name: 'Save Preset' })).toBeDisabled();
    await sheet.getByLabel('Name', { exact: true }).fill(`${name} ${suffix}`);
    await sheet.getByLabel('Zone', { exact: true }).selectOption(zone);
    await sheet.getByLabel('Distance', { exact: true }).fill('0');
    await expect(sheet.getByText('Use whole meters from 1 to 200,000.')).toBeVisible();
    await sheet.getByLabel('Distance', { exact: true }).fill('10000');
    await expect(sheet.getByRole('status')).toHaveText(
      `${equivalentMeters(10000, 'run', zone, settings.mode_factors, settings.zone_factors).toLocaleString('en-US')} E-meters`,
    );
    await sheet.getByRole('button', { name: 'Save Preset' }).click();
    await expect(sheet).not.toBeVisible();
  }
  const first = adminPage.getByRole('article', { name: `${name} First`, exact: true });
  await first.getByRole('button', { name: `Edit ${name} First`, exact: true }).click();
  const edit = adminPage.getByRole('dialog', { name: 'Edit Preset', exact: true });
  await edit.getByRole('switch', { name: 'Enter Meters Each Time', exact: true }).click();
  await expect(edit.getByRole('status')).toContainText('E-meters = distance ×');
  await edit.getByRole('button', { name: 'Save Preset' }).click();
  await expect(edit).not.toBeVisible();
  await first.getByRole('switch', { name: 'Active', exact: true }).click();
  await expect(first.getByRole('switch', { name: 'Active', exact: true })).not.toBeChecked();
  await expect(
    first.getByRole('button', { name: `Move Down: ${name} First`, exact: true }),
  ).toHaveCount(0);
  await adminPage.getByRole('button', { name: 'Reorder', exact: true }).click();
  const moveDown = first.getByRole('button', { name: `Move Down: ${name} First`, exact: true });
  if (testInfo.project.use.hasTouch) await moveDown.tap();
  else {
    await moveDown.focus();
    await moveDown.press('Enter');
  }
  await expect(adminPage.getByText('Preset order saved', { exact: true })).toBeVisible();
  await adminPage.getByRole('button', { name: 'Done', exact: true }).click();
  await adminPage.reload();
  await adminPage.getByRole('radio', { name: 'Run', exact: true }).click();
  await expect(first).toContainText('Enter meters');
  await expect(first.getByRole('switch', { name: 'Active', exact: true })).not.toBeChecked();
  const response = await adminPage.request.get('/api/admin/presets');
  const rows: Preset[] = await response.json();
  const a = rows.find((row) => row.name === `${name} First`)!;
  const b = rows.find((row) => row.name === `${name} Second`)!;
  expect(a.sort).toBeGreaterThan(b.sort);
  await first.getByRole('button', { name: `Edit ${name} First`, exact: true }).click();
  await adminPage
    .getByRole('dialog', { name: 'Edit Preset', exact: true })
    .getByRole('button', { name: 'Delete Preset', exact: true })
    .click();
  const confirm = adminPage.getByRole('dialog', { name: 'Delete Preset?', exact: true });
  await confirm.getByRole('button', { name: 'Delete Preset', exact: true }).click();
  await expect(first).toHaveCount(0);
  await adminPage.request.delete(`/api/admin/presets/${b.id}`, { headers: csrfHeaders });
});

test('staff creates, edits, pins and deletes announcements; pinned messages reach Home and the rail', async ({
  adminPage,
}) => {
  const title = `E2E Announcement ${randomUUID()}`;
  await adminPage.goto('/admin/announcements');
  await adminPage
    .locator('.ui-page-nav')
    .getByRole('button', { name: 'New Announcement', exact: true })
    .click();
  const sheet = adminPage.getByRole('dialog', { name: 'New Announcement', exact: true });
  await expect(sheet.getByRole('button', { name: 'Save Announcement' })).toBeDisabled();
  await sheet.getByLabel('Title', { exact: true }).fill(title);
  await sheet.getByLabel('Message', { exact: true }).fill('Meet at the boathouse at 6:15.');
  await sheet.getByRole('button', { name: 'Save Announcement' }).click();
  await expect(sheet).not.toBeVisible();
  const row = adminPage.getByRole('article', { name: title, exact: true });
  await row.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
  const edit = adminPage.getByRole('dialog', { name: 'Edit Announcement', exact: true });
  await edit.getByLabel('Message', { exact: true }).fill('Meet at the boathouse at 6:30.');
  await edit.getByRole('button', { name: 'Save Announcement' }).click();
  await expect(edit).not.toBeVisible();
  await expect(row).toContainText('6:30');
  await row.getByRole('switch', { name: 'Pinned', exact: true }).click();
  await expect(row.getByRole('switch', { name: 'Pinned', exact: true })).toBeChecked();
  const rail = adminPage.getByRole('complementary', { name: 'Team Overview' });
  if (await rail.isVisible())
    await expect(rail.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await adminPage.goto('/');
  await expect(
    adminPage.getByRole('heading', { name: title, exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await adminPage.goto('/admin/announcements');
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirm = adminPage.getByRole('dialog', { name: 'Delete Announcement?', exact: true });
  await confirm.getByRole('button', { name: 'Delete Announcement', exact: true }).click();
  await expect(row).toHaveCount(0);
  await adminPage.reload();
  await expect(row).toHaveCount(0);
  if (await rail.isVisible())
    await expect(rail.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
});
