import { test, expect } from './fixtures';
import { logEntry, equivalentMeters, formatMeters } from './helpers';

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
