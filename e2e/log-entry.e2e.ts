import { test, expect } from './fixtures';
import { logEntry, equivalentMeters, formatMeters } from './helpers';

for (const workout of [
  { modality: 'bike', zone: 'E', distance: 60000 },
  { modality: 'erg', zone: 'D', distance: 12000 },
  { modality: 'run', zone: 'E', distance: 6240 },
] as const) {
  test(`log ${workout.modality} ${workout.zone} ${workout.distance}`, async ({ makeRower }) => {
    test.fixme(
      true,
      'Screen Log not built yet (web/src/pages/Log.tsx is a stub) — enable when it lands',
    );
    const { page } = await makeRower();
    const title = `E2E ${workout.modality} workout`;
    await logEntry(page, workout.modality, workout.zone, workout.distance, title);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(
      page.getByText(
        formatMeters(equivalentMeters(workout.distance, workout.modality, workout.zone)),
        { exact: false },
      ),
    ).toBeVisible();
    if (workout.modality === 'bike') await expect(page.getByText(/20,000/)).toBeVisible();
  });
}
