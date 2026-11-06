import { test, expect } from './fixtures';
import { logEntry, equivalentMeters, formatMeters } from './helpers';

test('weekly target drives Home progress and remaining meters', async ({ makeRower }) => {
  test.fixme(
    true,
    'Screen WeeklyTarget not built yet (web/src/pages/WeeklyTarget.tsx is a stub) — enable when it lands; Me, Log and Home are also stubs',
  );
  const { page } = await makeRower();
  await page.goto('/me');
  await page.getByRole('link', { name: 'Set Weekly Target' }).click();
  await page.getByLabel(/weekly target/i).fill('50000');
  await page.getByRole('button', { name: /save/i }).click();
  await logEntry(page, 'bike', 'E', 60000, 'E2E target workout');
  await page.goto('/');
  const meters = equivalentMeters(60000, 'bike', 'E');
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String((meters / 50000) * 100),
  );
  await expect(page.getByText(/40%/)).toBeVisible();
  await expect(
    page.getByText(new RegExp(`${formatMeters(50000 - meters)}.*remaining`, 'i')),
  ).toBeVisible();
});
