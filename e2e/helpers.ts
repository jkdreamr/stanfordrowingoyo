import type { Page } from '@playwright/test';
import type { Api, Modality, Zone } from '../shared/types';
import { equivalentMeters, formatMeters } from '../shared/math';
import { expect } from '@playwright/test';
import type { RowerSignup } from './api';
import type { Rower } from './fixtures';
import { csrfHeaders } from './api';

export { equivalentMeters, formatMeters };
export async function waitForSplash(page: Page) {
  await expect(page.locator('#launch-splash')).toHaveCount(0);
}
async function chooseNativeRadio(page: Page, name: string) {
  const radio = page.getByRole('radio', { name, exact: true });
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}
export async function openSettings(page: Page) {
  await page
    .getByRole('link', { name: 'Settings', exact: true })
    .or(page.getByRole('button', { name: 'Settings', exact: true }))
    .filter({ visible: true })
    .click();
}
export async function completeSignup(page: Page, signup: RowerSignup, teamCode: string) {
  await waitForSplash(page);
  await page.getByLabel('Team Join Code').fill(teamCode);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await chooseNativeRadio(page, signup.name);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await chooseNativeRadio(page, 'Normal Non-Frosh');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(signup.email);
  await page.getByLabel('Password', { exact: true }).fill(signup.password);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
}
export async function logEntry(
  page: Page,
  modality: Modality,
  zone: Zone,
  distance: number,
  title: string,
) {
  await page
    .locator('.shell-sidebar, .shell-tabbar')
    .getByRole('link', { name: 'Log Session', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel('Private', { exact: true })).toHaveCount(0);
  await page
    .getByRole('radio', {
      name: modality === 'erg' ? 'Erg' : modality === 'bike' ? 'Bike' : 'Run',
      exact: true,
    })
    .click();
  await chooseNativeRadio(page, `Zone ${zone}`);
  await page.getByRole('textbox', { name: 'Meters', exact: true }).fill(String(distance));
  await page.getByLabel('Title', { exact: true }).fill(title);
  await expect(
    page.getByText(
      `= ${formatMeters(equivalentMeters(distance, modality, zone)).replace(/ m$/, ' E-meters')}`,
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: /save|log workout/i }).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
}
export async function seedEntry(rower: Rower, title: string, distance = 10000) {
  const config = await rower.context.request.get('/api/config');
  await expect(config).toBeOK();
  const { today }: Api['GET /api/config']['response'] = await config.json();
  const body: Api['POST /api/entries']['request'] = {
    date: today,
    modality: 'erg',
    zone: 'E',
    distance_m: distance,
    title,
    notes: 'E2E workout',
    visibility: 'team',
  };
  const response = await rower.context.request.post('/api/entries', {
    data: body,
    headers: csrfHeaders,
  });
  await expect(response).toBeOK();
  return (await response.json()) as Api['POST /api/entries']['response'];
}
export function feedCard(page: Page, title: string) {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}
