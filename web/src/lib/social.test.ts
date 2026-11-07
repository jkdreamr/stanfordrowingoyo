import { describe, expect, it } from 'vitest';
import type { Announcement, EntryDetail, Notification, PublicUser } from '../../../shared/types';
import {
  groupNotifications,
  hitsTarget,
  normalizeName,
  notificationAnnouncements,
  publicSubtitle,
  relativeTime,
} from './social';
const entry = (id: string, equiv_m: number, created_at = '2026-11-06T10:00:00Z') =>
  ({ id, equiv_m, created_at }) as EntryDetail;
describe('target crossing', () => {
  it('marks the crossing entry, not later entries', () => {
    const entries = [entry('a', 60), entry('b', 40), entry('c', 20)];
    const stats = { target_m: 100, entries: [...entries].reverse() };
    expect(hitsTarget(entries[0], stats)).toBe(false);
    expect(hitsTarget(entries[1], stats)).toBe(true);
    expect(hitsTarget(entries[2], stats)).toBe(false);
  });
  it('handles no crossing, zero targets, missing entries and empty weeks', () => {
    const a = entry('a', 20);
    expect(hitsTarget(a, { target_m: 100, entries: [a] })).toBe(false);
    expect(hitsTarget(a, { target_m: 0, entries: [a] })).toBe(false);
    expect(hitsTarget(a, { target_m: 10, entries: [] })).toBe(false);
  });
  it('orders timestamps then ids without mutating the source', () => {
    const a = entry('a', 60),
      b = entry('b', 40),
      c = entry('c', 10, '2026-11-05T10:00:00Z');
    const entries = [b, a, c];
    expect(hitsTarget(b, { target_m: 100, entries })).toBe(true);
    expect(entries[0]).toBe(b);
  });
});
describe('relative time', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  it('formats each time range', () => {
    for (const [seconds, text] of [
      [0, 'just now'],
      [59, 'just now'],
      [60, '1m ago'],
      [3600, '1h ago'],
      [86400, '1d ago'],
    ] as const)
      expect(relativeTime(new Date(now - seconds * 1000).toISOString(), now)).toBe(text);
  });
  it('handles invalid, empty and future timestamps', () => {
    expect(relativeTime('', now)).toBe('just now');
    expect(relativeTime('invalid', now)).toBe('just now');
    expect(relativeTime(new Date(now + 1000).toISOString(), now)).toBe('just now');
  });
});
describe('notification grouping', () => {
  it('groups only kudos for the same workout and retains comment rows', () => {
    const items = [
      { id: 'a', kind: 'kudos', entry_id: 'one' },
      { id: 'b', kind: 'comment', entry_id: 'one' },
      { id: 'c', kind: 'kudos', entry_id: 'one' },
      { id: 'd', kind: 'kudos', entry_id: 'two' },
    ] as Notification[];
    expect(groupNotifications(items).map((g) => g.map((n) => n.id))).toEqual([
      ['a', 'c'],
      ['b'],
      ['d'],
    ]);
    expect(groupNotifications([])).toEqual([]);
  });
});
describe('public identity', () => {
  it('matches names without case, surrounding space or combining accents', () => {
    expect(normalizeName('  JOSÉ Álvarez ')).toBe(normalizeName('jose alvarez'));
    expect(normalizeName('')).toBe('');
  });
  it('omits missing fields and uses roles for coxswains and staff', () => {
    const user = { role: 'rower', side: 'port', class_year: 2027, group_key: 'u23' } as PublicUser;
    expect(publicSubtitle(user)).toBe('Port · Class of 2027 · U23 Group');
    expect(publicSubtitle({ ...user, side: null, class_year: null })).toBe('U23 Group');
    expect(publicSubtitle({ ...user, role: 'coxswain' })).toBe('Coxswain');
    expect(publicSubtitle({ ...user, role: 'coach' })).toBe('Coach');
  });
});
describe('announcement notification resolution', () => {
  const notification = { actor_id: 'coach', created_at: '2026-11-06T10:00:00Z' } as Notification;
  const announcements = [
    { id: 'old', author_id: 'coach', created_at: '2026-11-05T10:00:00Z' },
    { id: 'closest', author_id: 'coach', created_at: '2026-11-06T10:01:00Z' },
    { id: 'other', author_id: 'other', created_at: '2026-11-06T10:00:00Z' },
  ] as Announcement[];
  it('selects the same author nearest in time without mutating input', () => {
    expect(notificationAnnouncements(notification, announcements).map((a) => a.id)).toEqual([
      'closest',
    ]);
    expect(announcements[0].id).toBe('old');
  });
  it('falls back to the latest list and handles an empty list', () => {
    expect(
      notificationAnnouncements({ ...notification, actor_id: 'missing' }, announcements).map(
        (a) => a.id,
      ),
    ).toEqual(['closest', 'other', 'old']);
    expect(notificationAnnouncements(notification, [])).toEqual([]);
  });
});
