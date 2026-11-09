/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  Api,
  AuditLog,
  EntryDetail,
  Page,
  Plan,
  Preset,
  RosterRow,
  Settings,
  User,
} from '../../shared/types';
import type { Env } from './index';
import { migrateLegacyFixture as migrate } from './migrationFixture';
import { setSetting } from './db/settings';
import { parseCsv } from './csv';
import { insertRosterFixture } from './testFixtures';
import { DIVE_ENABLED } from './games/features';
const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User; rosterId: string };
async function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower'): Promise<Client> {
  const email = name.toLowerCase() + '@example.com';
  const id = await sql((storage) =>
    insertRosterFixture(storage, name, role, role === 'rower' ? null : email),
  );
  const choices = await (
    await api('/auth/roster', undefined, 'POST', { team_code: 'team-code' })
  ).json<{ id: string }[]>();
  if (role === 'rower') expect(choices.some((row) => row.id === id)).toBe(true);
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: id,
    email,
    password: 'password123',
    team_code: 'team-code',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
    rosterId: id,
  };
}
const workout = {
  date: '2026-03-09',
  modality: 'erg',
  zone: 'E',
  distance_m: 10000,
  title: 'Workout',
  notes: '',
  visibility: 'team',
};
const rosterRow = {
  name: 'New',
  email: 'new@example.com',
  role: 'rower',
  group_key: 'normal',
  side: null,
  class_year: null,
};
const preset = {
  name: 'New preset',
  modality: 'erg',
  zone: 'E',
  distance_m: 10000,
  sort: 99,
  active: true,
};
const slot = {
  group_key: 'normal',
  week: 1,
  day: 0,
  slot: 'AM',
  kind: 'oyo',
  zone: 'D',
  text: 'Training',
};
// A mapped object makes additions to the shared contract a compile-time test failure.
const endpoints: Record<keyof Api, true> = {
  'GET /api/games/pinpoint/today': true,
  'POST /api/games/pinpoint/guess': true,
  'GET /api/games/perception/today': true,
  'POST /api/games/perception/start': true,
  'POST /api/games/perception/answer': true,
  'POST /api/games/connections/guess': true,
  'GET /api/games/wordguess/today': true,
  'POST /api/games/wordguess/guess': true,
  'GET /api/games/dive/today': true,
  'POST /api/games/dive/answers': true,
  'GET /api/games/dive/days/:date': true,
  'PATCH /api/games/dive/answers': true,
  'GET /api/games/connections/today': true,
  'POST /api/games/connections/check': true,
  'GET /api/games': true,
  'GET /api/games/access': true,
  'POST /api/games/:game/results': true,
  'GET /api/games/:game/results/me': true,
  'GET /api/games/:game/leaderboard': true,
  'GET /api/games/leaderboard': true,
  'GET /api/users/:id/tests': true,
  'POST /api/me/tests': true,
  'PATCH /api/me/tests/:id': true,
  'DELETE /api/me/tests/:id': true,
  'GET /api/stats/recap': true,
  'GET /api/stats/race': true,
  'GET /api/challenges': true,
  'GET /api/admin/challenges': true,
  'POST /api/admin/challenges': true,
  'PATCH /api/admin/challenges/:id': true,
  'POST /api/admin/challenges/:id/end': true,
  'DELETE /api/admin/challenges/:id': true,
  'GET /api/health': true,
  'POST /api/auth/signup': true,
  'POST /api/auth/roster': true,
  'POST /api/auth/login': true,
  'POST /api/auth/logout': true,
  'GET /api/me': true,
  'GET /api/me/intro': true,
  'POST /api/me/intro': true,
  'PATCH /api/me': true,
  'POST /api/me/password': true,
  'POST /api/me/password/verify': true,
  'POST /api/auth/passkey/options': true,
  'POST /api/auth/passkey/login': true,
  'GET /api/me/passkeys': true,
  'POST /api/me/passkeys/options': true,
  'POST /api/me/passkeys': true,
  'DELETE /api/me/passkeys/:id': true,
  'GET /api/me/target': true,
  'PUT /api/me/target': true,
  'GET /api/me/plan': true,
  'PUT /api/me/plan': true,
  'DELETE /api/me/plan/:start': true,
  'GET /api/me/export': true,
  'GET /api/me/export/workouts': true,
  'GET /api/me/push': true,
  'PUT /api/me/push': true,
  'DELETE /api/me/push': true,
  'GET /api/config': true,
  'GET /api/entries': true,
  'POST /api/entries': true,
  'GET /api/entries/:id': true,
  'PATCH /api/entries/:id': true,
  'DELETE /api/entries/:id': true,
  'GET /api/entries/:id/kudos': true,
  'POST /api/entries/:id/kudos': true,
  'DELETE /api/entries/:id/kudos': true,
  'GET /api/entries/:id/comments': true,
  'POST /api/entries/:id/comments': true,
  'DELETE /api/comments/:id': true,
  'PATCH /api/comments/:id': true,
  'POST /api/reports': true,
  'GET /api/admin/reports': true,
  'PATCH /api/admin/reports/:id': true,
  'POST /api/images': true,
  'GET /api/images/:id': true,
  'GET /api/stats/week': true,
  'GET /api/stats/season': true,
  'GET /api/leaderboard': true,
  'GET /api/users': true,
  'GET /api/users/:id': true,
  'GET /api/announcements': true,
  'GET /api/announcements/:id': true,
  'POST /api/announcements': true,
  'PATCH /api/announcements/:id': true,
  'DELETE /api/announcements/:id': true,
  'GET /api/notifications': true,
  'POST /api/notifications/read': true,
  'GET /api/plan': true,
  'GET /api/plan/example': true,
  'GET /api/admin/users': true,
  'PATCH /api/admin/users/:id': true,
  'POST /api/admin/users/:id/reset-password': true,
  'POST /api/admin/users/:id/remove': true,
  'GET /api/admin/roster': true,
  'POST /api/admin/roster': true,
  'PATCH /api/admin/roster/:id': true,
  'DELETE /api/admin/roster/:id': true,
  'POST /api/admin/roster/:id/unlink': true,
  'POST /api/admin/roster/import': true,
  'GET /api/admin/settings': true,
  'PATCH /api/admin/settings': true,
  'GET /api/admin/presets': true,
  'POST /api/admin/presets': true,
  'PATCH /api/admin/presets/:id': true,
  'DELETE /api/admin/presets/:id': true,
  'GET /api/admin/plan': true,
  'PUT /api/admin/plan': true,
  'POST /api/admin/recalculate': true,
  'GET /api/admin/compliance': true,
  'GET /api/admin/export': true,
  'GET /api/admin/audit': true,
};
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
        'push_subscriptions',
        'push_outbox',
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
describe('complete API and role permissions', () => {
  it('registers every shared Api endpoint without a 404/405/501 or server error', async () => {
    const staff = await user('Admin', 'admin');
    const rower = await user('Rower');
    const resetUser = await user('Reset');
    for (const endpoint of Object.keys(endpoints) as (keyof Api)[]) {
      // Each endpoint gets fresh resources so DELETE calls cannot invalidate later assertions.
      const entry = await (await api('/entries', rower, 'POST', workout)).json<EntryDetail>();
      const comment = await (
        await api('/entries/' + entry.id + '/comments', rower, 'POST', { body: 'Test' })
      ).json<{ id: string }>();
      const announcement = await (
        await api('/announcements', staff, 'POST', { title: 'News', body: 'Hello', pinned: false })
      ).json<{ id: string }>();
      const p = await (await api('/admin/presets', staff, 'POST', preset)).json<Preset>();
      await api('/admin/roster', staff, 'POST', rosterRow);
      const rosterId = (await (await api('/admin/roster', staff)).json<RosterRow[]>()).find(
        (row) => row.email === rosterRow.email,
      )!.id;
      const bytes = new Uint8Array(24);
      bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, 1);
      view.setUint32(20, 1);
      const image = await SELF.fetch('https://oyo.test/api/images', {
        method: 'POST',
        headers: { Cookie: staff.cookie, 'Content-Type': 'image/png', 'X-OYO-Test-Now': NOW },
        body: bytes,
      });
      const imageId = (await image.json<{ id: string }>()).id;
      const [method, template] = endpoint.split(' ');
      let path = template.slice(4);
      const testId = path.startsWith('/me/tests/')
        ? (
            await (
              await api('/me/tests', staff, 'POST', {
                kind: '2k',
                date: '2026-03-01',
                split_s: 100,
              })
            ).json<{ id: string }>()
          ).id
        : '';
      const challengeId = path.startsWith('/admin/challenges/')
        ? (
            await (
              await api('/admin/challenges', staff, 'POST', {
                title: 'Training',
                unit: 'emeters',
                goal_m: 10000,
                modality: null,
                start_date: '2026-03-01',
                end_date: '2026-03-31',
              })
            ).json<{ id: string }>()
          ).id
        : '';
      const id =
        testId ||
        challengeId ||
        (path.startsWith('/entries')
          ? entry.id
          : path.startsWith('/comments')
            ? comment.id
            : path.startsWith('/images')
              ? imageId
              : path.includes('/admin/roster/')
                ? rosterId
                : path.includes('/presets')
                  ? p.id
                  : path.startsWith('/announcements')
                    ? announcement.id
                    : path.endsWith('/reset-password')
                      ? resetUser.user.id
                      : rower.user.id);
      path = path
        .replace(':date', '2026-03-01')
        .replace(':game', 'wordguess')
        .replace(':id', id)
        .replace(':group', 'normal')
        .replace(':week', '1')
        .replace(':day', '0')
        .replace(':slot', 'AM')
        .replace(':start', '2026-03-09');
      if (endpoint === 'DELETE /api/me/plan/:start')
        await api('/me/plan', staff, 'PUT', {
          start_date: '2026-03-09',
          sessions: [],
          rest_days: [],
        });
      if (endpoint === 'DELETE /api/me/passkeys/:id')
        await sql((s) =>
          s.sql.exec(
            "INSERT INTO passkeys VALUES (?,?,-7,'{}',0,'[]','',0,0,'Passkey',?,NULL)",
            id,
            staff.user.id,
            NOW,
          ),
        );
      if (path === '/admin/export') path += '?start=2026-03-01&end=2026-03-10';
      const body =
        method === 'GET' || method === 'DELETE'
          ? undefined
          : path === '/auth/login'
            ? { email: staff.user.email, password: 'password123' }
            : path === '/auth/signup'
              ? {
                  name: 'Duplicate',
                  email: staff.user.email,
                  password: 'password123',
                  team_code: 'team-code',
                }
              : {};
      const response = await api(path, staff, method, body);
      if (!DIVE_ENABLED && path.startsWith('/games/dive/')) expect(response.status).toBe(404);
      else if (
        endpoint === 'POST /api/games/:game/results' ||
        endpoint === 'POST /api/games/connections/check'
      )
        expect(response.status).toBe(405);
      else expect([404, 405, 501, 500], endpoint).not.toContain(response.status);
      if (path === '/auth/logout') {
        const login = await api('/auth/login', undefined, 'POST', {
          email: staff.user.email,
          password: 'password123',
        });
        expect(login.status).toBe(200);
        staff.cookie = login.headers.get('Set-Cookie')!.split(';')[0];
      }
    }
  });
  it('rejects rowers on every admin endpoint and announcement creation', async () => {
    const rower = await user('Rower');
    for (const endpoint of Object.keys(endpoints).filter(
      (key) => key.includes('/api/admin/') || key === 'POST /api/announcements',
    )) {
      const [method, template] = endpoint.split(' ');
      const path = template
        .slice(4)
        .replace(':id', rower.user.id)
        .replace(':email', 'rower@example.com')
        .replace(':group', 'normal')
        .replace(':week', '1')
        .replace(':day', '0')
        .replace(':slot', 'AM');
      expect(
        (await api(path, rower, method, method === 'GET' || method === 'DELETE' ? undefined : {}))
          .status,
        endpoint,
      ).toBe(403);
    }
  });
  it('allows coxswain staff actions but enforces admin-only user and roster actions', async () => {
    const admin = await user('Admin', 'admin');
    const cox = await user('Cox', 'coxswain');
    const rower = await user('Rower');
    for (const path of [
      '/admin/users',
      '/admin/roster',
      '/admin/settings',
      '/admin/presets',
      '/admin/plan',
      '/admin/compliance',
      '/admin/audit',
      '/admin/export?start=2026-03-01&end=2026-03-10',
    ])
      expect((await api(path, cox)).status, path).toBe(200);
    expect(
      (await api('/admin/users/' + rower.user.id, cox, 'PATCH', { group_key: 'u23' })).status,
    ).toBe(200);
    expect((await api('/admin/roster', cox, 'POST', rosterRow)).status).toBe(201);
    expect((await api('/admin/presets', cox, 'POST', preset)).status).toBe(201);
    expect((await api('/admin/settings', cox, 'PATCH', { season_start: '09-02' })).status).toBe(
      200,
    );
    expect(
      (
        await api('/admin/plan', cox, 'PUT', {
          week_start: '2026-03-09',
          slots: [slot],
          totals: [],
        })
      ).status,
    ).toBe(200);
    expect(
      (await api('/announcements', cox, 'POST', { title: 'News', body: 'Hello', pinned: false }))
        .status,
    ).toBe(201);
    const forbidden: [string, string, unknown][] = [
      ['/admin/users/' + rower.user.id, 'PATCH', { role: 'admin' }],
      ['/admin/users/' + admin.user.id, 'PATCH', { role: 'rower' }],
      ['/admin/users/' + admin.user.id, 'PATCH', { active: false }],
      ['/admin/users/' + admin.user.id, 'PATCH', { group_key: 'frosh' }],
      ['/admin/users/' + admin.user.id + '/reset-password', 'POST', undefined],
      ['/admin/roster', 'POST', { ...rosterRow, email: 'newadmin@example.com', role: 'admin' }],
      ['/admin/roster/' + admin.rosterId, 'PATCH', { name: 'Changed' }],
      ['/admin/roster/' + admin.rosterId, 'DELETE', undefined],
    ];
    for (const [path, method, body] of forbidden)
      expect((await api(path, cox, method, body)).status, path).toBe(403);
    expect(
      (await api('/admin/users/' + rower.user.id, admin, 'PATCH', { role: 'admin' })).status,
    ).toBe(200);
    expect(
      (await api('/admin/roster/' + admin.rosterId, admin, 'PATCH', { name: 'Changed' })).status,
    ).toBe(200);
    expect(
      (await api('/admin/users/' + rower.user.id, admin, 'PATCH', { role: 'rower' })).status,
    ).toBe(200);
    expect(
      (await api('/admin/users/' + admin.user.id, admin, 'PATCH', { role: 'rower' })).status,
    ).toBe(409);
    expect(
      (await api('/admin/users/' + admin.user.id, admin, 'PATCH', { active: false })).status,
    ).toBe(409);
  });
});
describe('users, roster and passwords', () => {
  it('imports permitted CSV rows while reporting admin-only rows as individual errors', async () => {
    const admin = await user('Admin', 'admin');
    const cox = await user('Cox', 'coxswain');
    const csv = [
      'name,email,role,group,side,class_year',
      'Allowed,allowed@example.com,rower,normal,port,2028',
      'New admin,newadmin@example.com,admin,normal,,',
      'Changed admin,admin@example.com,rower,frosh,,',
      'Allowed cox,allowedcox@example.com,coxswain,normal,cox,2027',
    ].join('\r\n');
    const response = await api('/admin/roster/import', cox, 'POST', { csv });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      imported: 2,
      errors: [3, 4].map((row) => ({
        row,
        message: 'Only admins can add or change admin roster rows.',
      })),
    });
    const roster = await (await api('/admin/roster', admin)).json<RosterRow[]>();
    expect(roster.find((row) => row.email === 'allowed@example.com')).toMatchObject({
      role: 'rower',
    });
    expect(roster.find((row) => row.email === 'allowedcox@example.com')).toMatchObject({
      role: 'coxswain',
    });
    expect(roster.find((row) => row.email === 'admin@example.com')).toMatchObject({
      name: 'Admin',
      role: 'admin',
      group_key: 'normal',
    });
    expect(roster.some((row) => row.email === 'newadmin@example.com')).toBe(false);
    const logs = await (await api('/admin/audit', admin)).json<Page<AuditLog>>();
    expect(logs.items.map((row) => row.target).sort()).toEqual(
      roster
        .filter((row) =>
          ['allowed@example.com', 'allowedcox@example.com'].includes(row.email ?? ''),
        )
        .map((row) => row.id)
        .sort(),
    );
    const retry = await api('/admin/roster/import', admin, 'POST', {
      csv: csv.replace(
        'Changed admin,admin@example.com,rower',
        'Changed admin,admin@example.com,admin',
      ),
    });
    expect(await retry.json()).toEqual({ imported: 4, errors: [] });
  });
  it('deactivates sessions, validates patches and returns self/admin fields without hashes', async () => {
    const admin = await user('Admin', 'admin');
    const rower = await user('Rower');
    const rows = await (await api('/admin/users', admin)).json<User[]>();
    expect(rows.find((row) => row.id === rower.user.id)?.email).toBe(rower.user.email);
    expect(JSON.stringify(rows)).not.toMatch(/password_hash|password_salt/);
    for (const body of [
      { role: 'wrong' },
      { active: 1 },
      { on_leaderboard: 'yes' },
      { group_key: 'wrong' },
    ])
      expect((await api('/admin/users/' + rower.user.id, admin, 'PATCH', body)).status).toBe(400);
    expect(
      (await api('/admin/users/' + rower.user.id, admin, 'PATCH', { active: false })).status,
    ).toBe(200);
    expect((await api('/me', rower)).status).toBe(401);
    await sql((storage) =>
      expect(
        storage.sql.exec('SELECT * FROM sessions WHERE user_id = ?', rower.user.id).toArray(),
      ).toHaveLength(0),
    );
    expect((await api('/admin/users/missing', admin, 'PATCH', {})).status).toBe(404);
  });
  it('resets to an unambiguous temporary password, forces change and never audits secrets', async () => {
    const admin = await user('Admin', 'admin');
    const rower = await user('Rower');
    const cox = await user('Cox', 'coxswain');
    const response = await api('/admin/users/' + rower.user.id + '/reset-password', cox, 'POST');
    expect(response.status).toBe(200);
    const { temporary_password } = await response.json<{ temporary_password: string }>();
    expect(temporary_password).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{14}$/,
    );
    expect((await api('/me', rower)).status).toBe(401);
    const login = await api('/auth/login', undefined, 'POST', {
      email: rower.user.email,
      password: temporary_password,
    });
    expect(login.status).toBe(200);
    expect(await login.clone().json()).toMatchObject({ must_change_password: true });
    rower.cookie = login.headers.get('Set-Cookie')!.split(';')[0];
    expect((await api('/entries', rower)).status).toBe(403);
    expect((await api('/me', rower)).status).toBe(200);
    expect(
      (
        await api('/me/password', rower, 'POST', {
          new_password: 'newpassword123',
        })
      ).status,
    ).toBe(204);
    expect((await api('/entries', rower)).status).toBe(200);
    expect(
      (
        await api('/auth/login', undefined, 'POST', {
          email: rower.user.email,
          password: temporary_password,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await api('/auth/login', undefined, 'POST', {
          email: rower.user.email,
          password: 'newpassword123',
        })
      ).status,
    ).toBe(200);
    const logs = await (await api('/admin/audit', admin)).text();
    expect(logs).not.toContain(temporary_password);
    expect(logs).not.toMatch(/password_hash|password_salt|newpassword123/);
  });
  it('imports RFC4180 quoted rows with physical line errors and adopts imported role attributes on signup', async () => {
    const admin = await user('Admin', 'admin');
    const csv =
      'NAME,email,role,group,side,class_year\r\n"Last, ""First""",imported@example.com,coxswain,frosh,cox,2028\r\n"Multi\nLine",line@example.com,rower,u23,port,2027\r\nBad,not-email,rower,normal,,2029\r\nToo,few';
    const result = await (
      await api('/admin/roster/import', admin, 'POST', { csv })
    ).json<{ imported: number; errors: { row: number; message: string }[] }>();
    expect(result.imported).toBe(2);
    expect(result.errors.map((row) => row.row)).toEqual([5, 6]);
    const roster = await (await api('/admin/roster', admin)).json<RosterRow[]>();
    expect(roster.find((row) => row.email === 'imported@example.com')?.name).toBe('Last, "First"');
    expect(roster.find((row) => row.email === 'line@example.com')?.name).toBe('Multi\nLine');
    const signup = await api('/auth/signup', undefined, 'POST', {
      email: 'IMPORTED@example.com',
      password: 'password123',
    });
    expect(signup.status).toBe(201);
    expect(await signup.json()).toMatchObject({
      role: 'coxswain',
      group_key: 'frosh',
      side: 'cox',
      class_year: 2028,
      on_leaderboard: false,
    });
    expect(await (await api('/admin/roster/import', admin, 'POST', { csv: '' })).json()).toEqual({
      imported: 0,
      errors: [],
    });
    expect(
      (
        await (
          await api('/admin/roster/import', admin, 'POST', { csv: '"unterminated' })
        ).json<{ errors: unknown[] }>()
      ).errors,
    ).toHaveLength(1);
    expect(
      await (
        await api('/admin/roster/import', admin, 'POST', {
          csv: 'Updated,imported@example.com,rower,normal,,2029',
        })
      ).json(),
    ).toMatchObject({ imported: 1 });
    const created = await api('/admin/roster', admin, 'POST', rosterRow);
    expect(created.status).toBe(201);
    const createdRow = await created.json<RosterRow>();
    expect((await api('/admin/roster', admin, 'POST', rosterRow)).status).toBe(409);
    expect(
      (
        await api('/admin/roster/' + createdRow.id, admin, 'PATCH', {
          email: 'other@example.com',
          side: 'port',
        })
      ).status,
    ).toBe(200);
    expect((await api('/admin/roster/' + createdRow.id, admin, 'DELETE')).status).toBe(204);
    expect((await api('/admin/roster/' + createdRow.id, admin, 'DELETE')).status).toBe(404);
  });
});
describe('settings, presets, recalculation, export and audit', () => {
  it('audits only privileged moderation, not a staff user’s ordinary activity', async () => {
    const cox = await user('Cox', 'coxswain');
    const rower = await user('Rower');
    const other = await user('Other');
    const own = await (await api('/entries', cox, 'POST', workout)).json<EntryDetail>();
    const entry = await (await api('/entries', rower, 'POST', workout)).json<EntryDetail>();
    expect((await api('/entries/' + entry.id + '/kudos', cox, 'POST')).status).toBe(204);
    expect((await api('/me', cox, 'PATCH', { bio: 'Cox and athlete' })).status).toBe(200);
    const ownComment = await (
      await api('/entries/' + entry.id + '/comments', cox, 'POST', { body: 'Nice workout' })
    ).json<{ id: string }>();
    expect((await api('/comments/' + ownComment.id, cox, 'DELETE')).status).toBe(204);
    expect((await api('/entries/' + own.id, cox, 'PATCH', { title: 'My training' })).status).toBe(
      200,
    );
    expect((await api('/entries/' + own.id, cox, 'DELETE')).status).toBe(204);
    expect((await (await api('/admin/audit', cox)).json<Page<AuditLog>>()).items).toEqual([]);
    const comment = await (
      await api('/entries/' + entry.id + '/comments', rower, 'POST', { body: 'Needs moderation' })
    ).json<{ id: string; user_id: string; body: string }>();
    expect((await api('/comments/' + comment.id, other, 'DELETE')).status).toBe(403);
    expect((await api('/comments/' + comment.id, cox, 'DELETE')).status).toBe(204);
    expect((await api('/comments/' + comment.id, cox, 'DELETE')).status).toBe(404);
    const page = await (await api('/admin/audit', cox)).json<Page<AuditLog>>();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actor_id: cox.user.id,
      action: 'comment.delete',
      target: comment.id,
    });
    expect(JSON.parse(page.items[0].detail_json)).toMatchObject({
      before: { id: comment.id, user_id: rower.user.id, body: 'Needs moderation' },
      after: null,
    });
    expect((await api('/auth/logout', cox, 'POST')).status).toBe(204);
    await sql((storage) =>
      expect(storage.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(1),
    );
  });
  it('explicitly audits staff edits and deletions of another user’s entries', async () => {
    const cox = await user('Cox', 'coxswain');
    const rower = await user('Rower');
    const entry = await (await api('/entries', rower, 'POST', workout)).json<EntryDetail>();
    expect(
      (await api('/entries/' + entry.id, cox, 'PATCH', { title: 'Corrected workout' })).status,
    ).toBe(200);
    expect((await api('/entries/' + entry.id, cox, 'DELETE')).status).toBe(204);
    const page = await (await api('/admin/audit', cox)).json<Page<AuditLog>>();
    expect(page.items).toHaveLength(2);
    expect(page.items.every((row) => row.actor_id === cox.user.id && row.target === entry.id)).toBe(
      true,
    );
    expect(
      JSON.parse(page.items.find((row) => row.action === 'entry.update')!.detail_json),
    ).toMatchObject({ before: { title: 'Workout' }, after: { title: 'Corrected workout' } });
    expect(
      JSON.parse(page.items.find((row) => row.action === 'entry.delete')!.detail_json),
    ).toMatchObject({ before: { title: 'Corrected workout' }, after: null });
  });
  it('validates settings, preserves factor snapshots until recalculation and versions group defaults', async () => {
    const admin = await user('Admin', 'admin');
    const rower = await user('Rower');
    const settings = await (await api('/admin/settings', admin)).json<Settings>();
    for (const body of [
      { team_code: 'abc' },
      { team_code: 'bad!' },
      { zone_factors: { E: 1 } },
      { mode_factors: { erg: 0, bike: 1, run: 1 } },
      { group_targets: { normal: 80000 } },
      { group_targets: { frosh: 1, normal: 80000, u23: 100000 } },
      { season_start: '02-30' },
      { season_start: '13-01' },
    ])
      expect(
        (await api('/admin/settings', admin, 'PATCH', body)).status,
        JSON.stringify(body),
      ).toBe(400);
    expect((await api('/admin/settings', admin, 'PATCH', { team_code: 'koo26' })).status).toBe(200);
    expect((await (await api('/admin/settings', admin)).json<Settings>()).team_code).toBe('koo26');
    const choices = await (
      await api('/auth/roster', undefined, 'POST', { team_code: 'KOO26 ' })
    ).json<{ id: string }[]>();
    expect(
      (
        await api('/auth/signup', undefined, 'POST', {
          roster_id: choices[0].id,
          team_code: 'KOO26 ',
          email: 'short-code@example.com',
          password: 'password123',
        })
      ).status,
    ).toBe(201);
    expect((await api('/admin/settings', admin, 'PATCH', { team_code: ' four ' })).status).toBe(
      200,
    );
    expect((await (await api('/admin/settings', admin)).json<Settings>()).team_code).toBe('four');
    const old = await (await api('/entries', rower, 'POST', workout)).json<EntryDetail>();
    expect(
      (
        await api('/admin/settings', admin, 'PATCH', {
          mode_factors: { ...settings.mode_factors, erg: 2 },
          group_targets: { frosh: 50000, normal: 90000, u23: 110000 },
          team_code: 'new-secret-code',
        })
      ).status,
    ).toBe(200);
    expect((await (await api('/entries/' + old.id, rower)).json<EntryDetail>()).equiv_m).toBe(
      10000,
    );
    expect(
      (await (await api('/entries', rower, 'POST', workout)).json<EntryDetail>()).equiv_m,
    ).toBe(20000);
    expect(await (await api('/admin/recalculate', admin, 'POST')).json()).toEqual({ updated: 1 });
    expect(await (await api('/admin/recalculate', admin, 'POST')).json()).toEqual({ updated: 0 });
    expect((await (await api('/entries/' + old.id, rower)).json<EntryDetail>()).equiv_m).toBe(
      20000,
    );
    expect(
      (await (await api('/stats/week?week=2026-03-02', rower)).json<{ target_m: number }>())
        .target_m,
    ).toBe(80000);
    expect((await (await api('/stats/week', rower)).json<{ target_m: number }>()).target_m).toBe(
      90000,
    );
    await api('/admin/settings', admin, 'PATCH', {
      group_targets: { frosh: 55000, normal: 95000, u23: 115000 },
    });
    await sql((storage) =>
      expect(
        JSON.parse(
          storage.sql
            .exec<{ value_json: string }>(
              'SELECT value_json FROM settings WHERE key = ?',
              'group_target_history',
            )
            .one().value_json,
        ),
      ).toHaveLength(2),
    );
    expect(await (await api('/config', rower)).json()).toMatchObject({
      group_targets: { normal: 95000 },
    });
    const logs = await (await api('/admin/audit', admin)).text();
    expect(logs).not.toMatch(/new-secret-code|team-code/);
  });
  it('creates/patches/deletes presets and filters inactive presets from config', async () => {
    const cox = await user('Cox', 'coxswain');
    const create = await api('/admin/presets', cox, 'POST', { ...preset, distance_m: null });
    expect(create.status).toBe(201);
    const p = await create.json<Preset>();
    expect((await api('/admin/presets/' + p.id, cox, 'PATCH', { active: false })).status).toBe(200);
    expect(
      (await (await api('/config', cox)).json<{ presets: Preset[] }>()).presets.some(
        (row) => row.id === p.id,
      ),
    ).toBe(false);
    expect((await api('/admin/presets', cox, 'POST', { ...preset, zone: 'wrong' })).status).toBe(
      400,
    );
    expect((await api('/admin/presets/' + p.id, cox, 'DELETE')).status).toBe(204);
    expect((await api('/admin/presets/' + p.id, cox, 'DELETE')).status).toBe(404);
  });
  it('exports escaped CRLF CSV with formula guards and compliance includes hidden active rowers', async () => {
    const admin = await user('Admin', 'admin');
    const rower = await user('Rower');
    const empty = await user('Empty');
    await api('/entries', rower, 'POST', {
      ...workout,
      title: '=SUM(1,2)',
      notes: 'Comma, "quote"\nnext line',
    });
    await api('/admin/users/' + rower.user.id, admin, 'PATCH', { on_leaderboard: false });
    const response = await api('/admin/export?start=2026-03-01&end=2026-03-10', admin);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toContain(
      'oyo-entries-2026-03-01-to-2026-03-10.csv',
    );
    const text = await response.text();
    expect(text).toContain('"\'=SUM(1,2)"');
    expect(text).toContain('"Comma, ""quote""\nnext line"');
    expect(text.endsWith('\r\n')).toBe(true);
    const parsed = parseCsv(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].cells).toHaveLength(19);
    expect(parsed[1].cells[17]).toBe('Comma, "quote"\nnext line');
    expect(parsed[1].cells[3]).toBe(rower.user.email);
    expect((await api('/admin/export', admin)).status).toBe(400);
    expect((await api('/admin/export?start=2026-03-10&end=2026-03-01', admin)).status).toBe(400);
    const compliance = await (
      await api('/admin/compliance', admin)
    ).json<{ user: { id: string }; last_log: string | null; total_m: number }[]>();
    expect(compliance.map((row) => row.user.id)).toContain(rower.user.id);
    expect(compliance.find((row) => row.user.id === rower.user.id)).toMatchObject({
      total_m: 10000,
      last_log: '2026-03-09',
    });
    expect(compliance.find((row) => row.user.id === empty.user.id)?.last_log).toBeNull();
    expect((await api('/admin/export?start=2026-01-01&end=2026-01-02', admin)).status).toBe(200);
  });
  it('audits staff mutations and paginates audit records with a stable cursor', async () => {
    const admin = await user('Admin', 'admin');
    for (let i = 0; i < 53; i++)
      expect(
        (await api('/admin/presets', admin, 'POST', { ...preset, name: 'Preset ' + i })).status,
      ).toBe(201);
    const first = await (await api('/admin/audit', admin)).json<Page<AuditLog>>();
    expect(first.items).toHaveLength(50);
    expect(first.next_cursor).toBeTruthy();
    const second = await (
      await api('/admin/audit?cursor=' + first.next_cursor, admin)
    ).json<Page<AuditLog>>();
    expect(second.items).toHaveLength(3);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(53);
    expect(
      first.items.every((row) => row.actor_id === admin.user.id && row.action === 'preset.create'),
    ).toBe(true);
    expect(JSON.parse(first.items[0].detail_json)).toMatchObject({
      before: null,
      after: { modality: 'erg' },
    });
    expect((await api('/admin/audit?cursor=bad', admin)).status).toBe(400);
  });
});
describe('announcements and plan', () => {
  it('notifies all active users except author, orders pinned first and audits all mutations', async () => {
    const admin = await user('Admin', 'admin');
    const rower = await user('Rower');
    const cox = await user('Cox', 'coxswain');
    const inactive = await user('Inactive');
    await api('/admin/users/' + inactive.user.id, admin, 'PATCH', { active: false });
    expect(await (await api('/announcements', rower)).json()).toEqual([]);
    expect(
      (await api('/announcements', cox, 'POST', { title: '', body: 'Body', pinned: false })).status,
    ).toBe(400);
    const created = await api('/announcements', cox, 'POST', {
      title: 'First',
      body: 'Body',
      pinned: false,
    });
    expect(created.status).toBe(201);
    const news = await created.json<{ id: string }>();
    expect(await (await api('/notifications', cox)).json<unknown[]>()).toHaveLength(0);
    for (const viewer of [admin, rower])
      expect(await (await api('/notifications', viewer)).json()).toMatchObject([
        { kind: 'announcement', announcement_id: news.id, entry_id: null, actor: { name: 'Cox' } },
      ]);
    expect((await api(`/announcements/${news.id}`, rower)).status).toBe(200);
    expect((await (await api(`/announcements/${news.id}`, rower)).json<{ id: string }>()).id).toBe(
      news.id,
    );
    expect((await api('/announcements/missing', rower)).status).toBe(404);
    expect((await api(`/announcements/${news.id}`)).status).toBe(401);
    await sql((storage) =>
      expect(
        storage.sql
          .exec('SELECT * FROM notifications WHERE user_id = ?', inactive.user.id)
          .toArray(),
      ).toHaveLength(0),
    );
    await api('/announcements', admin, 'POST', { title: 'Pinned', body: 'Body', pinned: true });
    const list = await (await api('/announcements', rower)).json<{ title: string }[]>();
    expect(list.map((row) => row.title)).toEqual(['Pinned', 'First']);
    expect(JSON.stringify(list)).not.toMatch(/password|email|example.com/);
    expect(
      (await api('/announcements/' + news.id, cox, 'PATCH', { title: 'Edited', pinned: true }))
        .status,
    ).toBe(200);
    expect((await api('/announcements/' + news.id, rower, 'DELETE')).status).toBe(403);
    expect((await api('/announcements/' + news.id, cox, 'DELETE')).status).toBe(204);
    expect((await api('/announcements/' + news.id, cox, 'DELETE')).status).toBe(404);
    const actions = (await (await api('/admin/audit', admin)).json<Page<AuditLog>>()).items.map(
      (row) => row.action,
    );
    for (const action of ['announcement.create', 'announcement.update', 'announcement.delete'])
      expect(actions).toContain(action);
  });
  it('replaces a dated team week transactionally and rejects duplicate slots', async () => {
    const cox = await user('Cox', 'coxswain');
    const rower = await user('Rower');
    const plan = {
      week_start: '2026-03-09',
      slots: [
        { day: 0, slot: 'AM', kind: 'oyo', zone: null, text: 'Training\nOYO', counts_oyo: false },
      ],
      totals: [{ label: '20k' }],
    };
    expect((await api('/admin/plan', cox, 'PUT', plan)).status).toBe(200);
    expect(await (await api('/admin/plan', cox)).json()).toEqual(plan);
    expect(await (await api('/plan', rower)).json()).toEqual({
      week_start: plan.week_start,
      slots: plan.slots,
      total: '20k',
    });
    expect(
      (await api('/admin/plan', cox, 'PUT', { ...plan, slots: [...plan.slots, ...plan.slots] }))
        .status,
    ).toBe(400);
    expect((await (await api('/admin/plan', cox)).json<Plan>()).slots).toHaveLength(1);
    expect((await api('/admin/plan', cox, 'PUT', { ...plan, slots: [], totals: [] })).status).toBe(
      200,
    );
    expect(await (await api('/plan', rower)).json()).toEqual({
      week_start: plan.week_start,
      slots: [],
      total: null,
    });
  });
});
