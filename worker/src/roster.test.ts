/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RosterChoice,
  RosterRow,
  User,
  EntryDetail,
  Page,
  AuditLog,
} from '../../shared/types';
import { ROSTER } from '../../shared/seed';
import type { Env } from './index';
import { migrate, seedRoster } from './db/migrate';
import { setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import type { Row } from './db/row';
import type { Context } from './context';
import { byId } from './db/users';
import { patchRoster } from './routes/admin';
import { patch as patchProfile } from './routes/me';
const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User };
function api(
  path: string,
  method = 'GET',
  body?: unknown,
  client?: Client,
  time = NOW,
  ip = '127.0.0.1',
) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      'CF-Connecting-IP': ip,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
async function choices() {
  const response = await api('/auth/roster', 'POST', { team_code: 'team-code' });
  expect(response.status).toBe(200);
  return response.json<RosterChoice[]>();
}
async function signup(
  roster_id: string | undefined,
  email: string,
  extra: Record<string, unknown> = {},
): Promise<Client> {
  const response = await api('/auth/signup', 'POST', {
    roster_id,
    email,
    password: 'password123',
    team_code: 'team-code',
    ...extra,
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
async function admin() {
  return signup(undefined, 'JOSKOO@stanford.edu', { team_code: undefined });
}
beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      for (const table of [
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'entries',
        'images',
        'entry_images',
        'kudos',
        'comments',
        'notifications',
        'announcements',
        'audit_log',
        'presets',
        'plan_slots',
        'plan_totals',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});
describe('id-based roster signup', () => {
  it('rebuilds v2 roster in v3, seeds exact names/roles and is case-insensitively idempotent', async () => {
    await sql((storage) => {
      storage.sql.exec(
        'DROP TABLE roster; CREATE TABLE roster(email TEXT PRIMARY KEY,name TEXT,role TEXT,group_key TEXT,side TEXT,class_year INTEGER,added_by TEXT,created_at TEXT)',
      );
      storage.sql.exec(
        "INSERT INTO roster VALUES ('old@example.com','Josh','admin','normal',NULL,NULL,NULL,'2026-01-01')",
      );
      setSetting(storage, 'schema_version', 2);
      migrate(storage);
      const rows = storage.sql.exec<Row<RosterRow>>('SELECT * FROM roster ORDER BY name').toArray();
      expect(rows).toHaveLength(39);
      expect(rows.map((row) => row.name).sort()).toEqual(ROSTER.map((row) => row.name).sort());
      expect(rows.filter((row) => row.role === 'rower')).toHaveLength(35);
      expect(rows.filter((row) => row.role === 'coxswain')).toHaveLength(3);
      expect(rows.every((row) => row.group_key === null && row.claimed_by_user_id === null)).toBe(
        true,
      );
      expect(rows.find((row) => row.email)?.email).toBe('joskoo@stanford.edu');
      storage.sql.exec('UPDATE roster SET name=lower(name) WHERE email IS NOT NULL');
      seedRoster(storage);
      seedRoster(storage);
      migrate(storage);
      expect(storage.sql.exec('SELECT * FROM roster').toArray()).toHaveLength(39);
      expect(() =>
        storage.sql.exec(
          "INSERT INTO roster (id,name,email,role,created_at) VALUES ('duplicate','Other','JOSKOO@stanford.edu','admin','2026-01-01')",
        ),
      ).toThrow();
    });
  });
  it('gates the name list, returns only choices, claims row name/role/attributes and hides claimed names', async () => {
    for (const team_code of [undefined, 'wrong']) {
      for (const path of ['/auth/roster', '/auth/signup']) {
        const response = await api(path, 'POST', {
          team_code,
          email: 'rower@example.com',
          password: 'password123',
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: 'INVALID_TEAM_CODE' } });
      }
    }
    expect((await api('/admin/roster')).status).toBe(401);
    expect((await api('/users')).status).toBe(401);
    const list = await choices();
    expect(list).toHaveLength(38);
    expect(list.map((row) => row.name)).toEqual(list.map((row) => row.name).sort());
    expect(Object.keys(list[0]).sort()).toEqual(['id', 'name', 'role']);
    const row = list.find((row) => row.name === 'Marcus Albrecht')!;
    await sql((storage) =>
      storage.sql
        .exec('UPDATE roster SET side=?,class_year=? WHERE id=?', 'port', 2028, row.id)
        .toArray(),
    );
    const athlete = await signup(row.id, 'ROWER@example.com', { group_key: 'u23' });
    expect(athlete.user).toMatchObject({
      name: row.name,
      email: 'rower@example.com',
      role: 'rower',
      group_key: 'u23',
      side: 'port',
      class_year: 2028,
      on_leaderboard: true,
    });
    expect((await choices()).some((item) => item.id === row.id)).toBe(false);
    expect((await api('/admin/roster', 'GET', undefined, athlete)).status).toBe(403);
    await sql((storage) =>
      expect(
        storage.sql.exec('SELECT claimed_by_user_id FROM roster WHERE id=?', row.id).one(),
      ).toMatchObject({ claimed_by_user_id: athlete.user.id }),
    );
    const again = await api('/auth/signup', 'POST', {
      roster_id: row.id,
      email: 'other@example.com',
      password: 'password123',
      team_code: 'team-code',
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: 'ROSTER_CLAIMED' } });
  });
  it('requires a valid roster selection and rower group but ignores group input for coxswains', async () => {
    const list = await choices();
    const rower = list.find((row) => row.role === 'rower')!;
    const cox = list.find((row) => row.role === 'coxswain')!;
    for (const [body, status] of [
      [{}, 400],
      [{ roster_id: 'missing' }, 404],
      [{ roster_id: rower.id, group_key: 'invalid' }, 400],
    ] as const) {
      expect(
        (
          await api('/auth/signup', 'POST', {
            email: 'pick@example.com',
            password: 'password123',
            team_code: 'team-code',
            ...body,
          })
        ).status,
      ).toBe(status);
    }
    expect((await signup(rower.id, 'rower@example.com')).user.group_key).toBe('normal');
    expect((await signup(cox.id, 'cox@example.com', { group_key: 'invalid' })).user).toMatchObject({
      name: cox.name,
      role: 'coxswain',
      group_key: 'normal',
      on_leaderboard: false,
    });
  });
  it('bootstraps admin by bound email only and rejects mismatched or other-email selections', async () => {
    const bound = await sql((storage) =>
      storage.sql.exec<Row<RosterRow>>('SELECT * FROM roster WHERE email IS NOT NULL').one(),
    );
    expect((await choices()).some((row) => row.id === bound.id)).toBe(false);
    expect(
      (
        await api('/auth/signup', 'POST', {
          email: 'other@example.com',
          password: 'password123',
          team_code: 'team-code',
          roster_id: bound.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api('/auth/signup', 'POST', {
          email: bound.email,
          password: 'password123',
          roster_id: 'different',
        })
      ).status,
    ).toBe(400);
    const owner = await admin();
    expect(owner.user).toMatchObject({
      name: 'Joshua Koo',
      role: 'admin',
      group_key: 'normal',
      on_leaderboard: false,
    });
    expect(
      (await api('/auth/signup', 'POST', { email: bound.email, password: 'password123' })).status,
    ).toBe(409);
    await sql((storage) =>
      expect(() =>
        storage.sql.exec(
          'UPDATE roster SET claimed_by_user_id=? WHERE name=?',
          owner.user.id,
          'Marcus Albrecht',
        ),
      ).toThrow(),
    );
  });
  it('atomically allows only one concurrent claimant and rechecks email uniqueness after hashing', async () => {
    const list = await choices();
    const row = list[0];
    const results = await Promise.all(
      ['one@example.com', 'two@example.com'].map((email) =>
        api('/auth/signup', 'POST', {
          email,
          password: 'password123',
          roster_id: row.id,
          team_code: 'team-code',
        }),
      ),
    );
    expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await results.find((response) => response.status === 409)!.json()).toMatchObject({
      error: { code: 'ROSTER_CLAIMED' },
    });
    const sameEmail = await Promise.all(
      list.slice(1, 3).map((item) =>
        api('/auth/signup', 'POST', {
          email: 'same@example.com',
          password: 'password123',
          roster_id: item.id,
          team_code: 'team-code',
        }),
      ),
    );
    expect(sameEmail.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await sameEmail.find((response) => response.status === 409)!.json()).toMatchObject({
      error: { code: 'EMAIL_TAKEN' },
    });
    await sql((storage) =>
      expect(storage.sql.exec('SELECT * FROM users').toArray()).toHaveLength(2),
    );
  });
  it('shares twenty code failures across discovery/signup without clearing on valid codes, and expires per IP', async () => {
    for (let i = 0; i < 20; i++) {
      const response =
        i % 2 === 0
          ? await api('/auth/roster', 'POST', { team_code: 'wrong' })
          : await api('/auth/signup', 'POST', {
              email: `wrong${i}@example.com`,
              password: 'password123',
              team_code: 'wrong',
            });
      expect(response.status).toBe(403);
      if (i === 9 || i === 18) {
        expect((await api('/auth/roster', 'POST', { team_code: 'team-code' })).status).toBe(200);
        expect(
          (
            await api('/auth/signup', 'POST', {
              email: `valid${i}@example.com`,
              password: 'password123',
              team_code: 'team-code',
            })
          ).status,
        ).toBe(400);
      }
    }
    const correctSignup = {
      email: 'after-limit@example.com',
      password: 'password123',
      team_code: 'team-code',
    };
    for (const [path, body] of [
      ['/auth/roster', { team_code: 'team-code' }],
      ['/auth/signup', correctSignup],
    ] as const) {
      const blocked = await api(path, 'POST', body);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('Retry-After')).toBe('900');
    }
    expect(
      (
        await api('/auth/signup', 'POST', {
          email: 'joskoo@stanford.edu',
          password: 'password123',
          team_code: 'wrong',
        })
      ).status,
    ).toBe(201);
    await sql((storage) =>
      expect(
        storage.sql
          .exec<{ attempts: number }>(
            'SELECT attempts FROM rate_limits WHERE email=? AND ip=?',
            'team-code-failures',
            '127.0.0.1',
          )
          .one().attempts,
      ).toBe(20),
    );
    expect(
      (await api('/auth/roster', 'POST', { team_code: 'team-code' }, undefined, NOW, '127.0.0.2'))
        .status,
    ).toBe(200);
    expect(
      (
        await api(
          '/auth/signup',
          'POST',
          { ...correctSignup, team_code: 'wrong' },
          undefined,
          NOW,
          '127.0.0.2',
        )
      ).status,
    ).toBe(403);
    const almostExpired = await api(
      '/auth/roster',
      'POST',
      { team_code: 'team-code' },
      undefined,
      '2026-03-09T18:14:59Z',
    );
    expect(almostExpired.status).toBe(429);
    expect(almostExpired.headers.get('Retry-After')).toBe('1');
    expect(
      (
        await api(
          '/auth/roster',
          'POST',
          { team_code: 'team-code' },
          undefined,
          '2026-03-09T18:15:00Z',
        )
      ).status,
    ).toBe(200);
    expect(
      (await api('/auth/signup', 'POST', correctSignup, undefined, '2026-03-09T18:15:00Z')).status,
    ).toBe(400);
    expect(
      (await api('/auth/roster', 'POST', { team_code: 'wrong' }, undefined, '2026-03-09T18:15:00Z'))
        .status,
    ).toBe(403);
    await sql((storage) =>
      expect(
        storage.sql
          .exec<{ attempts: number }>(
            'SELECT attempts FROM rate_limits WHERE email=? AND ip=?',
            'team-code-failures',
            '127.0.0.1',
          )
          .one().attempts,
      ).toBe(1),
    );
  });
  it('does not count or cap valid discovery, including thirty requests from one IP', async () => {
    for (let i = 0; i < 30; i++)
      expect((await api('/auth/roster', 'POST', { team_code: ' TEAM-CODE ' })).status).toBe(200);
    await sql((storage) =>
      expect(
        storage.sql.exec('SELECT * FROM rate_limits WHERE email=?', 'team-code-failures').toArray(),
      ).toHaveLength(0),
    );
  });
  it('counts a code invalidated during signup hashing even when the claim transaction never commits', async () => {
    const roster_id = (await choices())[0].id;
    const original = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
      const result = await original(...args);
      await sql((storage) => setSetting(storage, 'team_code', 'rotated-code'));
      return result;
    });
    try {
      expect(
        (
          await api('/auth/signup', 'POST', {
            roster_id,
            email: 'code-race@example.com',
            password: 'password123',
            team_code: 'team-code',
          })
        ).status,
      ).toBe(403);
      await sql((storage) => {
        expect(
          storage.sql
            .exec<{ attempts: number }>(
              'SELECT attempts FROM rate_limits WHERE email=? AND ip=?',
              'team-code-failures',
              '127.0.0.1',
            )
            .one().attempts,
        ).toBe(1);
        expect(
          storage.sql.exec('SELECT id FROM users WHERE email=?', 'code-race@example.com').toArray(),
        ).toHaveLength(0);
      });
    } finally {
      spy.mockRestore();
    }
  });
});
describe('unlink and account reuse', () => {
  it('deactivates, kills sessions, releases the name and reuses the inactive account with its entries', async () => {
    const owner = await admin();
    const list = await choices();
    const first = list.find((row) => row.role === 'rower')!;
    const second = list.filter((row) => row.role === 'rower')[1];
    const athlete = await signup(first.id, 'athlete@example.com');
    const entryResponse = await api(
      '/entries',
      'POST',
      {
        date: '2026-03-09',
        modality: 'erg',
        zone: 'E',
        distance_m: 10000,
        title: 'Keep my training',
        notes: '',
        visibility: 'team',
      },
      athlete,
    );
    expect(entryResponse.status).toBe(201);
    const entry = await entryResponse.json<EntryDetail>();
    const unlink = await api('/admin/roster/' + first.id + '/unlink', 'POST', undefined, owner);
    expect(unlink.status).toBe(200);
    expect(await unlink.json()).toMatchObject({ id: first.id, claimed_by_user_id: null });
    expect((await api('/me', 'GET', undefined, athlete)).status).toBe(401);
    expect((await choices()).some((row) => row.id === first.id)).toBe(true);
    expect(
      (await api('/auth/login', 'POST', { email: athlete.user.email, password: 'password123' }))
        .status,
    ).toBe(403);
    const rejoined = await signup(second.id, 'ATHLETE@example.com', {
      password: 'newpassword123',
      group_key: 'frosh',
    });
    expect(rejoined.user).toMatchObject({
      id: athlete.user.id,
      name: second.name,
      active: true,
      must_change_password: false,
      group_key: 'frosh',
    });
    expect((await api('/entries/' + entry.id, 'GET', undefined, rejoined)).status).toBe(200);
    expect(
      (await api('/auth/login', 'POST', { email: athlete.user.email, password: 'password123' }))
        .status,
    ).toBe(401);
    expect(
      (await api('/auth/login', 'POST', { email: athlete.user.email, password: 'newpassword123' }))
        .status,
    ).toBe(200);
    const logs = await (await api('/admin/audit', 'GET', undefined, owner)).json<Page<AuditLog>>();
    expect(logs.items).toHaveLength(1);
    expect(logs.items[0]).toMatchObject({ action: 'roster.unlink', target: first.id });
    await sql((storage) =>
      expect(
        storage.sql.exec('SELECT * FROM users WHERE email=?', athlete.user.email).toArray(),
      ).toHaveLength(1),
    );
  });
  it('rejects unlinking missing, unclaimed or own rows, enforces admin-target permissions and refuses inactive-but-linked reuse', async () => {
    const owner = await admin();
    const list = await choices();
    const coxRow = list.find((row) => row.role === 'coxswain')!;
    const row = list.find((row) => row.role === 'rower')!;
    const cox = await signup(coxRow.id, 'cox@example.com');
    const athlete = await signup(row.id, 'athlete@example.com');
    expect(
      (await api('/admin/roster/' + row.id + '/unlink', 'POST', undefined, athlete)).status,
    ).toBe(403);
    expect((await api('/admin/roster/missing/unlink', 'POST', undefined, cox)).status).toBe(404);
    const empty = list.find((item) => item.id !== row.id && item.id !== coxRow.id)!;
    const notClaimed = await api('/admin/roster/' + empty.id + '/unlink', 'POST', undefined, cox);
    expect(notClaimed.status).toBe(409);
    expect(await notClaimed.json()).toMatchObject({ error: { code: 'NOT_CLAIMED' } });
    expect(
      (await api('/admin/roster/' + coxRow.id + '/unlink', 'POST', undefined, cox)).status,
    ).toBe(409);
    const adminRow = await sql((storage) =>
      storage.sql
        .exec<Row<RosterRow>>('SELECT * FROM roster WHERE email=?', 'joskoo@stanford.edu')
        .one(),
    );
    expect(
      (await api('/admin/roster/' + adminRow.id + '/unlink', 'POST', undefined, cox)).status,
    ).toBe(403);
    expect(
      (await api('/admin/roster/' + adminRow.id + '/unlink', 'POST', undefined, owner)).status,
    ).toBe(409);
    expect(
      (await api('/admin/users/' + athlete.user.id, 'PATCH', { active: false }, owner)).status,
    ).toBe(200);
    const retry = await api('/auth/signup', 'POST', {
      email: athlete.user.email,
      password: 'password123',
      team_code: 'team-code',
      roster_id: empty.id,
    });
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({ error: { code: 'EMAIL_TAKEN' } });
    expect((await api('/admin/roster/' + row.id + '/unlink', 'POST', undefined, cox)).status).toBe(
      200,
    );
    const secondAdminId = await sql((storage) =>
      insertRosterFixture(storage, 'Other Admin', 'admin', 'otheradmin@example.com'),
    );
    await signup(secondAdminId, 'otheradmin@example.com', { team_code: undefined });
    expect(
      (await api('/admin/roster/' + secondAdminId + '/unlink', 'POST', undefined, owner)).status,
    ).toBe(200);
  });
});
describe('staff roster editing and profile synchronization', () => {
  async function roster(client: Client) {
    return (await api('/admin/roster', 'GET', undefined, client)).json<RosterRow[]>();
  }
  async function create(client: Client, body: Record<string, unknown>) {
    const response = await api('/admin/roster', 'POST', body, client);
    expect(response.status).toBe(201);
    return response.json<RosterRow>();
  }
  it('validates creation, normalizes optional email, rejects case-insensitive duplicates and audits unclaimed deletion', async () => {
    const owner = await admin();
    const coxRow = (await choices()).find((row) => row.role === 'coxswain')!;
    const cox = await signup(coxRow.id, 'cox@example.com');
    const blank = await create(cox, { name: '  New athlete  ', role: 'rower' });
    expect(blank).toMatchObject({
      name: 'New athlete',
      email: null,
      group_key: null,
      side: null,
      class_year: null,
      claimed_by_user_id: null,
      added_by: cox.user.id,
    });
    expect(blank.id).toBeTruthy();
    const bound = await create(cox, {
      name: 'Email athlete',
      email: ' Mixed@Example.com ',
      role: 'rower',
      group_key: 'frosh',
      side: 'port',
      class_year: 2029,
    });
    expect(bound.email).toBe('mixed@example.com');
    for (const body of [
      { name: 'new ATHLETE', role: 'rower' },
      { name: 'Different', role: 'rower', email: 'MIXED@example.com' },
    ])
      expect((await api('/admin/roster', 'POST', body, cox)).status).toBe(409);
    for (const body of [
      { name: '', role: 'rower' },
      { name: 'x'.repeat(81), role: 'rower' },
      { name: 'Invalid email', role: 'rower', email: 'bad' },
      { name: 'Bad group', role: 'rower', group_key: 'bad' },
      { name: 'Bad side', role: 'rower', side: 'bad' },
      { name: 'Bad year', role: 'rower', class_year: 1900 },
    ])
      expect((await api('/admin/roster', 'POST', body, cox)).status).toBe(400);
    expect(
      (await api('/admin/roster', 'POST', { name: 'New admin', role: 'admin' }, cox)).status,
    ).toBe(403);
    const adminRow = await create(owner, { name: 'New admin', role: 'admin', email: null });
    expect(
      (await api('/admin/roster/' + adminRow.id, 'PATCH', { group_key: 'invalid' }, cox)).status,
    ).toBe(403);
    expect(
      (await api('/admin/roster/' + adminRow.id, 'PATCH', { name: 'Not allowed' }, cox)).status,
    ).toBe(403);
    expect((await api('/admin/roster/' + adminRow.id, 'DELETE', undefined, cox)).status).toBe(403);
    expect((await api('/admin/roster/' + adminRow.id, 'DELETE', undefined, owner)).status).toBe(
      204,
    );
    expect((await api('/admin/roster/' + blank.id, 'DELETE', undefined, cox)).status).toBe(204);
    const logs = await (await api('/admin/audit', 'GET', undefined, owner)).json<Page<AuditLog>>();
    expect(
      logs.items
        .filter((row) => row.target === blank.id)
        .map((row) => row.action)
        .sort(),
    ).toEqual(['roster.create', 'roster.delete']);
  });
  it('partially patches claimed rows and propagates only supplied identity fields to the linked user', async () => {
    const owner = await admin();
    const list = await choices();
    const selected = list.find((row) => row.role === 'rower')!;
    const athlete = await signup(selected.id, 'athlete@example.com', { group_key: 'u23' });
    const response = await api(
      '/admin/roster/' + selected.id,
      'PATCH',
      { name: ' Renamed athlete ' },
      owner,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Renamed athlete',
      group_key: null,
      claimed_by_user_id: athlete.user.id,
    });
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      name: 'Renamed athlete',
      group_key: 'u23',
    });
    expect(
      (
        await api(
          '/admin/roster/' + selected.id,
          'PATCH',
          { role: 'coach', group_key: 'frosh', side: 'starboard', class_year: 2030 },
          owner,
        )
      ).status,
    ).toBe(200);
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      role: 'coach',
      group_key: 'frosh',
      side: 'starboard',
      class_year: 2030,
    });
    expect(
      (
        await api(
          '/admin/roster/' + selected.id,
          'PATCH',
          { group_key: null, side: null, class_year: null },
          owner,
        )
      ).status,
    ).toBe(200);
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      group_key: 'normal',
      side: null,
      class_year: null,
    });
    expect(
      (
        await api(
          '/admin/roster/' + selected.id,
          'PATCH',
          { name: list.find((row) => row.id !== selected.id)!.name },
          owner,
        )
      ).status,
    ).toBe(409);
    const bound = await create(owner, { name: 'Bound', role: 'rower', email: 'bound@example.com' });
    expect(
      (await api('/admin/roster/' + selected.id, 'PATCH', { email: 'BOUND@example.com' }, owner))
        .status,
    ).toBe(409);
    expect((await api('/admin/roster/' + selected.id, 'DELETE', undefined, owner)).status).toBe(
      409,
    );
    expect((await api('/admin/roster/' + selected.id, 'PATCH', {}, owner)).status).toBe(200);
    const updated = (await roster(owner)).find((row) => row.id === selected.id)!;
    expect(updated).toMatchObject({ name: 'Renamed athlete', email: null, role: 'coach' });
    expect(bound.id).not.toBe(selected.id);
    expect(
      (await api('/admin/roster/' + selected.id + '/unlink', 'POST', undefined, owner)).status,
    ).toBe(200);
    expect((await api('/admin/roster/' + selected.id, 'DELETE', undefined, owner)).status).toBe(
      204,
    );
  });
  it('enforces granting/revoking admin and last-admin protection for linked users', async () => {
    const owner = await admin();
    const list = await choices();
    const cox = await signup(list.find((row) => row.role === 'coxswain')!.id, 'cox@example.com');
    const row = list.find((row) => row.role === 'rower')!;
    const athlete = await signup(row.id, 'athlete@example.com');
    expect((await api('/admin/roster/' + row.id, 'PATCH', { role: 'admin' }, cox)).status).toBe(
      403,
    );
    const ownerRow = (await roster(owner)).find((row) => row.claimed_by_user_id === owner.user.id)!;
    expect(
      (
        await api(
          '/admin/roster/' + ownerRow.id,
          'PATCH',
          { role: 'rower', name: 'Should roll back' },
          owner,
        )
      ).status,
    ).toBe(409);
    expect((await roster(owner)).find((row) => row.id === ownerRow.id)?.name).toBe('Joshua Koo');
    const rejectedImport = await (
      await api(
        '/admin/roster/import',
        'POST',
        { csv: 'Joshua Koo,joskoo@stanford.edu,rower,normal,,' },
        owner,
      )
    ).json<{ imported: number; errors: { row: number; message: string }[] }>();
    expect(rejectedImport.imported).toBe(0);
    expect(rejectedImport.errors).toMatchObject([
      { row: 1, message: 'The last active admin cannot be demoted or deactivated.' },
    ]);
    expect((await api('/admin/roster/' + row.id, 'PATCH', { role: 'admin' }, owner)).status).toBe(
      200,
    );
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      role: 'admin',
    });
    expect((await api('/admin/roster/' + row.id, 'PATCH', { role: 'rower' }, cox)).status).toBe(
      403,
    );
    expect(
      (await api('/admin/roster/' + ownerRow.id, 'PATCH', { role: 'coach' }, athlete)).status,
    ).toBe(200);
    expect(await (await api('/me', 'GET', undefined, owner)).json()).toMatchObject({
      role: 'coach',
    });
    expect((await api('/admin/roster/' + row.id, 'PATCH', { role: 'rower' }, athlete)).status).toBe(
      409,
    );
    // A user promoted separately from the roster must still be protected.
    const mismatch = list.filter((item) => item.role === 'rower' && item.id !== row.id)[0];
    const promoted = await signup(mismatch.id, 'promoted@example.com');
    expect(
      (await api('/admin/users/' + promoted.user.id, 'PATCH', { role: 'admin' }, athlete)).status,
    ).toBe(200);
    expect(
      (await api('/admin/roster/' + mismatch.id, 'PATCH', { role: 'rower' }, cox)).status,
    ).toBe(403);
  });
  it('imports email/name matches as updates, inserts new rows, propagates changes and reports conflicts per row', async () => {
    const owner = await admin();
    const list = await choices();
    const selected = list.find((row) => row.role === 'rower')!;
    const athlete = await signup(selected.id, 'athlete@example.com');
    const bound = await create(owner, {
      name: 'Email match',
      email: 'match@example.com',
      role: 'rower',
    });
    const csv = [
      'name,email,role,group,side,class_year',
      'Email renamed,MATCH@example.com,coach,u23,both,2029',
      selected.name.toUpperCase() + ',,rower,frosh,port,2028',
      'Brand new,,coxswain,,,',
      'Brand new,new@example.com,rower,normal,,',
      'Bound insert,insert@example.com,rower,normal,,',
      'Bad,bad-email,rower,normal,,',
    ].join('\r\n');
    const response = await api('/admin/roster/import', 'POST', { csv }, owner);
    expect(response.status).toBe(200);
    const result = await response.json<{ imported: number; errors: { row: number }[] }>();
    expect(result.imported).toBe(4);
    expect(result.errors.map((row) => row.row)).toEqual([5, 7]);
    let rows = await roster(owner);
    expect(rows.find((row) => row.id === bound.id)).toMatchObject({
      name: 'Email renamed',
      role: 'coach',
      group_key: 'u23',
    });
    expect(rows.filter((row) => row.name === 'Brand new')).toHaveLength(1);
    expect(rows.find((row) => row.id === selected.id)).toMatchObject({
      name: selected.name.toUpperCase(),
      claimed_by_user_id: athlete.user.id,
    });
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      name: selected.name.toUpperCase(),
      group_key: 'frosh',
      side: 'port',
      class_year: 2028,
    });
    const noEmail =
      'name,role,group,side,class_year\n' +
      selected.name +
      ',rower,u23,both,2031\nFive columns,coach,,, \nEmail renamed,coach,normal,,';
    expect(
      await (await api('/admin/roster/import', 'POST', { csv: noEmail }, owner)).json(),
    ).toEqual({ imported: 3, errors: [] });
    rows = await roster(owner);
    expect(rows.filter((row) => row.id === selected.id)).toHaveLength(1);
    expect(rows.find((row) => row.name === 'Five columns')?.email).toBeNull();
    expect(rows.find((row) => row.id === bound.id)?.email).toBe('match@example.com');
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      name: selected.name,
      group_key: 'u23',
      side: 'both',
      class_year: 2031,
    });
    const cox = await signup(list.find((row) => row.role === 'coxswain')!.id, 'cox@example.com');
    const ownerRow = rows.find((row) => row.claimed_by_user_id === owner.user.id)!;
    const forbidden = [
      ownerRow.name + ',,rower,normal,,',
      'New admin,,admin,normal,,',
      'Allowed after,,rower,normal,,',
    ].join('\n');
    const errors = await (
      await api('/admin/roster/import', 'POST', { csv: forbidden }, cox)
    ).json<{ imported: number; errors: { row: number }[] }>();
    expect(errors.imported).toBe(1);
    expect(errors.errors.map((row) => row.row)).toEqual([1, 2]);
    expect(await (await api('/admin/roster/import', 'POST', { csv: '' }, owner)).json()).toEqual({
      imported: 0,
      errors: [],
    });
  });
  it('keeps profile group edits local to the user and synchronizes names atomically with uniqueness checks', async () => {
    const owner = await admin();
    const list = await choices();
    const selected = list.find((row) => row.role === 'rower')!;
    const athlete = await signup(selected.id, 'athlete@example.com');
    expect(
      (await api('/me', 'PATCH', { name: '  Self renamed  ', group_key: 'u23' }, athlete)).status,
    ).toBe(200);
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      name: 'Self renamed',
      group_key: 'u23',
    });
    expect((await roster(owner)).find((row) => row.id === selected.id)).toMatchObject({
      name: 'Self renamed',
      group_key: null,
    });
    for (const group_key of ['bad', null, 5])
      expect((await api('/me', 'PATCH', { group_key }, athlete)).status).toBe(400);
    expect(
      (await api('/me', 'PATCH', { name: 'Joshua Koo', group_key: 'frosh' }, athlete)).status,
    ).toBe(409);
    expect(await (await api('/me', 'GET', undefined, athlete)).json()).toMatchObject({
      name: 'Self renamed',
      group_key: 'u23',
    });
    expect((await api('/me', 'PATCH', {}, athlete)).status).toBe(200);
    expect(
      (await (await api('/admin/audit', 'GET', undefined, owner)).json<Page<AuditLog>>()).items,
    ).toEqual([]);
  });
  it('reads target and actor state only after the body resolves, and rejects a session revoked while parsing', async () => {
    const owner = await admin();
    const selected = (await choices()).find((row) => row.role === 'rower')!;
    await sql(async (storage) => {
      const user = byId(storage, owner.user.id);
      const tokenHash = storage.sql
        .exec<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE user_id=?', user.id)
        .one().token_hash;
      function context(params: Record<string, string> = {}) {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const request = new Request('https://oyo.test/api/admin/roster/' + selected.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: new ReadableStream<Uint8Array>({
            start(value) {
              controller = value;
            },
          }),
        });
        const ctx: Context = {
          request,
          storage,
          env: bindings,
          now: new Date(NOW),
          params,
          user,
          tokenHash,
        };
        return {
          ctx,
          send(body: unknown) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
            controller.close();
          },
        };
      }
      const update = context({ id: selected.id });
      const pending = patchRoster(update.ctx);
      storage.sql.exec(
        'UPDATE roster SET side=?,class_year=?,group_key=? WHERE id=?',
        'port',
        2030,
        'u23',
        selected.id,
      );
      update.send({ name: 'Fresh target' });
      expect((await pending).status).toBe(200);
      expect(
        storage.sql
          .exec('SELECT side,class_year,group_key FROM roster WHERE id=?', selected.id)
          .one(),
      ).toMatchObject({ side: 'port', class_year: 2030, group_key: 'u23' });
      const demoted = context({ id: selected.id });
      const forbidden = patchRoster(demoted.ctx);
      storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'rower', user.id);
      demoted.send({ role: 'admin' });
      await expect(forbidden).rejects.toMatchObject({ status: 403 });
      expect(
        storage.sql.exec('SELECT role FROM roster WHERE id=?', selected.id).one(),
      ).toMatchObject({ role: 'rower' });
      storage.sql.exec('UPDATE users SET role=? WHERE id=?', 'admin', user.id);
      const logout = context();
      const profile = patchProfile(logout.ctx);
      storage.sql.exec('DELETE FROM sessions WHERE user_id=?', user.id);
      logout.send({ name: 'Must not rename', group_key: 'frosh' });
      await expect(profile).rejects.toMatchObject({ status: 401 });
      expect(byId(storage, user.id).name).toBe('Joshua Koo');
    });
  });
});
