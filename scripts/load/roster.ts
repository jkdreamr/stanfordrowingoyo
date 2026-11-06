import type { Options } from './args.ts';
import type { Sample } from './stats.ts';
import type { LoadRosterRow } from './contract.ts';
import type { User } from '../../shared/types.ts';
import { Client, RequestError } from './http.ts';

export const loadEmail = (n: number) => `loadtest+${n}@example.com`;
export const loadName = (n: number) => `Load Test ${String(n).padStart(2, '0')}`;
export const isLoadEmail = (email: string) => /^loadtest\+\d+@example\.com$/.test(email);

export async function bootstrapAdmin(options: Options, samples: Sample[]) {
  if (!options.adminPassword)
    throw new Error('--admin-password or LOAD_ADMIN_PASSWORD is required for admin access');
  const client = new Client(options.baseUrl, samples, 'setup');
  const credentials = { email: options.adminEmail, password: options.adminPassword };
  try {
    await client.request('POST /api/auth/login', { body: credentials });
  } catch (error) {
    if (!(error instanceof RequestError) || ![401, 404].includes(error.status)) throw error;
    try {
      await client.request('POST /api/auth/signup', { body: credentials });
    } catch (error) {
      if (!(error instanceof RequestError) || error.status !== 400) throw error;
      await client.request('POST /api/auth/signup', {
        body: { ...credentials, name: 'Load Test Admin' },
      });
    }
  }
  const teamCode = options.teamCode ?? (await client.request('GET /api/admin/settings')).team_code;
  const rosterFlow = await detectRosterFlow(client, teamCode);
  console.log(`Signup flow: ${rosterFlow ? 'roster claims' : 'legacy'}`);
  return { client, teamCode, rosterFlow };
}

export async function detectRosterFlow(client: Client, teamCode: string) {
  try {
    await client.request('POST /api/auth/roster', { body: { team_code: teamCode } });
    return true;
  } catch (error) {
    if (error instanceof RequestError && [404, 405, 501].includes(error.status)) {
      const sample = client.samples.at(-1);
      if (sample) sample.expected = true;
      return false;
    }
    throw error;
  }
}

export async function prepareRoster(
  client: Client,
  users: number,
): Promise<Map<number, LoadRosterRow>> {
  const rows = await client.request('GET /api/admin/roster');
  const accounts = await client.request('GET /api/admin/users');
  const result = new Map<number, LoadRosterRow>();
  for (let n = 1; n <= users; n++) {
    const name = loadName(n);
    const matches = rows.filter((row) => row.name === name);
    const own = matches.find(
      (row) =>
        row.claimed_by_user_id &&
        accounts.some((user) => user.id === row.claimed_by_user_id && user.email === loadEmail(n)),
    );
    let row = own ?? matches.find((row) => !row.claimed_by_user_id);
    if (!row && matches.length)
      throw new Error(`${name} is claimed by a different user; refusing to reuse it`);
    if (!row)
      row = await client.request('POST /api/admin/roster', {
        body: { name, email: null, role: 'rower', group_key: null, side: null, class_year: null },
      });
    result.set(n, row);
  }
  return result;
}

export async function deactivateUsers(client: Client, users: User[]) {
  let count = 0;
  for (const user of users)
    if (isLoadEmail(user.email)) {
      await client.request('PATCH /api/admin/users/:id', {
        id: user.id,
        body: { active: false, on_leaderboard: false },
      });
      count++;
    }
  console.log(`Deactivated ${count} load-test users.`);
}
