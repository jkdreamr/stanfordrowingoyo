import { randomUUID } from 'node:crypto';
import type { TeamPlan } from '../shared/types';
import { test, expect } from './fixtures';

test('staff edits a whole-plan draft, previews it, saves and verifies rower plan reads', async ({
  adminPage,
  makeRower,
}) => {
  const rower = await makeRower();
  const text = `E2E Plan ${randomUUID()}`;
  const label = `E2E Weekly Total ${randomUUID()}`;
  const week = '2027-01-04';
  await adminPage.goto(`/admin/plan?week=${week}`);
  await expect(adminPage.getByRole('button', { name: 'Save Plan', exact: true })).toBeDisabled();
  await adminPage.getByRole('button', { name: 'Edit Monday AM', exact: true }).click();
  const sheet = adminPage.getByRole('dialog', { name: 'Monday AM', exact: true });
  await sheet.getByRole('radio', { name: 'OYO', exact: true }).click();
  await sheet.getByRole('radio', { name: 'Zone E', exact: true }).locator('..').click();
  await sheet.getByLabel('Session Text', { exact: true }).fill(text);
  await sheet.getByRole('button', { name: 'Apply To Draft', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await adminPage.getByLabel('Week Total Label', { exact: true }).fill(label);
  await adminPage.getByRole('button', { name: 'Next Week', exact: true }).click();
  const weekDiscard = adminPage.getByRole('dialog', { name: 'Discard Changes?', exact: true });
  await expect(weekDiscard).toBeVisible();
  await weekDiscard.getByRole('button', { name: 'Keep Editing', exact: true }).click();
  await expect(adminPage.getByLabel('Week Total Label', { exact: true })).toHaveValue(label);
  await adminPage.getByRole('link', { name: 'Back', exact: true }).click();
  const discard = adminPage.getByRole('dialog', { name: 'Discard Changes?', exact: true });
  await expect(discard).toContainText('unsaved training plan');
  await discard.getByRole('button', { name: 'Keep Editing', exact: true }).click();
  await expect(discard).not.toBeVisible();
  await adminPage.getByRole('radio', { name: 'Preview', exact: true }).click();
  const preview = adminPage.getByRole('region', { name: 'Week of Jan 4 Preview', exact: true });
  await expect(preview).toContainText(text);
  await expect(preview).toContainText(label);
  await adminPage.getByRole('button', { name: 'Save Plan', exact: true }).click();
  await expect(adminPage.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  await adminPage.reload();
  await expect(adminPage.getByLabel('Week Total Label', { exact: true })).toHaveValue(label);
  await expect(
    adminPage.getByRole('button', { name: 'Edit Monday AM', exact: true }),
  ).toContainText(text);
  const response = await rower.context.request.get(`/api/plan?week=${week}`);
  await expect(response).toBeOK();
  const plan: TeamPlan = await response.json();
  expect(plan.slots.find((row) => row.day === 0 && row.slot === 'AM')).toMatchObject({
    text,
    kind: 'oyo',
    zone: 'E',
  });
  expect(plan.week_start).toBe(week);
  expect(plan.total).toBe(label);
  await adminPage.getByRole('button', { name: 'Next Week' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Week of Jan 11' })).toBeVisible();
  await adminPage.getByRole('button', { name: 'Copy Previous Week' }).click();
  await expect(
    adminPage.getByRole('button', { name: 'Edit Monday AM', exact: true }),
  ).toContainText(text);
  const unsaved = await rower.context.request.get('/api/plan?week=2027-01-11');
  expect((await unsaved.json()).slots).toEqual([]);
  await adminPage.getByRole('button', { name: 'Save Plan' }).click();
  await expect(adminPage.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
});
