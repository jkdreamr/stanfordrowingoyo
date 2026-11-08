import { addDays, TIME_ZONE } from './dates';

/** Berkeley's week total as a share of the sum of every leaderboard rower's weekly target. */
export const BERKELEY_PACE_RATIO = 0.9;
export const BERKELEY_PACE_PERCENT = Math.round(BERKELEY_PACE_RATIO * 100);
export const BERKELEY_PACE_MIN_PERCENT = 50;
export const BERKELEY_PACE_MAX_PERCENT = 150;

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});
function offsetAt(ms: number): number {
  const value: Record<string, number> = {};
  for (const part of parts.formatToParts(ms)) value[part.type] = Number(part.value);
  return (
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) -
    Math.floor(ms / 1000) * 1000
  );
}
/** Epoch ms of 00:00 team time on a YYYY-MM-DD date. */
export function teamMidnight(date: string): number {
  const utc = Date.parse(date + 'T00:00:00Z');
  const guess = utc - offsetAt(utc);
  return utc - offsetAt(guess);
}
/** Monday 00:00 through the next Monday 00:00 in team time, as epoch ms. */
export function raceWeekBounds(weekStart: string) {
  return { start: teamMidnight(weekStart), end: teamMidnight(addDays(weekStart, 7)) };
}
/** Berkeley's meters at `now`: a steady share of its week total, linear over the team-time week. */
export function ghostMeters(totalM: number, start: number, end: number, now: number): number {
  if (totalM <= 0 || end <= start || now <= start) return 0;
  if (now >= end) return Math.round(totalM);
  return Math.round((totalM * (now - start)) / (end - start));
}
export function berkeleyTotal(targetM: number, ratio = BERKELEY_PACE_RATIO): number {
  return Math.max(0, Math.round(targetM * ratio));
}
export type RaceLeader = 'stanford' | 'berkeley' | 'tied';
export function raceLeader(stanfordM: number, berkeleyM: number): RaceLeader {
  return stanfordM > berkeleyM ? 'stanford' : stanfordM < berkeleyM ? 'berkeley' : 'tied';
}
