import { describe, expect, it } from 'vitest';
import type {
  CurrentWeeklyTarget,
  EntryDetail,
  LeaderboardRow,
  Page,
  WeekStats,
  SeasonStats,
} from '../../../shared/types';
import { createMockApi } from './handlers';
const now = () => new Date('2026-11-06T18:00:00Z');
function setup() {
  const mock = createMockApi({ now });
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
describe('mock stats and visibility', () => {
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
    expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
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
  it('paginates feed and excludes private entries even from direct access and other-user pages', async () => {
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
    const hidden = state.entries.find((e) => e.user_id !== 'user-1' && e.visibility === 'private')!;
    expect((await request(`/entries/${hidden.id}`)).status).toBe(404);
    const profile: Page<EntryDetail> = await (
      await request(`/entries?scope=user:${hidden.user_id}`)
    ).json();
    expect(profile.items.every((e) => e.visibility === 'team')).toBe(true);
  });
});
describe('mock mutations and errors', () => {
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
