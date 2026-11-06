import { describe, expect, it } from 'vitest';
import type {
  CurrentWeeklyTarget,
  EntryDetail,
  LeaderboardRow,
  Page,
  WeekStats,
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
  it('distinguishes signup field failures', async () => {
    const { request } = setup();
    const body = { name: 'New Rower', email: 'new@stanford.edu', password: 'password' };
    for (const [input, code, status] of [
      [body, 'NOT_ON_ROSTER', 403],
      [{ ...body, team_code: 'wrong' }, 'INVALID_TEAM_CODE', 403],
      [{ ...body, email: 'maya.chen@stanford.edu' }, 'EMAIL_TAKEN', 409],
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
    expect(rows).toHaveLength(20);
    expect(rows[0].percent).toBeGreaterThanOrEqual(100);
    expect(rows.every((r, i) => i === 0 || rows[i - 1].percent >= r.percent)).toBe(true);
    expect(rows.every((r) => r.user.role === 'rower')).toBe(true);
    expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
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
  it('keeps opted-out rowers in compliance while excluding them from leaderboard', async () => {
    const { request } = setup();
    await request('/auth/login', 'POST', { email: 'joskoo@stanford.edu', password: 'password' });
    await request('/admin/users/user-2', 'PATCH', { on_leaderboard: false });
    expect(await (await request('/leaderboard')).json()).toHaveLength(19);
    expect(await (await request('/admin/compliance')).json()).toHaveLength(20);
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
    expect(comment.author.name).toBe('Maya Chen');
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
    expect(await (await request('/admin/users')).json()).toHaveLength(25);
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
