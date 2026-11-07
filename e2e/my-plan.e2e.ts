import type { Page } from '@playwright/test';
import type { Config, MyPlan, Plan } from '../shared/types';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';

async function editSession(page: Page, note: string) {
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('radio', { name: 'Erg', exact: true }).click();
  await sheet.getByRole('radio', { name: 'Zone E', exact: true }).locator('..').click();
  await sheet.getByLabel('Meters', { exact: true }).fill('12000');
  await sheet.getByLabel('Note', { exact: true }).fill(note);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).not.toBeVisible();
}
test('personal fortnight copies a sample, logs today and remains owner-only', async ({
  makeRower,
}) => {
  const owner = await makeRower();
  const teammate = await makeRower();
  const { page, context, user } = owner;
  const config: Config = await (await context.request.get('/api/config')).json();
  const sampleResponse = await context.request.get(`/api/plan?group=${user.group_key}`);
  await expect(sampleResponse).toBeOK();
  const sample: Plan = await sampleResponse.json();
  const hasSample = sample.slots.some((row) => row.kind === 'oyo');
  await page.goto('/plan?tab=mine');
  await page
    .getByRole('button', { name: hasSample ? 'Start from Sample' : 'Start Blank', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Week 1', exact: true })).toBeVisible();
  let plan: MyPlan = await (await context.request.get('/api/me/plan')).json();
  expect(plan.start_date).toBe(config.current_week_start);
  if (hasSample) {
    expect(plan.sessions.length).toBe(sample.slots.filter((row) => row.kind === 'oyo').length);
    await page
      .getByRole('button', { name: /^Edit (AM|PM1|PM2) .* Week [12]$/ })
      .first()
      .click();
    await editSession(page, 'Fortnight Sample Session');
  }
  const day = Math.round(
    (Date.parse(`${config.today}T12:00:00Z`) -
      Date.parse(`${config.current_week_start}T12:00:00Z`)) /
      86400000,
  );
  const name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day];
  const todaySession = page
    .getByRole('button', { name: new RegExp(`^Edit (AM|PM1|PM2) ${name} Week 1$`) })
    .first();
  if (await todaySession.count()) await todaySession.click();
  else await page.getByRole('button', { name: `Add Session ${name} Week 1`, exact: true }).click();
  await editSession(page, 'Fortnight Steady');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Today's Plan", exact: true })).toBeVisible();
  const todayCard = page
    .locator('.ui-card')
    .filter({ has: page.getByRole('heading', { name: "Today's Plan", exact: true }) });
  const log = todayCard.getByRole('link', { name: /Fortnight Steady/ });
  await expect(log).toHaveAttribute('href', '/log?modality=erg&zone=E&distance=12000');
  await log.click();
  await expect(page.getByLabel('Meters', { exact: true })).toHaveValue('12000');
  await expect(page.getByRole('radio', { name: 'Erg', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Zone E', exact: true })).toBeChecked();
  await page.getByLabel('Title', { exact: true }).fill('Fortnight Steady');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: "Today's Plan", exact: true })).toBeVisible();
  await expect(todayCard.getByRole('link', { name: /Fortnight Steady/ })).toHaveAttribute(
    'href',
    /^\/entries\//,
  );
  await expect(todayCard.getByLabel('Completed', { exact: true })).toBeVisible();
  await page.goto('/plan?tab=mine');
  await expect(
    page.getByRole('link', { name: new RegExp(`View Completed .* ${name} Week 1`) }),
  ).toBeVisible();
  plan = await (await context.request.get('/api/me/plan')).json();
  expect(
    plan.sessions.some((row) => row.note === 'Fortnight Steady' && row.completed_entry_id),
  ).toBe(true);
  const otherPlan = await teammate.context.request.get('/api/me/plan');
  await expect(otherPlan).toBeOK();
  expect(await otherPlan.json()).toBeNull();
  await teammate.page.goto('/plan?tab=mine');
  await expect(
    teammate.page.getByRole('button', { name: 'Start Blank', exact: true }),
  ).toBeVisible();
  expect(
    (
      await teammate.context.request.delete(`/api/me/plan/${plan.start_date}`, {
        headers: csrfHeaders,
      })
    ).status(),
  ).toBe(404);
});
