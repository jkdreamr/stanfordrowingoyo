import { describe, expect, it } from 'vitest';
import type {
  CurrentWeeklyTarget,
  EntryDetail,
  LeaderboardRow,
  Page,
  SeasonStats,
  WeekStats,
  PerceptionStart,
} from '../../../shared/types';
import { createMockApi } from './handlers';
const now = () => new Date('2026-11-06T18:00:00Z');
function setup(options: Parameters<typeof createMockApi>[0] = {}) {
  const mock = createMockApi({ now, ...options });
  const request = (path: string, method = 'GET', body?: unknown) =>
    mock.handle(
      new Request(`http://localhost/api${path}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      }),
    );
  return { ...mock, request };
}
const input = {
  date: '2026-11-06',
  modality: 'erg',
  zone: 'E',
  distance_m: 12000,
  title: '3x4k E',
  notes: '',
  visibility: 'team',
};
it('keeps artificial mock Perception v2 stimuli, scoring and timing consistent', async () => {
  const base = Date.parse('2026-11-10T18:00:00Z');
  let elapsed = 0;
  const { request, state } = setup({ now: () => new Date(base + elapsed) });
  await request('/auth/login', 'POST', {
    email: state.users.find((user) => user.role === 'admin')!.email,
    password: 'password',
  });
  for (let round = 0; round < 5; round++) {
    elapsed = round * 60000;
    const start = await request('/games/perception/start', 'POST', { round });
    expect(start.status).toBe(200);
    const { stimulus, rounds } = (await start.json()) as PerceptionStart;
    expect(rounds).toEqual(['clock', 'color', 'dot', 'pattern', 'reaction']);
    const answer = 'reactionDelayMs' in stimulus ? { reactionMs: 150 } : stimulus;
    if ('cells' in stimulus) expect(stimulus.cells).toHaveLength(9);
    if ('reactionDelayMs' in stimulus) {
      elapsed += stimulus.reactionDelayMs - 1;
      expect((await request('/games/perception/answer', 'POST', { round, answer })).status).toBe(
        400,
      );
      elapsed += 151;
    } else elapsed += 20000;
    const result = await request('/games/perception/answer', 'POST', { round, answer });
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      round: round + 1,
      scores: { [rounds[round]]: 100 },
      done: round === 4,
    });
  }
  expect(await (await request('/games/perception/results/me')).json()).toMatchObject({
    score: 500,
  });
});
it.each(['2026-11-11', '2026-11-12'])(
  'plays the rotated artificial Perception lineup on %s',
  async (date) => {
    let time = Date.parse(`${date}T18:00:00Z`);
    const { request, state } = setup({ now: () => new Date(time) });
    await request('/auth/login', 'POST', {
      email: state.users.find((u) => u.role === 'admin')!.email,
      password: 'password',
    });
    for (let round = 0; round < 5; round++) {
      const start = await request('/games/perception/start', 'POST', { round });
      expect(start.status).toBe(200);
      const { stimulus, rounds } = (await start.json()) as PerceptionStart;
      const answer =
        'angle' in stimulus
          ? { angle: stimulus.angle }
          : 'countDots' in stimulus
            ? { count: stimulus.countDots.length }
            : 'shade' in stimulus
              ? { shade: stimulus.shade }
              : 'endpoints' in stimulus
                ? {
                    bisect: [
                      (stimulus.endpoints[0][0] + stimulus.endpoints[1][0]) / 2,
                      (stimulus.endpoints[0][1] + stimulus.endpoints[1][1]) / 2,
                    ],
                  }
                : 'contact' in stimulus
                  ? { contactMs: stimulus.contact.hiddenMs }
                  : stimulus;
      if (['angle', 'length', 'count', 'span', 'shade', 'contact'].includes(rounds[round]))
        expect((await request('/games/perception/answer', 'POST', { round, answer })).status).toBe(
          400,
        );
      time += 20000;
      const response = await request('/games/perception/answer', 'POST', { round, answer });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        scores: { [rounds[round]]: 100 },
        done: round === 4,
      });
    }
    expect(await (await request('/games/perception/results/me')).json()).toMatchObject({
      score: 500,
    });
  },
);
it('exports mock account JSON and CSV without teammate private data', async () => {
  const { request, state } = setup();
  const response = await request('/me/export');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const data = await response.json();
  expect(data.profile.id).toBe('user-1');
  expect(data.workouts.every((entry: { user_id: string }) => entry.user_id === 'user-1')).toBe(
    true,
  );
  expect(JSON.stringify(data)).not.toContain(state.users[1].email);
  const csv = await request('/me/export/workouts');
  expect(csv.headers.get('Content-Type')).toBe('text/csv');
  expect(await csv.text()).toContain('id,date,week_start');
});
it('confirms mock admin removal and clears linked data without auditing the email', async () => {
  const { request, state } = setup();
  const rower = state.users[0];
  expect(
    (await request(`/admin/users/${rower.id}/remove`, 'POST', { confirmation_email: rower.email }))
      .status,
  ).toBe(403);
  await request('/auth/login', 'POST', {
    email: state.users.find((user) => user.role === 'admin')!.email,
    password: 'password',
  });
  expect(
    (
      await request(`/admin/users/${rower.id}/remove`, 'POST', {
        confirmation_email: 'wrong@example.com',
      })
    ).status,
  ).toBe(400);
  expect(
    (await request(`/admin/users/${rower.id}/remove`, 'POST', { confirmation_email: rower.email }))
      .status,
  ).toBe(204);
  expect(state.users.some((user) => user.id === rower.id)).toBe(false);
  expect(state.entries.some((entry) => entry.user_id === rower.id)).toBe(false);
  expect(state.comments.some((row) => row.user_id === rower.id)).toBe(false);
  const audit = await (await request('/admin/audit')).json();
  expect(audit.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ action: 'user.remove' })]),
  );
  expect(JSON.stringify(audit)).not.toContain(rower.email);
});
describe('mock idempotent entries', () => {
  it('replays the original, rejects invalid keys, preserves unkeyed creates and returns 404 after deletion', async () => {
    const mock = createMockApi({ now });
    const create = (key?: string, data = input) =>
      mock.handle(
        new Request('http://localhost/api/entries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(key === undefined ? {} : { 'Idempotency-Key': key }),
          },
          body: JSON.stringify(data),
        }),
      );
    const first = await create('workout-key');
    expect(first.status).toBe(201);
    const original = (await first.json()) as EntryDetail;
    const replay = await create('workout-key', { ...input, title: 'Changed' });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    expect((await create('bad')).status).toBe(400);
    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(201);
    expect(
      (
        await mock.handle(
          new Request('http://localhost/api/entries/' + original.id, { method: 'DELETE' }),
        )
      ).status,
    ).toBe(204);
    const missing = await create('workout-key');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
describe('mock password reauthentication', () => {
  it('issues a five-minute grant, consumes it once, and revokes other grants when the password changes', async () => {
    const { request } = setup();
    const verify = () => request('/me/password/verify', 'POST', { current_password: 'password' });
    const response = await verify();
    expect(response.status).toBe(200);
    const grant = await response.json();
    expect(grant.reauth_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(grant.expires_at).toBe('2026-11-06T18:05:00.000Z');
    const other = await (await verify()).json();
    expect(
      (
        await request('/me/password', 'POST', {
          new_password: 'new-password',
          reauth_token: grant.reauth_token,
        })
      ).status,
    ).toBe(204);
    for (const token of [grant.reauth_token, other.reauth_token]) {
      const reused = await request('/me/password', 'POST', {
        new_password: 'another-password',
        reauth_token: token,
      });
      expect(reused.status).toBe(401);
      expect(await reused.json()).toMatchObject({ error: { code: 'REAUTH_REQUIRED' } });
    }
    expect((await verify()).status).toBe(401);
    expect(
      (await request('/me/password/verify', 'POST', { current_password: 'new-password' })).status,
    ).toBe(200);
    expect((await request('/me')).status).toBe(200);
  });
  it('requires a grant and rejects the old combined-password contract', async () => {
    const { request } = setup();
    for (const reauth_token of [undefined, '', 'forged-token']) {
      const response = await request('/me/password', 'POST', {
        new_password: 'new-password',
        reauth_token,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: {
          code: 'REAUTH_REQUIRED',
          message: 'Verify your current password again before changing it.',
        },
      });
    }
    const legacy = await request('/me/password', 'POST', {
      current_password: 'password',
      new_password: 'new-password',
    });
    expect(legacy.status).toBe(400);
    expect(await legacy.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
  it('maps an incorrect current password to INVALID_CREDENTIALS', async () => {
    const response = await setup().request('/me/password/verify', 'POST', {
      current_password: 'incorrect-password',
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' },
    });
  });
  for (const [path, field] of [
    ['/me/password/verify', 'current_password'],
    ['/me/password', 'new_password'],
  ] as const) {
    for (const value of [undefined, 1234, '', 'p'.repeat(7), 'p'.repeat(201)]) {
      it(`validates ${field} (${typeof value === 'string' ? value.length : String(value)})`, async () => {
        const response = await setup().request(path, 'POST', { [field]: value });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      });
    }
  }
  for (const length of [8, 200]) {
    it(`accepts ${length}-character passwords`, async () => {
      const { request } = setup();
      const grant = await (
        await request('/me/password/verify', 'POST', { current_password: 'password' })
      ).json();
      const password = 'p'.repeat(length);
      expect(
        (
          await request('/me/password', 'POST', {
            new_password: password,
            reauth_token: grant.reauth_token,
          })
        ).status,
      ).toBe(204);
      expect(
        (await request('/me/password/verify', 'POST', { current_password: password })).status,
      ).toBe(200);
    });
  }
  for (const [elapsed, status] of [
    [299999, 204],
    [300000, 401],
  ]) {
    it(`expires the grant precisely at five minutes (${elapsed}ms)`, async () => {
      let instant = now().getTime();
      const { request } = setup({ now: () => new Date(instant) });
      const grant = await (
        await request('/me/password/verify', 'POST', { current_password: 'password' })
      ).json();
      instant += elapsed;
      const response = await request('/me/password', 'POST', {
        new_password: 'new-password',
        reauth_token: grant.reauth_token,
      });
      expect(response.status).toBe(status);
      if (status === 401)
        expect(await response.json()).toMatchObject({ error: { code: 'REAUTH_REQUIRED' } });
    });
  }
  it('binds grants to the user and session, including a new login by the same user', async () => {
    const { request, state } = setup();
    const grant = await (
      await request('/me/password/verify', 'POST', { current_password: 'password' })
    ).json();
    for (const user of ['user-2', 'user-1']) {
      await request('/auth/logout', 'POST');
      expect(
        (
          await request('/auth/login', 'POST', {
            email: state.users.find((row) => row.id === user)!.email,
            password: 'password',
          })
        ).status,
      ).toBe(200);
      const response = await request('/me/password', 'POST', {
        new_password: 'new-password',
        reauth_token: grant.reauth_token,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'REAUTH_REQUIRED' } });
    }
    await request('/auth/logout', 'POST');
    for (const path of ['/me/password/verify', '/me/password']) {
      const response = await request(path, 'POST', {
        ...(path.endsWith('/verify')
          ? { current_password: 'password' }
          : { new_password: 'new-password' }),
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    }
  });
  it('allows forced temporary-password replacement without a verify call or token', async () => {
    const { request, state } = setup();
    state.users.find((user) => user.id === 'user-1')!.must_change_password = true;
    expect((await request('/me/password', 'POST', { new_password: 'new-password' })).status).toBe(
      204,
    );
    expect(await (await request('/me')).json()).toMatchObject({ must_change_password: false });
  });
  it('returns CREDENTIALS_CHANGED when credentials change during a password request', async () => {
    const { request } = setup();
    const grant = await (
      await request('/me/password/verify', 'POST', { current_password: 'password' })
    ).json();
    const responses = await Promise.all(
      ['first-password', 'second-password'].map((new_password) =>
        request('/me/password', 'POST', { new_password, reauth_token: grant.reauth_token }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([204, 409]);
    expect(await responses.find((response) => response.status === 409)!.json()).toEqual({
      error: { code: 'CREDENTIALS_CHANGED', message: 'Credentials changed. Please try again.' },
    });
  });
});
describe('mock stats and visibility', () => {
  it('returns positive daily totals with prior-season history and authorized profile totals', async () => {
    const { request, state } = setup();
    const season: SeasonStats = await (await request('/stats/season')).json();
    expect(season.days.length).toBeGreaterThan(0);
    expect(
      season.days.every((d) => d.equiv_m > 0 && d.date >= season.start && d.date <= '2026-11-06'),
    ).toBe(true);
    expect(season.days.reduce((n, d) => n + d.equiv_m, 0)).toBe(season.total_m);
    const prior: SeasonStats = await (await request('/stats/season?season=2025')).json();
    expect(prior.total_m).toBeGreaterThan(0);
    expect(prior.days.reduce((n, d) => n + d.equiv_m, 0)).toBe(prior.total_m);
    const other: SeasonStats = await (await request('/stats/season?user=user-2')).json();
    const visible = state.entries.filter(
      (e) => e.user_id === 'user-2' && e.date >= other.start && e.date <= '2026-11-06',
    );
    expect(other.total_m).toBe(visible.reduce((n, e) => n + e.equiv_m, 0));
    expect(other.days.reduce((n, d) => n + d.equiv_m, 0)).toBe(other.total_m);
  });
  it('ranks season by season total against the summed weekly targets', async () => {
    const { request } = setup();
    const rows: LeaderboardRow[] = await (await request('/leaderboard?metric=season')).json();
    const marcus = rows.find((r) => r.user.id === 'user-1')!;
    const season: SeasonStats = await (await request('/stats/season')).json();
    expect(marcus.total_m).toBe(season.total_m);
    expect(marcus.target_m).toBe(80000 * 10);
    expect(marcus.percent).toBe(Math.round((marcus.total_m / marcus.target_m) * 1000) / 10);
    expect(rows.every((r, i) => i === 0 || rows[i - 1].total_m >= r.total_m)).toBe(true);
  });
  it('shares all workout totals and days with the team, including legacy inputs', async () => {
    const { request, state } = setup();
    state.entries = state.entries.filter((e) => e.user_id !== 'user-1');
    for (const date of ['2026-10-19', '2026-10-26'])
      expect(
        (
          await request('/entries', 'POST', {
            ...input,
            date,
            distance_m: 90000,
            visibility: 'private',
          })
        ).status,
      ).toBe(201);
    expect((await request('/entries', 'POST', { ...input, distance_m: 1000 })).status).toBe(201);
    const rows: LeaderboardRow[] = await (await request('/leaderboard')).json();
    expect(rows.find((row) => row.user.id === 'user-1')).toMatchObject({
      total_m: 1000,
      streak: 2,
    });
    const seasonRows: LeaderboardRow[] = await (await request('/leaderboard?metric=season')).json();
    expect(seasonRows.find((row) => row.user.id === 'user-1')?.total_m).toBe(181000);
    const own: SeasonStats = await (await request('/stats/season')).json();
    expect(own.days.reduce((sum, day) => sum + day.equiv_m, 0)).toBe(181000);
    await request('/auth/login', 'POST', { email: state.users[1].email, password: 'password' });
    const other: SeasonStats = await (await request('/stats/season?user=user-1')).json();
    expect(other).toEqual(own);
  });
  it('replaces whole plans atomically, validates bounds and duplicate keys, and exposes saved groups to rowers', async () => {
    const { request } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    const before = await (await request('/admin/plan')).json();
    const slot = {
      group_key: 'normal',
      week: 1,
      day: 0,
      slot: 'AM',
      kind: 'oyo',
      zone: 'E',
      text: '12 km Steady State',
    };
    for (const invalid of [
      { slots: [slot, slot], totals: [] },
      { slots: [{ ...slot, text: 'x'.repeat(2001) }], totals: [] },
      { slots: [slot], totals: [{ group_key: 'normal', week: 1, label: 'x'.repeat(201) }] },
    ])
      expect((await request('/admin/plan', 'PUT', invalid)).status).toBe(400);
    expect(await (await request('/admin/plan')).json()).toEqual(before);
    expect((await (await request('/admin/audit')).json()).items).toHaveLength(0);
    const plan = {
      slots: [slot, { ...slot, group_key: 'frosh', text: '8 km Steady State' }],
      totals: [{ group_key: 'normal', week: 1, label: '80 km' }],
    };
    expect((await request('/admin/plan', 'PUT', plan)).status).toBe(200);
    expect(await (await request('/plan?group=normal')).json()).toEqual({
      slots: [slot],
      totals: plan.totals,
    });
    expect((await (await request('/plan?group=frosh')).json()).slots).toHaveLength(1);
    const audit = (await (await request('/admin/audit')).json()).items;
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('plan.replace');
    expect(JSON.parse(audit[0].detail_json)).toEqual({ before, after: plan });
  });
  it('validates, sorts and audits successful preset and announcement writes', async () => {
    const { request } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    const preset = {
      name: 'Endurance',
      modality: 'bike',
      zone: 'E',
      distance_m: 30000,
      sort: 30,
      active: true,
    };
    for (const body of [
      { ...preset, sort: 1.5 },
      { ...preset, name: 'x'.repeat(121) },
      { ...preset, sort: 1000001 },
    ])
      expect((await request('/admin/presets', 'POST', body)).status).toBe(400);
    expect((await (await request('/admin/audit')).json()).items).toHaveLength(0);
    const first = await (await request('/admin/presets', 'POST', preset)).json();
    expect(
      (
        await request(`/admin/presets/${first.id}`, 'PATCH', {
          sort: -50,
          active: false,
          distance_m: null,
        })
      ).status,
    ).toBe(200);
    const rows = await (await request('/admin/presets')).json();
    expect(rows[0]).toMatchObject({ id: first.id, sort: -50, active: false, distance_m: null });
    expect(
      (
        await request('/announcements', 'POST', {
          title: 'x'.repeat(121),
          body: 'Message',
          pinned: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('/announcements', 'POST', {
          title: 'Title',
          body: 'x'.repeat(5001),
          pinned: false,
        })
      ).status,
    ).toBe(400);
    const announcement = await (
      await request('/announcements', 'POST', {
        title: 'Boathouse Update',
        body: 'Arrive at 6:15.',
        pinned: false,
      })
    ).json();
    await request(`/announcements/${announcement.id}`, 'PATCH', {
      pinned: true,
      title: 'Morning Practice',
    });
    expect((await (await request('/announcements')).json())[0]).toMatchObject({
      id: announcement.id,
      pinned: true,
      title: 'Morning Practice',
    });
    await request(`/announcements/${announcement.id}`, 'DELETE');
    await request(`/admin/presets/${first.id}`, 'DELETE');
    const audit = await (await request('/admin/audit')).json();
    expect(audit.items).toHaveLength(6);
    expect(audit.items[0]).toMatchObject({ action: 'preset.delete', target: first.id });
    const changed = audit.items.find((row: { action: string }) => row.action === 'preset.update');
    expect(JSON.parse(changed.detail_json)).toMatchObject({
      before: { sort: 30, active: true },
      after: { sort: -50, active: false },
    });
  });
  it('validates settings, preserves past targets, recalculates only changed entries and audits successful writes', async () => {
    const { request, state } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    const settings = await (await request('/admin/settings')).json();
    for (const body of [
      { team_code: 'bad' },
      { season_start: '04-31' },
      { mode_factors: { ...settings.mode_factors, run: 101 } },
      { zone_factors: { ...settings.zone_factors, E: 0 } },
      { group_targets: { ...settings.group_targets, normal: 1000.5 } },
    ])
      expect((await request('/admin/settings', 'PATCH', body)).status).toBe(400);
    expect((await (await request('/admin/audit')).json()).items).toHaveLength(0);
    const previous = await (await request('/admin/compliance?week=2026-10-26')).json();
    const targets = { ...settings.group_targets, normal: 90000 };
    expect(
      (await request('/admin/settings', 'PATCH', { group_targets: targets, season_start: '02-29' }))
        .status,
    ).toBe(200);
    const past = await (await request('/admin/compliance?week=2026-10-26')).json();
    expect(past.map((row: { target_m: number }) => row.target_m)).toEqual(
      previous.map((row: { target_m: number }) => row.target_m),
    );
    await request('/admin/settings', 'PATCH', { zone_factors: { ...settings.zone_factors, E: 2 } });
    const result = await (await request('/admin/recalculate', 'POST')).json();
    expect(result.updated).toBeGreaterThan(0);
    expect(await (await request('/admin/recalculate', 'POST')).json()).toEqual({ updated: 0 });
    state.entries[0].title = '=SUM(A1)';
    const exported = await (await request('/admin/export?start=2020-01-01&end=2030-12-31')).text();
    expect(exported).toContain("'=SUM(A1)");
    state.entries.length = 0;
    expect(await (await request('/admin/recalculate', 'POST')).json()).toEqual({ updated: 0 });
    const audit = await (await request('/admin/audit')).json();
    expect(audit.items[0]).toMatchObject({ action: 'entries.recalculate', target: 'entries' });
    expect(audit.items.some((item: { action: string }) => item.action === 'settings.update')).toBe(
      true,
    );
    const emptyExport = await (
      await request('/admin/export?start=2026-01-01&end=2026-12-31')
    ).text();
    expect(emptyExport).toContain('date,week_start,name,email,group,modality');
    expect(emptyExport.split('\r\n')).toHaveLength(2);
    expect((await request('/admin/export?start=2026-12-31&end=2026-01-01')).status).toBe(400);
  });
  it('supports quoted CSV preview semantics, linked changes, duplicate checks and empty imports', async () => {
    const { request, state } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    const csv =
      'name,email,role,group,side,class_year\n"New, Person",new@example.com,rower,frosh,both,2028\nInvalid,bad,rower,normal,,2027';
    const imported = await (await request('/admin/roster/import', 'POST', { csv })).json();
    expect(imported.imported).toBe(1);
    expect(imported.errors[0].row).toBe(3);
    const row = state.roster.find((r) => r.email === 'new@example.com')!;
    expect(row.name).toBe('New, Person');
    expect((await request('/admin/roster', 'POST', { ...row, email: null })).status).toBe(409);
    expect(await (await request('/admin/roster/import', 'POST', { csv: '' })).json()).toEqual({
      imported: 0,
      errors: [],
    });
    const linked = state.roster.find((r) => r.claimed_by_user_id === 'user-1')!;
    expect(
      (
        await request(`/admin/roster/${linked.id}`, 'PATCH', {
          name: 'Renamed Athlete',
          role: 'coxswain',
          group_key: 'u23',
        })
      ).status,
    ).toBe(200);
    expect(state.users.find((u) => u.id === 'user-1')).toMatchObject({
      name: 'Renamed Athlete',
      role: 'coxswain',
      group_key: 'u23',
    });
    expect((await request(`/admin/roster/${linked.id}`, 'DELETE')).status).toBe(409);
    const admin = state.users.find((u) => u.role === 'admin')!;
    expect((await request(`/admin/users/${admin.id}`, 'PATCH', { active: false })).status).toBe(
      409,
    );
    expect(
      (
        await request(
          `/admin/roster/${state.roster.find((r) => r.claimed_by_user_id === admin.id)!.id}/unlink`,
          'POST',
        )
      ).status,
    ).toBe(409);
  });
  it('aggregates dated season meters, including multiple sessions on one date', async () => {
    const { request, state } = setup();
    for (const distance_m of [1000, 2000])
      expect((await request('/entries', 'POST', { ...input, distance_m })).status).toBe(201);
    const stats: SeasonStats = await (await request('/stats/season')).json();
    const days = new Map<string, number>();
    for (const entry of state.entries.filter(
      (e) => e.user_id === 'user-1' && e.date >= stats.start && e.date <= stats.end,
    ))
      days.set(entry.date, (days.get(entry.date) ?? 0) + entry.equiv_m);
    expect(stats.days).toEqual(
      [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, equiv_m]) => ({ date, equiv_m })),
    );
    expect(stats.days.reduce((sum, day) => sum + day.equiv_m, 0)).toBe(stats.total_m);
    const empty: SeasonStats = await (await request('/stats/season?year=2000')).json();
    expect(empty.days).toEqual([]);
    expect((await request('/stats/season?year=bad')).status).toBe(400);
  });
  it('matches worker validation bounds for entry metrics and text', async () => {
    const { request } = setup();
    for (const [key, min, max] of [
      ['duration_s', 1, 86400],
      ['avg_split_s', 60, 600],
      ['stroke_rate', 10, 60],
      ['avg_hr', 30, 240],
    ] as const) {
      for (const value of [null, min, max])
        expect((await request('/entries', 'POST', { ...input, [key]: value })).status).toBe(201);
      for (const value of [min - 1, max + 1])
        expect((await request('/entries', 'POST', { ...input, [key]: value })).status).toBe(400);
      if (key !== 'avg_split_s')
        expect((await request('/entries', 'POST', { ...input, [key]: min + 0.5 })).status).toBe(
          400,
        );
    }
    for (const [key, max] of [
      ['title', 120],
      ['notes', 2000],
    ] as const) {
      for (const value of ['', 'x'.repeat(max)])
        expect((await request('/entries', 'POST', { ...input, [key]: value })).status).toBe(201);
      expect(
        (await request('/entries', 'POST', { ...input, [key]: 'x'.repeat(max + 1) })).status,
      ).toBe(400);
    }
  });
  it('distinguishes signup field failures', async () => {
    const { request } = setup();
    const body = { roster_id: 'roster-30', email: 'new@stanford.edu', password: 'password' };
    for (const [input, code, status] of [
      [body, 'INVALID_TEAM_CODE', 403],
      [{ ...body, team_code: 'wrong' }, 'INVALID_TEAM_CODE', 403],
      [{ ...body, email: 'marcus.albrecht@stanford.edu' }, 'EMAIL_TAKEN', 409],
    ] as const) {
      const response = await request('/auth/signup', 'POST', input);
      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
    }
  });
  it('seeds deterministic partial progress and computes weekly totals/percent', async () => {
    const { request } = setup();
    const stats: WeekStats = await (await request('/stats/week')).json();
    expect(stats.total_m).toBe(48000);
    expect(stats.percent).toBe(60);
    expect(stats.target_m).toBe(80000);
    expect(stats.entries).toHaveLength(3);
    expect(stats.by_day.reduce((n, d) => n + d.equiv_m, 0)).toBe(48000);
    expect(stats.by_modality).toEqual({ erg: 18000, bike: 20000, run: 10000 });
    expect(setup().state.entries).toEqual(setup().state.entries);
  });
  it('orders leaderboard by percent including completed targets and excludes coxswains', async () => {
    const rows: LeaderboardRow[] = await (await setup().request('/leaderboard')).json();
    expect(rows).toHaveLength(29);
    expect(rows[0].percent).toBeGreaterThanOrEqual(100);
    expect(rows.every((r, i) => i === 0 || rows[i - 1].percent >= r.percent)).toBe(true);
    expect(rows.every((r) => r.user.role === 'rower')).toBe(true);
    const tied = (a: LeaderboardRow, b: LeaderboardRow) =>
      a.percent === b.percent && a.total_m === b.total_m;
    expect(
      rows.every((r, i) =>
        i > 0 && tied(rows[i - 1], r) ? r.rank === rows[i - 1].rank : r.rank === i + 1,
      ),
    ).toBe(true);
    expect(rows.some((r, i) => i > 0 && r.rank === rows[i - 1].rank)).toBe(true);
    expect(rows.some((r) => r.streak >= 2)).toBe(true);
  });
  it('versions target from the current week without rewriting history', async () => {
    const { request } = setup();
    const previous: WeekStats = await (await request('/stats/week?week=2026-10-26')).json();
    await request('/me/target', 'PUT', { target_m: 100000 });
    const current: CurrentWeeklyTarget = await (await request('/me/target')).json();
    expect(current).toEqual({ week_start: '2026-11-02', target_m: 100000, source: 'personal' });
    const past: WeekStats = await (await request('/stats/week?week=2026-10-26')).json();
    expect(past.target_m).toBe(previous.target_m);
    const future: WeekStats = await (await request('/stats/week?week=2026-11-09')).json();
    expect(future.target_m).toBe(100000);
  });
  it('paginates all team entries and exposes direct access and other-user pages', async () => {
    const { request, state } = setup();
    let cursor: string | null = null;
    const ids: string[] = [];
    do {
      const page: Page<EntryDetail> = await (
        await request(`/entries?scope=feed${cursor ? `&cursor=${cursor}` : ''}`)
      ).json();
      expect(page.items.length).toBeLessThanOrEqual(20);
      expect(page.items.every((e) => e.visibility === 'team')).toBe(true);
      ids.push(...page.items.map((e) => e.id));
      cursor = page.next_cursor;
    } while (cursor);
    expect(new Set(ids).size).toBe(ids.length);
    const hidden = state.entries.find((e) => e.user_id !== 'user-1' && e.visibility === 'team')!;
    expect((await request(`/entries/${hidden.id}`)).status).toBe(200);
    const profile: Page<EntryDetail> = await (
      await request(`/entries?scope=user:${hidden.user_id}`)
    ).json();
    expect(profile.items.every((e) => e.visibility === 'team')).toBe(true);
  });
});
describe('mock mutations and errors', () => {
  it('normalizes legacy visibility inputs on creation and patch', async () => {
    const { request } = setup();
    const created: EntryDetail = await (
      await request('/entries', 'POST', { ...input, visibility: 'private' })
    ).json();
    expect(created.visibility).toBe('team');
    const updated: EntryDetail = await (
      await request('/entries/' + created.id, 'PATCH', { visibility: 'private' })
    ).json();
    expect(updated.visibility).toBe('team');
    expect((await (await request('/entries/' + created.id)).json()).visibility).toBe('team');
  });
  it('lists only unclaimed names and claims a name atomically with its roster role', async () => {
    const { request, state } = setup();
    expect(state.roster).toHaveLength(39);
    expect(state.roster.filter((r) => r.role === 'rower')).toHaveLength(35);
    expect((await request('/auth/roster', 'POST', { team_code: 'wrong' })).status).toBe(403);
    const options = await (
      await request('/auth/roster', 'POST', { team_code: 'cardinal-oyo' })
    ).json();
    expect(options).toHaveLength(7);
    expect(
      options.every(
        (r: Record<string, unknown>) => Object.keys(r).sort().join(',') === 'id,name,role',
      ),
    ).toBe(true);
    const body = {
      roster_id: 'roster-30',
      team_code: 'cardinal-oyo',
      email: 'sandro@stanford.edu',
      password: 'password',
      group_key: 'u23',
      name: 'Ignored',
    };
    const responses = await Promise.all([
      request('/auth/signup', 'POST', body),
      request('/auth/signup', 'POST', { ...body, email: 'other@stanford.edu' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const user = state.users.find((u) => u.name === 'Sandro Scalfi')!;
    expect(user).toMatchObject({ group_key: 'u23', role: 'rower', on_leaderboard: true });
    expect(state.roster.find((r) => r.id === 'roster-30')?.claimed_by_user_id).toBe(user.id);
    const remaining = await (
      await request('/auth/roster', 'POST', { team_code: 'cardinal-oyo' })
    ).json();
    expect(remaining).toHaveLength(6);
  });
  it('bootstraps a fresh invited admin without a code and rejects a claimed invitation', async () => {
    const { request, state } = setup();
    expect(
      (
        await request('/auth/signup', 'POST', {
          email: 'joskoo@stanford.edu',
          password: 'password',
        })
      ).status,
    ).toBe(409);
    state.users = state.users.filter((u) => u.role !== 'admin');
    state.roster.find((r) => r.role === 'admin')!.claimed_by_user_id = null;
    const response = await request('/auth/signup', 'POST', {
      email: 'joskoo@stanford.edu',
      password: 'password',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      name: 'Joshua Koo',
      role: 'admin',
      on_leaderboard: false,
      group_key: 'normal',
    });
  });
  it('supports ID-based rename/unlink and lets rowers change their own group', async () => {
    const { request, state } = setup();
    expect((await request('/me', 'PATCH', { group_key: 'invalid' })).status).toBe(400);
    expect((await (await request('/me', 'PATCH', { group_key: 'u23' })).json()).group_key).toBe(
      'u23',
    );
    expect((await request('/admin/roster/roster-1/unlink', 'POST')).status).toBe(403);
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    expect(
      (await request('/admin/roster/roster-1', 'PATCH', { name: 'Marcus Renamed' })).status,
    ).toBe(200);
    expect(state.users[0].name).toBe('Marcus Renamed');
    const unlinked = await request('/admin/roster/roster-1/unlink', 'POST');
    expect(unlinked.status).toBe(200);
    expect(await unlinked.json()).toMatchObject({ id: 'roster-1', claimed_by_user_id: null });
    expect(state.users[0].active).toBe(false);
    expect(state.roster[0].claimed_by_user_id).toBeNull();
    expect(
      (
        await request('/auth/login', 'POST', {
          email: 'marcus.albrecht@stanford.edu',
          password: 'password',
        })
      ).status,
    ).toBe(401);
    const response = await request('/auth/signup', 'POST', {
      team_code: 'cardinal-oyo',
      roster_id: 'roster-1',
      email: 'new.marcus@stanford.edu',
      password: 'password',
    });
    expect(response.status).toBe(201);
  });
  it('keeps opted-out rowers in compliance while excluding them from leaderboard', async () => {
    const { request } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    await request('/admin/users/user-2', 'PATCH', { on_leaderboard: false });
    expect(await (await request('/leaderboard')).json()).toHaveLength(28);
    expect(await (await request('/admin/compliance')).json()).toHaveLength(29);
  });
  it('validates distance, dates, modality, zone and images with structured errors', async () => {
    const { request } = setup();
    for (const patch of [
      { distance_m: 0 },
      { distance_m: 200001 },
      { distance_m: 1.5 },
      { date: '2026-11-08' },
      { date: '2019-12-31' },
      { date: '2026-02-30' },
      { modality: 'swim' },
      { zone: 'Z' },
      { image_ids: ['missing'] },
    ]) {
      const response = await request('/entries', 'POST', { ...input, ...patch });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
      });
    }
    expect((await request('/entries', 'POST', input)).status).toBe(201);
  });
  it('supports entry/comment/kudos changes and ownership checks', async () => {
    const { request } = setup();
    const entry: EntryDetail = await (await request('/entries', 'POST', input)).json();
    const updated: EntryDetail = await (
      await request(`/entries/${entry.id}`, 'PATCH', { distance_m: 20000, zone: 'D' })
    ).json();
    expect(updated.equiv_m).toBe(27000);
    await request(`/entries/${entry.id}/kudos`, 'POST');
    await request(`/entries/${entry.id}/kudos`, 'POST');
    expect((await (await request(`/entries/${entry.id}`)).json()).kudos_count).toBe(1);
    await request(`/entries/${entry.id}/kudos`, 'DELETE');
    const comment = await (
      await request(`/entries/${entry.id}/comments`, 'POST', { body: 'Nice work' })
    ).json();
    expect(comment.author.name).toBe('Marcus Albrecht');
    expect((await (await request(`/entries/${entry.id}`)).json()).comment_count).toBe(1);
    expect((await request(`/comments/${comment.id}`, 'DELETE')).status).toBe(204);
    expect((await request(`/entries/${entry.id}`, 'DELETE')).status).toBe(204);
    expect((await request(`/entries/${entry.id}`)).status).toBe(404);
  });
  it('returns public kudos givers newest first with user-id ties and respects entry visibility', async () => {
    const { request, state } = setup();
    const entry: EntryDetail = await (await request('/entries', 'POST', input)).json();
    state.kudos[entry.id] = [
      { user_id: 'user-2', created_at: '2026-11-05T12:00:00Z' },
      { user_id: 'user-3', created_at: '2026-11-06T12:00:00Z' },
      { user_id: 'user-1', created_at: '2026-11-06T12:00:00.000Z' },
    ];
    const givers = await (await request(`/entries/${entry.id}/kudos`)).json();
    expect(givers.map((u: { id: string }) => u.id)).toEqual(['user-1', 'user-3', 'user-2']);
    expect(givers.every((u: object) => !('email' in u))).toBe(true);
    state.kudos[entry.id] = [];
    expect(await (await request(`/entries/${entry.id}/kudos`)).json()).toEqual([]);
    await request(`/entries/${entry.id}/kudos`, 'POST');
    await request(`/entries/${entry.id}/kudos`, 'POST');
    expect(state.kudos[entry.id]).toHaveLength(1);
    await request(`/entries/${entry.id}/kudos`, 'DELETE');
    expect(await (await request(`/entries/${entry.id}/kudos`)).json()).toEqual([]);
    expect((await request('/entries/missing/kudos')).status).toBe(404);
    const otherEntry = state.entries.find(
      (e) => e.user_id !== 'user-1' && e.visibility === 'team',
    )!;
    expect((await request(`/entries/${otherEntry.id}/kudos`)).status).toBe(200);
    await request('/auth/logout', 'POST');
    expect((await request(`/entries/${entry.id}/kudos`)).status).toBe(401);
  });
  it('enforces session and staff gates, persists session callbacks and supports admin resources', async () => {
    const { request } = setup();
    expect((await request('/admin/users')).status).toBe(403);
    await request('/auth/logout', 'POST');
    expect((await request('/me')).status).toBe(401);
    expect(
      (await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'wrong' }))
        .status,
    ).toBe(401);
    expect(
      (await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' }))
        .status,
    ).toBe(200);
    expect(await (await request('/admin/users')).json()).toHaveLength(32);
    expect((await request('/admin/settings')).status).toBe(200);
    expect((await request('/admin/presets')).status).toBe(200);
    expect((await request('/admin/plan')).status).toBe(200);
    expect((await request('/not-real')).status).toBe(404);
  });
  it('snapshots factors until explicit recalculation', async () => {
    const { request } = setup();
    const created = await (await request('/entries', 'POST', input)).json();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    const settings = await (await request('/admin/settings')).json();
    await request('/admin/settings', 'PATCH', {
      mode_factors: { ...settings.mode_factors, erg: 2 },
    });
    expect((await (await request(`/entries/${created.id}`)).json()).equiv_m).toBe(12000);
    await request('/admin/recalculate', 'POST');
    expect((await (await request(`/entries/${created.id}`)).json()).equiv_m).toBe(24000);
  });
});
