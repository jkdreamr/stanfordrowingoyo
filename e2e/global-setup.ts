import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { request, expect } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import type { Api } from '../shared/types';
import { csrfHeaders } from './api';

export default async function globalSetup(config: FullConfig) {
  const directory = new URL('./.auth/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL('bootstrap.json', directory),
    JSON.stringify({ teamCode: '', backendReady: false }),
  );
  await writeFile(new URL('admin.json', directory), JSON.stringify({ cookies: [], origins: [] }));
  const api = await request.newContext({ baseURL: config.projects[0].use.baseURL });
  try {
    const credentials: Api['POST /api/auth/login']['request'] = {
      email: 'joskoo@stanford.edu',
      password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-dev-admin-password-1',
    };
    let response = await api.post('/api/auth/signup', {
      headers: csrfHeaders,
      data: { ...credentials, name: 'E2E Admin' } satisfies Api['POST /api/auth/signup']['request'],
    });
    if (response.status() === 409)
      response = await api.post('/api/auth/login', { data: credentials, headers: csrfHeaders });
    if (response.status() === 501) {
      console.log('E2E bootstrap: backend auth returns 501; backend-dependent tests will skip.');
      return;
    }
    await expect(response).toBeOK();
    const settings = await api.get('/api/admin/settings');
    await expect(settings).toBeOK();
    const { team_code }: Api['GET /api/admin/settings']['response'] = await settings.json();
    expect(team_code).toBeTruthy();
    await api.storageState({ path: fileURLToPath(new URL('admin.json', directory)) });
    await writeFile(
      new URL('bootstrap.json', directory),
      JSON.stringify({ teamCode: team_code, backendReady: true }),
    );
  } finally {
    await api.dispose();
  }
}
