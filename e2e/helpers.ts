import type { Page } from '@playwright/test';
import type { Api, Modality, Zone } from '../shared/types';
import { equivalentMeters, formatMeters } from '../shared/math';
import { expect } from './fixtures';
import type { Rower } from './fixtures';
import { csrfHeaders } from './api';

export { equivalentMeters, formatMeters };
export async function logEntry(
  page: Page,
  modality: Modality,
  zone: Zone,
  distance: number,
  title: string,
) {
  await page.goto('/log');
  await page.getByRole('button', { name: modality, exact: true }).click();
  await page.getByRole('button', { name: zone, exact: true }).click();
  await page.getByLabel(/distance/i).fill(String(distance));
  await page.getByLabel('Title', { exact: true }).fill(title);
  await expect(
    page.getByText(formatMeters(equivalentMeters(distance, modality, zone)), { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: /save|log workout/i }).click();
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
