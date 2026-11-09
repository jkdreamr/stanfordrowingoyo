import type { PlanSlot } from './types';

export const TEAM_PLAN_SEED_WEEK = '2026-11-09';
const sessions: Omit<PlanSlot, 'zone'>[] = [
  {
    day: 0,
    slot: 'AM',
    kind: 'team',
    text: "6:55 @ BH\n1) 15' Mobility/Activation\n2) E - 16k - w/up + 3 x 4k\n1x/2-/4-",
  },
  {
    day: 0,
    slot: 'PM1',
    kind: 'team',
    text: "16:30 @ Ahall\nB - 10'/9'/8'/7'\n3k warm up/2k cool down",
  },
  {
    day: 1,
    slot: 'AM',
    kind: 'team',
    text: "6:55 @ BH\n1) 15' Mobility/Activation\n2) E - 4k w/up\n3) D - 3 x 4k - Marker 9/10 <-> White Buoy\n1x/2-/4-/4+",
  },
  { day: 1, slot: 'PM1', kind: 'team', text: '16:15/17:00 @ Annex\nStrength' },
  { day: 2, slot: 'AM', kind: 'oyo', text: 'Athlete Driven OYO or OFF' },
  { day: 2, slot: 'PM1', kind: 'oyo', text: 'Athlete Driven OYO or OFF' },
  {
    day: 3,
    slot: 'AM',
    kind: 'team',
    text: "6:55 @ BH\n1) 15' Mobility/Activation\n2) E - 18k - 4-/4+/1x\nElevated rate E",
  },
  { day: 3, slot: 'PM1', kind: 'team', text: '16:15/17:00 @ Annex\nStrength' },
  {
    day: 4,
    slot: 'AM',
    kind: 'team',
    text: "6:55 @ BH\n1) 20' Ergs down + OYO w/up\n2) D/C - 30' r20 - 7:15 Start\n2) 10k on Water - 5k out steady rowing\nw/ drilling -> D/C 5k - 24-28 spm back to BH\nEights w/lineups based on 30r20",
  },
  { day: 4, slot: 'PM1', kind: 'oyo', text: 'Athlete Driven OYO or OFF' },
  {
    day: 5,
    slot: 'AM',
    kind: 'team',
    text: "7:30 @ BH\n1) 15' Mobility/Activation\n2) 14-18k E paddle in small boats",
  },
  { day: 5, slot: 'PM1', kind: 'off', text: 'Off' },
  { day: 6, slot: 'AM', kind: 'off', text: 'OFF' },
  { day: 6, slot: 'PM1', kind: 'off', text: 'OFF' },
];
export const TEAM_PLAN_SEED_SLOTS: PlanSlot[] = sessions.map((row) => ({ ...row, zone: null }));
