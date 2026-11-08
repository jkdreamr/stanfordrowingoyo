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
it('buckets stored logged E-meters by plan week, independently of sessions', () => {
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
        date: '2026-11-02',
        equiv_m: 12000,
      },
      {
        date: '2026-11-08',
        equiv_m: 12000,
      },
      { date: '2026-11-09', equiv_m: 6000 },
      { date: '2026-11-15', equiv_m: 4000 },
      { date: '2026-11-01', equiv_m: 12000 },
      { date: '2026-11-16', equiv_m: 12000 },
    ],
  );
  expect(plan.logged_m).toEqual([24000, 10000]);
  expect(plan.sessions.map((row) => row.slot)).toEqual(['AM', 'PM1', 'PM2']);
});
it('returns zero logged totals for an empty plan without entries', () => {
  const result = personalPlan(
    {
      start_date: '2026-11-02',
      sessions: [],
      rest_days: [],
    },
    factors,
    '',
  );
  expect(result.logged_m).toEqual([0, 0]);
  expect(result.planned_m).toEqual([0, 0]);
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
