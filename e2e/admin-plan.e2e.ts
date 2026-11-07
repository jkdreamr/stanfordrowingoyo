import { randomUUID } from 'node:crypto';
import type { Plan } from '../shared/types';
import { test, expect } from './fixtures';

test('staff edits a whole-plan draft, previews it, saves and verifies rower plan reads', async ({
  adminPage,
  makeRower,
}) => {
  const rower = await makeRower();
  const text = `E2E Plan ${randomUUID()}`;
  const label = `E2E Weekly Total ${randomUUID()}`;
  await adminPage.goto('/admin/plan');
  await expect(adminPage.getByRole('button', { name: 'Save Plan', exact: true })).toBeDisabled();
  await adminPage.getByRole('button', { name: 'Edit Monday AM', exact: true }).click();
  const sheet = adminPage.getByRole('dialog', { name: 'Monday AM', exact: true });
  await sheet.getByRole('radio', { name: 'OYO', exact: true }).click();
  await sheet.getByRole('radio', { name: 'Zone E', exact: true }).locator('..').click();
  await sheet.getByLabel('Session Text', { exact: true }).fill(text);
  await sheet.getByRole('button', { name: 'Apply To Draft', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await adminPage.getByLabel('Week Total Label', { exact: true }).fill(label);
  await adminPage.getByRole('radio', { name: 'Week 2', exact: true }).click();
  await adminPage.getByRole('radio', { name: 'Week 1', exact: true }).click();
  await expect(adminPage.getByLabel('Week Total Label', { exact: true })).toHaveValue(label);
  await adminPage.getByRole('link', { name: 'Back', exact: true }).click();
  const discard = adminPage.getByRole('dialog', { name: 'Discard Changes?', exact: true });
  await expect(discard).toContainText('unsaved training plan');
  await discard.getByRole('button', { name: 'Keep Editing', exact: true }).click();
  await expect(discard).not.toBeVisible();
  await adminPage.getByRole('radio', { name: 'Preview', exact: true }).click();
  const preview = adminPage.getByRole('region', { name: 'Week 1 Preview', exact: true });
  await expect(preview).toContainText(text);
  await expect(preview).toContainText(label);
  await adminPage.getByRole('button', { name: 'Save Plan', exact: true }).click();
  await expect(adminPage.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await adminPage.reload();
  await expect(adminPage.getByLabel('Week Total Label', { exact: true })).toHaveValue(label);
  await expect(
    adminPage.getByRole('button', { name: 'Edit Monday AM', exact: true }),
  ).toContainText(text);
  const response = await rower.context.request.get('/api/plan?group=normal');
  await expect(response).toBeOK();
  const plan: Plan = await response.json();
  expect(
    plan.slots.find((row) => row.week === 1 && row.day === 0 && row.slot === 'AM'),
  ).toMatchObject({ text, kind: 'oyo', zone: 'E' });
  expect(plan.totals.find((row) => row.week === 1)?.label).toBe(label);
  expect(plan.slots.every((row) => row.group_key === 'normal')).toBe(true);
});
