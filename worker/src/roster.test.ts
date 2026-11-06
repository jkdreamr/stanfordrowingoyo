/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
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
  it('counts roster discovery attempts per IP, clears on success and resets after fifteen minutes', async () => {
    for (let i = 0; i < 9; i++)
      expect((await api('/auth/roster', 'POST', { team_code: 'wrong' })).status).toBe(403);
    expect((await api('/auth/roster', 'POST', { team_code: 'team-code' })).status).toBe(200);
    for (let i = 0; i < 10; i++) expect((await api('/auth/roster', 'POST', {})).status).toBe(403);
    const blocked = await api('/auth/roster', 'POST', { team_code: 'team-code' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('900');
    expect(
      (await api('/auth/roster', 'POST', { team_code: 'team-code' }, undefined, NOW, '127.0.0.2'))
        .status,
    ).toBe(200);
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
