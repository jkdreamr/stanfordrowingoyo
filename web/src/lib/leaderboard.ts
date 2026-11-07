import { addDays, seasonRange, TIME_ZONE, weekStart } from '../../../shared/dates';
import type { LeaderboardRow } from '../../../shared/types';
import { formatEMeters, formatNumber, formatPercent } from './format';

export type LeaderboardMetric = 'percent' | 'meters' | 'season';
export const LEADERBOARD_METRICS = [
  { value: 'percent', label: '% of Target' },
  { value: 'meters', label: 'Meters' },
  { value: 'season', label: 'Season' },
] as const satisfies readonly { value: LeaderboardMetric; label: string }[];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(date: string) {
  if (!DATE.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function parseMetric(value: string | null): LeaderboardMetric {
  return value === 'meters' || value === 'season' ? value : 'percent';
}
export function parseWeek(value: string | null, currentWeek: string): string {
  if (!value || !validDate(value) || value < '2000-01-01') return currentWeek;
  const week = weekStart(value);
  return week > currentWeek ? currentWeek : week;
}

const monthDay = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).format(
    new Date(`${date}T12:00:00Z`),
  );
export function formatWeekRange(week: string, currentWeek: string): string {
  const end = addDays(week, 6);
  const sameYear = week.slice(0, 4) === end.slice(0, 4);
  const showYear = !sameYear || week.slice(0, 4) !== currentWeek.slice(0, 4);
  const start = monthDay(week, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const last =
    week.slice(5, 7) === end.slice(5, 7)
      ? monthDay(end, { day: 'numeric' })
      : monthDay(end, { month: 'short', day: 'numeric' });
  return `${start} – ${last}${showYear ? `, ${end.slice(0, 4)}` : ''}`;
}
export function seasonLabel(today: string, seasonStart: string): string {
  const { start, end } = seasonRange(today, seasonStart);
  return `${start.slice(0, 4)}–${end.slice(2, 4)} Season`;
}

/** Floors so a rower at 99.6% never reads as 100% before the target is hit. */
export function displayPercent(percent: number): string {
  return formatPercent(Number.isFinite(percent) ? Math.max(0, Math.floor(percent)) : percent);
}
export function hitTarget(row: LeaderboardRow) {
  return row.target_m > 0 && row.total_m >= row.target_m;
}
export function progressValue(row: LeaderboardRow) {
  return row.target_m > 0 ? Math.min(100, Math.max(0, (row.total_m / row.target_m) * 100)) : 0;
}
export function profilePath(row: LeaderboardRow, meId?: string) {
  return row.user.id === meId ? '/me' : `/users/${encodeURIComponent(row.user.id)}`;
}
export function rowFigures(row: LeaderboardRow, metric: LeaderboardMetric) {
  const target = metric === 'season' ? 'season target' : 'target';
  const meters = formatNumber(row.total_m);
  const percent = displayPercent(row.percent);
  return metric === 'percent'
    ? {
        main: percent,
        secondary: `${formatEMeters(row.total_m, true)} of ${formatEMeters(row.target_m, true)}`,
        spoken: `${percent} of ${target}, ${formatEMeters(row.total_m)}`,
      }
    : {
        main: meters,
        secondary: `${percent} of ${target}`,
        spoken: `${formatEMeters(row.total_m)}, ${percent} of ${target}`,
      };
}
export function rowLabel(row: LeaderboardRow, metric: LeaderboardMetric, isMe: boolean) {
  return [
    `Rank ${formatNumber(row.rank)}`,
    `${row.user.name}${isMe ? ' (You)' : ''}`,
    rowFigures(row, metric).spoken,
    row.streak >= 2 ? `${formatNumber(row.streak)} week streak` : '',
    hitTarget(row) ? 'Target Hit' : '',
  ]
    .filter(Boolean)
    .join(', ');
}
