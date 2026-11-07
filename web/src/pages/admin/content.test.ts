import { describe, expect, it } from 'vitest';
import type { Announcement, Preset, Settings } from '../../../../shared/types';
import { MODE_FACTORS, ZONE_FACTORS } from '../../../../shared/math';
import {
  announcementErrors,
  formatPresetFactor,
  movePreset,
  orderedAnnouncements,
  orderedPresets,
  presetErrors,
  presetMeters,
} from './content';
import { auditEntry } from './audit';
import { humanizeAction } from './operations';
import { generateJoinCode, JOIN_ALPHABET } from './joinCode';
const preset: Preset = {
  id: 'a',
  modality: 'erg',
  zone: 'E',
  name: 'Steady State',
  distance_m: 10000,
  sort: 0,
  active: true,
};
const settings: Settings = {
  mode_factors: MODE_FACTORS,
  zone_factors: ZONE_FACTORS,
  team_code: 'ROWCREW8',
  season_start: '09-01',
  group_targets: { normal: 80000, frosh: 60000, u23: 100000 },
};
describe('preset logic', () => {
  it('shows one decimal for whole factors without rounding away meaningful fractional digits', () => {
    expect(formatPresetFactor(1)).toBe('1.0');
    expect(formatPresetFactor(1.35)).toBe('1.35');
    expect(formatPresetFactor(0.075)).toBe('0.075');
    expect(formatPresetFactor(1.5)).toBe('1.5');
    expect(formatPresetFactor(NaN)).toBe('—');
    expect(formatPresetFactor(Infinity)).toBe('—');
  });
  it('validates fixed and variable distances and name bounds', () => {
    for (const distance_m of [null, 1, 200000])
      expect(presetErrors({ ...preset, distance_m })).toEqual({ name: '', distance: '' });
    for (const distance_m of [0, NaN, Infinity, 1.5, 200001])
      expect(presetErrors({ ...preset, distance_m }).distance).not.toBe('');
    for (const name of ['', ' ', 'x'.repeat(121)])
      expect(presetErrors({ ...preset, name }).name).not.toBe('');
  });
  it('previews with the current factors and shared rounding; handles variable and invalid distances', () => {
    expect(presetMeters({ ...preset, modality: 'run', zone: 'D' }, settings)).toBe(16875);
    expect(presetMeters(preset, { ...settings, mode_factors: { ...MODE_FACTORS, erg: 2 } })).toBe(
      20000,
    );
    expect(presetMeters({ ...preset, distance_m: null }, settings)).toBeNull();
    expect(presetMeters({ ...preset, distance_m: NaN }, settings)).toBeNull();
  });
  it('moves only within modality and zone, normalizes ties and persists through sort', () => {
    const rows: Preset[] = [
      preset,
      { ...preset, id: 'b' },
      { ...preset, id: 'c', zone: 'D' },
      { ...preset, id: 'd', modality: 'bike' },
    ];
    const original = structuredClone(rows);
    const changes = movePreset(rows, 'b', -1);
    const updated = rows.map((row) => ({
      ...row,
      ...changes.find((change) => change.id === row.id),
    }));
    expect(
      orderedPresets(updated.filter((row) => row.modality === 'erg' && row.zone === 'E')).map(
        (row) => row.id,
      ),
    ).toEqual(['b', 'a']);
    expect(changes.map((row) => row.id)).not.toContain('c');
    expect(changes.map((row) => row.id)).not.toContain('d');
    expect(rows).toEqual(original);
    expect(movePreset(rows, 'a', -1)).toEqual([]);
    expect(movePreset(rows, 'b', 1)).toEqual([]);
    expect(movePreset([], 'missing', 1)).toEqual([]);
  });
});
describe('announcement logic', () => {
  it('matches backend bounds, including empty and overlong messages', () => {
    expect(announcementErrors('Boathouse Update', 'Arrive at 6:15.')).toEqual({
      title: '',
      body: '',
    });
    for (const title of ['', ' ', 'x'.repeat(121)])
      expect(announcementErrors(title, 'Body').title).not.toBe('');
    for (const body of ['', ' ', 'x'.repeat(5001)])
      expect(announcementErrors('Title', body).body).not.toBe('');
    expect(announcementErrors('x'.repeat(120), 'x'.repeat(5000))).toEqual({ title: '', body: '' });
  });
  it('puts pinned first, newest first within each group, without changing input', () => {
    const row = { id: 'a', pinned: false, created_at: '2026-11-06' } as Announcement;
    const rows = [
      row,
      { ...row, id: 'b', pinned: true, created_at: '2026-11-01' },
      { ...row, id: 'c', pinned: true, created_at: '2026-11-02' },
    ];
    expect(orderedAnnouncements(rows).map((row) => row.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0]).toBe(row);
    expect(orderedAnnouncements([])).toEqual([]);
  });
});
describe('human audit records', () => {
  it.each([
    ['entry.delete', { title: 'QA bike D 12k' }, null, 'deleted the workout “QA bike D 12k”'],
    ['entry.delete', null, null, 'deleted a workout'],
    ['user.remove', null, null, 'permanently removed a rower account'],
    [
      'entry.update',
      { title: 'QA bike D 12k' },
      { title: 'Lunch Ride' },
      'updated the workout “Lunch Ride”',
    ],
    ['entry.update', null, null, 'updated a workout'],
    ['comment.delete', { body: 'Private comment text' }, null, 'deleted a comment'],
    ['plan.upsert', null, { group_key: 'normal' }, 'added a team plan session'],
    [
      'plan.upsert',
      { group_key: 'normal' },
      { group_key: 'normal' },
      'updated a team plan session',
    ],
    ['plan.delete', { group_key: 'normal' }, null, 'deleted a team plan session'],
  ])(
    'describes %s without a generic changed-record fallback',
    (action, before, after, expected) => {
      const result = auditEntry(
        {
          action: action as string,
          target: 'deleted-id',
          detail_json: JSON.stringify({ before, after }),
        },
        new Map(),
      );
      expect(result.sentence).toBe(expected);
    },
  );
  it.each([
    'settings.update',
    'entries.recalculate',
    'user.reset-password',
    'user.update',
    'user.remove',
    'roster.create',
    'roster.update',
    'roster.delete',
    'roster.unlink',
    'roster.import',
    'preset.create',
    'preset.update',
    'preset.delete',
    'announcement.create',
    'announcement.update',
    'announcement.delete',
    'plan.replace',
    'plan.upsert',
    'plan.delete',
    'entry.update',
    'entry.delete',
    'comment.delete',
    'report.dismiss',
    'report.delete',
  ])('maps the worker action %s to explicit wording even without details', (action) => {
    const result = auditEntry({ action, target: 'record', detail_json: '{}' }, new Map());
    expect(result.sentence).not.toMatch(/^changed /);
  });
  it('uses Title Case for side values and a readable plan action', () => {
    expect(
      auditEntry(
        {
          action: 'roster.update',
          target: 'row',
          detail_json: JSON.stringify({ before: { side: 'starboard' }, after: { side: 'cox' } }),
        },
        new Map(),
      ).changes,
    ).toEqual(['Side: Starboard → Cox']);
    expect(
      auditEntry({ action: 'plan.replace', target: 'plan', detail_json: '{}' }, new Map()).sentence,
    ).toBe('updated the team training plan');
  });
  const summarize = (action: string, before: unknown, after: unknown, target = 'person') =>
    auditEntry(
      { action, target, detail_json: JSON.stringify({ before, after }) },
      new Map([['person', 'Maya Chen']]),
    );
  it('describes removal counts without restoring a deleted person’s name or email', () => {
    const result = summarize(
      'user.remove',
      { role: 'rower', active: true },
      {
        removed: {
          workouts: 2,
          images: 1,
          comments: 1,
          kudos: 3,
          plans: 1,
          weekly_targets: 0,
          erg_tests: 2,
          challenges: 1,
        },
      },
    );
    expect(result).toEqual({
      sentence: 'permanently removed a rower account',
      changes: [
        '2 workouts',
        '2 erg tests',
        '1 team challenge',
        '1 photo',
        '1 comment',
        '3 kudos',
        '1 private plan',
      ],
    });
    expect(humanizeAction('user.remove')).toBe('Removed Account');
  });
  it('uses resolved names and real before/after changes, not metadata or secrets', () => {
    const result = summarize(
      'user.update',
      { role: 'rower', id: 'old', password_hash: 'old', created_at: 'old' },
      { role: 'coxswain', id: 'new', password_hash: 'new', created_at: 'new' },
    );
    expect(result).toEqual({
      sentence: 'updated Maya Chen’s account',
      changes: ['Role: Rower → Coxswain'],
    });
    expect(summarize('user.reset-password', null, { must_change_password: true }).changes).toEqual(
      [],
    );
  });
  it('resolves deleted and nested targets from detail, and never uses a bare UUID sentence', () => {
    expect(summarize('roster.delete', { name: 'Alex Morgan' }, null, 'deleted').sentence).toContain(
      'Alex Morgan',
    );
    expect(
      summarize('roster.unlink', { roster: { name: 'Sam Rivera' } }, null, 'deleted').sentence,
    ).toContain('Sam Rivera');
    const unknown = auditEntry(
      {
        action: 'roster.update',
        target: '12345678-abcd-1234-1234-123456789abc',
        detail_json: 'bad',
      },
      new Map(),
    );
    expect(unknown.sentence).toBe('updated a roster name (ID 12345678) on the roster');
    expect(unknown.changes).toEqual([]);
    expect(
      auditEntry({ action: 'user.update', target: 'missing', detail_json: 'null' }, new Map())
        .changes,
    ).toEqual([]);
  });
  it('summarizes counts, settings and preset reordering without exposing code values', () => {
    expect(summarize('roster.import', null, { imported: 12 }, 'roster').changes).toEqual([
      'Imported 12 names',
    ]);
    expect(summarize('entries.recalculate', null, { updated: 4 }).changes).toEqual([
      'Updated 4 entries',
    ]);
    expect(
      summarize(
        'settings.update',
        { team_code: 'SECRET1', mode_factors: { erg: 1 } },
        { team_code: 'SECRET2', team_code_changed: true, mode_factors: { erg: 2 } },
      ).changes,
    ).toEqual(['Regenerated the join code', 'erg factor: 1 → 2']);
    expect(summarize('preset.update', { sort: 0 }, { sort: 10 }).changes).toEqual([
      'Changed the preset order',
    ]);
    expect(
      summarize('preset.update', { name: 'Steady State' }, { name: 'Steady State' }).changes,
    ).toEqual([]);
  });
});
it('generates eight crypto-random unambiguous characters accepted by the backend', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateJoinCode();
    expect(code).toHaveLength(8);
    expect([...code].every((char) => JOIN_ALPHABET.includes(char))).toBe(true);
    expect(code).not.toMatch(/[IO01]/);
    expect(code).toMatch(/^[A-Z2-9]{6,64}$/);
  }
});
