import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import type { Api } from '../shared/types';
import type { ClaimSignup, LoadRosterInput, LoadRosterRow } from '../scripts/load/contract';

export const csrfHeaders = { 'X-OYO-CSRF': '1' };
export interface Bootstrap {
  teamCode: string;
  backendReady: boolean;
}
export interface RowerSignup {
  name: string;
  email: string;
  password: string;
  body: Api['POST /api/auth/signup']['request'] | ClaimSignup;
}

export async function discoverRoster(api: APIRequestContext, teamCode: string) {
  const response = await api.post('/api/auth/roster', {
    data: { team_code: teamCode },
    headers: csrfHeaders,
  });
  await expect(response).toBeOK();
  const choices: Api['POST /api/auth/roster']['response'] = await response.json();
  return choices;
}

export async function newRowerSignup(
  api: APIRequestContext,
  bootstrap: Bootstrap,
  project: string,
): Promise<RowerSignup> {
  const id = randomUUID();
  const name = `E2E ${project} ${id}`;
  const email = `e2e+${project}-${id}@example.com`;
  const password = 'e2e-dev-rower-password-1';
  const input: LoadRosterInput = {
    name,
    email: null,
    role: 'rower',
    group_key: null,
    side: null,
    class_year: null,
  };
  const response = await api.post('/api/admin/roster', { data: input, headers: csrfHeaders });
  await expect(response).toBeOK();
  const row: LoadRosterRow = await response.json();
  expect(row.name).toBe(name);
  expect(row.claimed_by_user_id).toBeNull();
  const choices = await discoverRoster(api, bootstrap.teamCode);
  expect(choices.some((choice) => choice.id === row.id && choice.name === name)).toBe(true);
  return {
    name,
    email,
    password,
    body: {
      email,
      password,
      team_code: bootstrap.teamCode,
      roster_id: row.id,
      group_key: 'normal',
    },
  };
}
