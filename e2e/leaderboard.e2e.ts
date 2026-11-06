import { test, expect } from './fixtures';
import { seedEntry } from './helpers';
import { csrfHeaders } from './api';

test('weekly percent ranks this test’s rowers relatively', async ({ makeRower }) => {
  test.fixme(
    true,
    'Screen Leaderboard not built yet (web/src/pages/Leaderboard.tsx is a stub) — enable when it lands',
  );
  const rowers = await Promise.all([makeRower(), makeRower(), makeRower()]);
  for (const [i, rower] of rowers.entries()) {
    await expect(
      await rower.context.request.put('/api/me/target', {
        data: { target_m: 50000 },
        headers: csrfHeaders,
      }),
    ).toBeOK();
    await seedEntry(rower, `Leaderboard ${rower.user.id}`, (i + 1) * 10000);
  }
  const page = rowers[0].page;
  await page.goto('/leaderboard');
  await page.getByRole('tab', { name: 'This Week %', exact: true }).click();
  const names = await page.getByRole('row').allTextContents();
  const positions = rowers.map((r) => names.findIndex((text) => text.includes(r.user.name)));
  for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
  expect(positions[2]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[0]);
  for (const [i, rower] of rowers.entries())
    await expect(page.getByRole('row').filter({ hasText: rower.user.name })).toContainText(
      `${(i + 1) * 20}%`,
    );
});
