/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { Plan, TeamPlan } from '../../shared/types';
import { TEAM_PLAN_SEED_SLOTS } from '../../shared/teamPlan';
import { addDays, weekStart } from '../../shared/dates';
import { sha256 } from './auth/crypto';
import { byId, type UserRow } from './db/users';
import { replacePlan } from './db/plan';
import { oyoGameAccess } from './games/access';

const bindings = env as unknown as Env;
const NOW = '2026-11-09T18:00:00Z';
const WEEK = '2026-11-09';
function sql<T>(callback: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path: string, method = 'GET', body?: unknown, role = 'rower', time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-Test-Now': time,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
      ...(role ? { Cookie: `oyo_session=plan-${role}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const slot = {
  day: 0,
  slot: 'AM',
  kind: 'oyo',
  zone: null,
  text: 'First line\nSecond line',
} as const;
const draft: Plan = { week_start: WEEK, slots: [slot], totals: [{ label: 'Training' }] };
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hashes = await Promise.all(
    ['rower', 'coxswain', 'coach', 'admin'].map((role) => sha256(`plan-${role}`)),
  );
  await sql((storage) => {
    for (const table of [
      'game_progress',
      'game_results',
      'my_plan_sessions',
      'my_plans',
      'entries',
      'sessions',
      'audit_log',
      'users',
      'team_plan_slots',
      'team_plan_totals',
    ])
      storage.sql.exec(`DELETE FROM ${table}`);
    for (const [index, role] of ['rower', 'coxswain', 'coach', 'admin'].entries()) {
      storage.sql.exec(
        "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused',?,'normal',1,?,?)",
        role,
        `${role}@example.com`,
        role,
        role,
        NOW,
        NOW,
      );
      storage.sql.exec(
        'INSERT INTO sessions VALUES (?,?,?,?)',
        hashes[index],
        role,
        '2028-01-01T00:00:00Z',
        NOW,
      );
    }
    replacePlan(storage, { week_start: WEEK, slots: TEAM_PLAN_SEED_SLOTS, totals: [] });
  });
});

it('serves one team-wide seeded week, empty next week, and the untouched read-only examples', async () => {
  const seeded = await (await api('/plan')).json<TeamPlan>();
  expect(seeded.week_start).toBe(WEEK);
  expect(seeded.slots).toEqual(TEAM_PLAN_SEED_SLOTS);
  expect(seeded.total).toBeNull();
  expect(await (await api('/plan?week=2026-11-16')).json()).toEqual({
    week_start: '2026-11-16',
    slots: [],
    total: null,
  });
  const before = await (await api('/plan/example?group=frosh')).json();
  expect((await api('/admin/plan', 'PUT', draft, 'admin')).status).toBe(200);
  expect(await (await api('/plan/example?group=frosh')).json()).toEqual(before);
  expect((await api('/plan/example?group=bad')).status).toBe(400);
  expect((await api('/plan', 'GET', undefined, '')).status).toBe(401);
  expect((await api('/plan/example', 'GET', undefined, '')).status).toBe(401);
});
it('restricts admin reads/writes to staff and removes unused per-slot routes', async () => {
  expect((await api('/admin/plan')).status).toBe(403);
  expect((await api('/admin/plan', 'PUT', draft)).status).toBe(403);
  expect((await api('/admin/plan', 'PUT', draft, '')).status).toBe(401);
  for (const role of ['coxswain', 'coach', 'admin']) {
    expect((await api('/admin/plan', 'GET', undefined, role)).status).toBe(200);
    expect((await api('/admin/plan', 'PUT', draft, role)).status).toBe(200);
  }
  expect([404, 405]).toContain((await api('/admin/plan', 'POST', slot, 'admin')).status);
  expect([404, 405]).toContain(
    (await api('/admin/plan/normal/1/0/AM', 'DELETE', undefined, 'admin')).status,
  );
});
it('rejects invalid dates, non-Mondays, bounds, keys, enums and text without mutation or audit', async () => {
  const max = weekStart(addDays(WEEK, 365));
  for (const week of [
    '2026-02-30',
    '2026-11-10',
    '1999-12-27',
    '2000-01-01',
    addDays(max, 7),
    'nonsense',
    '',
  ]) {
    expect((await api(`/plan?week=${week}`)).status, week).toBe(400);
    expect(
      (await api('/admin/plan', 'PUT', { ...draft, week_start: week }, 'admin')).status,
      week,
    ).toBe(400);
  }
  for (const week of ['2000-01-03', max])
    expect((await api(`/plan?week=${week}`)).status).toBe(200);
  for (const change of [
    { slots: [slot, slot] },
    { slots: [{ ...slot, day: 7 }] },
    { slots: [{ ...slot, day: 0.5 }] },
    { slots: [{ ...slot, slot: 'NOON' }] },
    { slots: [{ ...slot, kind: 'bad' }] },
    { slots: [{ ...slot, zone: 'bad' }] },
    { slots: [{ ...slot, text: 'x'.repeat(2001) }] },
    { totals: [{ label: 'x'.repeat(201) }] },
    { totals: [{ label: '' }, { label: '' }] },
    { slots: null },
    { totals: null },
  ])
    expect((await api('/admin/plan', 'PUT', { ...draft, ...change }, 'admin')).status).toBe(400);
  expect((await api('/admin/plan?week=2026-11-16', 'PUT', draft, 'admin')).status).toBe(400);
  expect((await (await api('/plan')).json<TeamPlan>()).slots).toHaveLength(14);
  expect(await sql((s) => s.sql.exec('SELECT * FROM audit_log').toArray())).toEqual([]);
  expect(
    (
      await api(
        '/admin/plan',
        'PUT',
        {
          ...draft,
          slots: [{ ...slot, text: 'x'.repeat(2000) }],
          totals: [{ label: 'x'.repeat(200) }],
        },
        'admin',
      )
    ).status,
  ).toBe(200);
});
it('replaces and clears only the requested week, preserves null zones/newlines, and audits the dated target', async () => {
  const other = { ...draft, week_start: '2026-11-16', slots: [{ ...slot, text: 'Keep' }] };
  expect((await api('/admin/plan', 'PUT', other, 'admin')).status).toBe(200);
  expect((await api('/admin/plan?week=2026-11-09', 'PUT', draft, 'admin')).status).toBe(200);
  expect(await (await api('/admin/plan', 'GET', undefined, 'admin')).json()).toEqual(draft);
  expect(await (await api('/plan')).json()).toEqual({
    week_start: WEEK,
    slots: [slot],
    total: 'Training',
  });
  expect(
    (await api('/admin/plan', 'PUT', { week_start: WEEK, slots: [], totals: [] }, 'admin')).status,
  ).toBe(200);
  expect(
    await (await api('/admin/plan?week=2026-11-16', 'GET', undefined, 'admin')).json(),
  ).toEqual(other);
  const rows = await sql((s) =>
    s.sql
      .exec<{ target: string; detail_json: string }>(
        "SELECT target,detail_json FROM audit_log WHERE action='plan.replace'",
      )
      .toArray(),
  );
  expect(rows).toHaveLength(3);
  expect(rows.filter((row) => row.target === `plan/${WEEK}`)).toHaveLength(2);
  expect(rows.some((row) => JSON.parse(row.detail_json).after.slots[0]?.text === slot.text)).toBe(
    true,
  );
});
it('rolls back the whole replacement when the audit insert fails', async () => {
  const before = await (await api('/plan')).json();
  await sql((s) =>
    s.sql.exec(
      "CREATE TRIGGER fail_plan_audit BEFORE INSERT ON audit_log WHEN NEW.action='plan.replace' BEGIN SELECT RAISE(ABORT,'test audit failure'); END",
    ),
  );
  try {
    expect((await api('/admin/plan', 'PUT', draft, 'admin')).status).toBe(500);
    expect(await (await api('/plan')).json()).toEqual(before);
  } finally {
    await sql((s) => s.sql.exec('DROP TRIGGER fail_plan_audit'));
  }
});
it('unlocks Mon/Tue/Thu/Sat/Sun for every group and null-group rowers, but not OYO days or unposted weeks', async () => {
  await sql((s) => {
    const user = byId(s, 'rower')!;
    for (const group_key of ['frosh', 'normal', 'u23', null])
      for (let day = 0; day < 8; day++) {
        const date = addDays(WEEK, day);
        const reason = [2, 4, 7].includes(day) ? 'locked' : 'no_oyo';
        expect(oyoGameAccess(s, { ...user, group_key } as UserRow, date)).toEqual({
          date,
          reason,
          unlocked: reason !== 'locked',
        });
      }
  });
});
it('uses the LA day at midnight, including Sunday to Monday rollover', async () => {
  for (const [time, date, reason] of [
    ['2026-11-09T07:59:00Z', '2026-11-08', 'locked'],
    ['2026-11-09T08:00:00Z', '2026-11-09', 'no_oyo'],
    ['2026-11-11T07:59:00Z', '2026-11-10', 'no_oyo'],
    ['2026-11-11T08:00:00Z', '2026-11-11', 'locked'],
    ['2026-11-16T07:59:00Z', '2026-11-15', 'no_oyo'],
    ['2026-11-16T08:00:00Z', '2026-11-16', 'locked'],
  ])
    expect(await (await api('/games/access', 'GET', undefined, 'rower', time)).json()).toEqual({
      date,
      reason,
      unlocked: reason !== 'locked',
    });
});
it('preserves staff > workout > personal rest-day > no-OYO precedence and authoritative game writes', async () => {
  await sql((s) => {
    s.sql.exec('INSERT INTO my_plans VALUES (\'rower\',?,\'[{"week":1,"day":0}]\',?)', WEEK, NOW);
    expect(oyoGameAccess(s, byId(s, 'rower')!, WEEK).reason).toBe('rest_day');
  });
  expect(
    (
      await api('/entries', 'POST', {
        date: WEEK,
        modality: 'erg',
        zone: 'E',
        distance_m: 6000,
        title: 'Workout',
        notes: '',
      })
    ).status,
  ).toBe(201);
  expect((await (await api('/games/access')).json<{ reason: string }>()).reason).toBe('workout');
  for (const role of ['coxswain', 'coach', 'admin'])
    expect(
      (await (await api('/games/access', 'GET', undefined, role)).json<{ reason: string }>())
        .reason,
    ).toBe('staff');
  expect(
    (
      await api(
        '/games/perception/start',
        'POST',
        { round: 0, reason: 'no_oyo' },
        'rower',
        '2026-11-11T18:00:00Z',
      )
    ).status,
  ).toBe(403);
  expect(
    (await api('/games/perception/start', 'POST', { round: 0 }, 'rower', '2026-11-10T18:00:00Z'))
      .status,
  ).toBe(200);
});
