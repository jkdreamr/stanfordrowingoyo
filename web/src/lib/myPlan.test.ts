import { expect, it } from 'vitest';
import { MODE_FACTORS, ZONE_FACTORS } from '../../../shared/math';
import type { MyPlanSessionInput, Plan } from '../../../shared/types';
import {
  inferModality,
  logPrefill,
  personalPlan,
  plannedTotals,
  repeatStart,
  sampleFortnight,
} from './myPlan';

const factors = { mode_factors: MODE_FACTORS, zone_factors: ZONE_FACTORS };
const session: MyPlanSessionInput = {
  week: 1,
  day: 0,
  slot: 'AM',
  modality: 'erg',
  zone: 'E',
  distance_m: 12000,
  note: '',
};
it('infers cycling before running and otherwise defaults to erg', () => {
  for (const [text, modality] of [
    ['Bike or run', 'bike'],
    ['Cycling', 'bike'],
    ['Easy Run', 'run'],
    ['Jog', 'run'],
    ['Trunk circuit', 'erg'],
    ['', 'erg'],
  ])
    expect(inferModality(text)).toBe(modality);
});
it('copies only OYO slots, strips the prefix, limits notes and supplies defaults', () => {
  const sample: Plan = {
    totals: [],
    slots: [
      {
        group_key: 'normal',
        week: 1,
        day: 0,
        slot: 'AM',
        kind: 'oyo',
        zone: null,
        text: 'OYO Bike E',
      },
      {
        group_key: 'normal',
        week: 2,
        day: 6,
        slot: 'PM2',
        kind: 'oyo',
        zone: 'R',
        text: 'Jog ' + 'x'.repeat(220),
      },
      {
        group_key: 'normal',
        week: 1,
        day: 1,
        slot: 'AM',
        kind: 'team',
        zone: null,
        text: 'Team Row',
      },
      { group_key: 'normal', week: 1, day: 2, slot: 'AM', kind: 'off', zone: null, text: 'Off' },
    ],
  };
  const copied = sampleFortnight(sample, '2026-11-02');
  expect(copied.rest_days).toEqual([]);
  expect(copied.sessions).toHaveLength(2);
  expect(copied.sessions[0]).toEqual({
    ...session,
    modality: 'bike',
    distance_m: null,
    note: 'Bike E',
  });
  expect(copied.sessions[1]).toMatchObject({
    week: 2,
    day: 6,
    slot: 'PM2',
    modality: 'run',
    zone: 'R',
    distance_m: null,
  });
  expect(copied.sessions[1].note).toHaveLength(200);
  expect(sampleFortnight({ slots: [], totals: [] }, '2026-11-02').sessions).toEqual([]);
});
it('repeats at the later of the next fortnight or this Monday', () => {
  expect(repeatStart('2026-10-05', '2026-11-02')).toBe('2026-11-02');
  expect(repeatStart('2026-10-26', '2026-11-02')).toBe('2026-11-09');
});
it('computes per-week totals using current factors and excludes null distances', () => {
  expect(plannedTotals([], factors)).toEqual([0, 0]);
  expect(
    plannedTotals(
      [
        session,
        { ...session, week: 2, modality: 'bike', distance_m: 30000 },
        { ...session, distance_m: null },
      ],
      factors,
    ),
  ).toEqual([12000, 10000]);
  expect(
    plannedTotals([session], { ...factors, mode_factors: { ...MODE_FACTORS, erg: 2 } }),
  ).toEqual([24000, 0]);
});
it('matches one entry per session in slot order and created_at/id order', () => {
  const plan = personalPlan(
    {
      start_date: '2026-11-02',
      sessions: [{ ...session, slot: 'PM2' }, session, { ...session, slot: 'PM1' }],
      rest_days: [],
    },
    factors,
    '',
    [
      {
        id: 'b',
        date: '2026-11-02',
        modality: 'erg',
        equiv_m: 12000,
        created_at: '2026-11-02T12:00:00Z',
      },
      {
        id: 'a',
        date: '2026-11-02',
        modality: 'erg',
        equiv_m: 12000,
        created_at: '2026-11-02T12:00:00Z',
      },
      { id: 'bike', date: '2026-11-02', modality: 'bike', equiv_m: 12000, created_at: '' },
      { id: 'outside', date: '2026-11-16', modality: 'erg', equiv_m: 12000, created_at: '' },
    ],
  );
  expect(plan.sessions.map((row) => row.completed_entry_id)).toEqual(['a', 'b', null]);
});
it.each([
  { meters: 80, distance: 9000, zone: 'D' as const, complete: false },
  { meters: 9600, distance: 12000, zone: 'E' as const, complete: true },
  { meters: 9480, distance: 12000, zone: 'E' as const, complete: false },
  { meters: 80, distance: null, zone: 'D' as const, complete: true },
])(
  'matches the server threshold for $meters E-meters and $distance $zone',
  ({ meters, distance, zone, complete }) => {
    const result = personalPlan(
      {
        start_date: '2026-11-02',
        sessions: [{ ...session, distance_m: distance, zone }],
        rest_days: [],
      },
      factors,
      '',
      [{ id: 'entry', date: '2026-11-02', modality: 'erg', equiv_m: meters, created_at: '' }],
    );
    expect(result.sessions[0].completed_entry_id).toBe(complete ? 'entry' : null);
  },
);
it('leaves a skipped small entry available for a later smaller session', () => {
  const result = personalPlan(
    {
      start_date: '2026-11-02',
      sessions: [{ ...session, slot: 'PM1', distance_m: 1000 }, session],
      rest_days: [],
    },
    factors,
    '',
    [
      {
        id: 'small',
        date: '2026-11-02',
        modality: 'erg',
        equiv_m: 1000,
        created_at: '2026-11-02T12:00:00Z',
      },
      {
        id: 'big',
        date: '2026-11-02',
        modality: 'erg',
        equiv_m: 9600,
        created_at: '2026-11-02T13:00:00Z',
      },
    ],
  );
  expect(result.sessions.map((row) => row.completed_entry_id)).toEqual(['big', 'small']);
});
it('accepts valid log prefills independently and ignores invalid or superseded values', () => {
  expect(logPrefill(new URLSearchParams('modality=bike&zone=R%2FE&distance=12000'))).toEqual({
    modality: 'bike',
    zone: 'R/E',
    distance: '12000',
  });
  for (const distance of ['0', '-1', '200001', 'NaN', '1.5', '1e3'])
    expect(logPrefill(new URLSearchParams({ modality: 'swim', zone: 'Z', distance }))).toEqual({});
  for (const key of ['edit', 'preset'])
    expect(
      logPrefill(new URLSearchParams(`${key}=anything&modality=run&zone=E&distance=2000`)),
    ).toEqual({});
});
