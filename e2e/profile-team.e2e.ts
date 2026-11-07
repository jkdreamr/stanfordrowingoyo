import { test, expect } from './fixtures';
import { seedEntry, formatMeters } from './helpers';
import { csrfHeaders } from './api';

test('rower searches the team and opens another public profile', async ({ makeRower }) => {
  const author = await makeRower();
  const viewer = await makeRower();
  const title = `Public workout ${author.user.id}`;
  const entry = await seedEntry(author, title);
  const privateTitle = `Private workout ${author.user.id}`;
  const privateEntry = await author.context.request.post('/api/entries', {
    headers: csrfHeaders,
    data: {
      date: entry.date,
      modality: 'erg',
      zone: 'E',
      distance_m: 5000,
      title: privateTitle,
      notes: '',
      visibility: 'private',
    },
  });
  await expect(privateEntry).toBeOK();
  await viewer.page.goto('/feed');
  await viewer.page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(viewer.page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await viewer.page.getByLabel('Search Team', { exact: true }).fill(author.user.name.toUpperCase());
  await viewer.page.getByRole('link', { name: author.user.name, exact: false }).click();
  await expect(
    viewer.page.getByRole('heading', { name: author.user.name, exact: true }),
  ).toBeVisible();
  await expect(viewer.page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(viewer.page.getByText(privateTitle, { exact: true })).toHaveCount(0);
  await expect(viewer.page.getByText(author.user.email, { exact: true })).toHaveCount(0);
  await expect(viewer.page.getByRole('link', { name: 'Edit Profile', exact: true })).toHaveCount(0);
  const response = await viewer.context.request.get(`/api/stats/season?user=${author.user.id}`);
  await expect(response).toBeOK();
  const stats = await response.json();
  const chart = viewer.page.getByRole('region', { name: 'Season Mileage' });
  await expect(chart.getByText(formatMeters(stats.total_m), { exact: true })).toBeVisible();
  await chart.getByRole('button', { name: '1M', exact: true }).click();
  await expect(chart.getByRole('button', { name: '1M', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const plot = chart.getByRole('img', { name: /^Cumulative E-meters/ });
  await plot.focus();
  await plot.press('End');
  await expect(chart.locator('[aria-live="polite"]')).toContainText(formatMeters(stats.total_m));
  await plot.press('Escape');
  await expect(chart.getByRole('link', { name: 'Log Session', exact: true })).toHaveCount(0);
  await viewer.page.getByRole('button', { name: 'View Data', exact: true }).click();
  await expect(
    viewer.page.getByRole('table', { name: 'Weekly E-Meters and Targets' }),
  ).toBeVisible();
});
