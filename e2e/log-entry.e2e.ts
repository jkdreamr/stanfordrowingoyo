import { test, expect } from './fixtures';
import { logEntry, equivalentMeters, formatMeters } from './helpers';

test('normalizes keypad-only workout duration and split before saving numeric API values', async ({
  makeRower,
}) => {
  const { page } = await makeRower();
  await page.goto('/log');
  await page.getByLabel('Meters', { exact: true }).fill('12000');
  await page.getByRole('button', { name: 'Add Details', exact: true }).click();
  const duration = page.getByLabel('Time', { exact: true });
  const split = page.getByLabel('Split /500m', { exact: true });
  for (const input of [duration, split])
    await expect(input).toHaveAttribute('inputmode', 'decimal');
  await duration.fill('1.02.03');
  await duration.press('Tab');
  await expect(duration).toHaveValue('1:02:03');
  await duration.fill('42.00');
  await duration.press('Tab');
  await expect(duration).toHaveValue('42:00');
  await split.fill('1450');
  await split.press('Tab');
  await expect(split).toHaveValue('1:45.0');
  await duration.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('split-log.png') });
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/entries' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toMatchObject({ duration_s: 2520, avg_split_s: 105 });
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
});

for (const workout of [
  { modality: 'bike', zone: 'E', distance: 60000 },
  { modality: 'erg', zone: 'D', distance: 12000 },
  { modality: 'run', zone: 'E', distance: 6240 },
] as const) {
  test(`log ${workout.modality} ${workout.zone} ${workout.distance}`, async ({ makeRower }) => {
    const { page } = await makeRower();
    const title = `E2E ${workout.modality} workout`;
    await logEntry(page, workout.modality, workout.zone, workout.distance, title);
    const session = page.getByRole('link').filter({ hasText: title });
    await expect(session).toBeVisible();
    await expect(
      session.getByText(
        formatMeters(equivalentMeters(workout.distance, workout.modality, workout.zone)).replace(
          / m$/,
          '',
        ),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(session.getByText('E-meters', { exact: true })).toBeVisible();
    if (workout.modality === 'bike')
      await expect(session.getByText('20,000', { exact: true })).toBeVisible();
  });
}
