import { floorPercent, formatMeters as meters, formatSplit as split } from '../../../shared/math';
import { addDays, today, TIME_ZONE } from '../../../shared/dates';
const valid = (n: number) => Number.isFinite(n) && n >= 0;
export function formatFactor(value: number) {
  return Number.isFinite(value) ? (value === 1 / 3 ? '1/3' : String(value)) : '—';
}
export function formatNumber(value: number, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—';
}
export function formatPercent(value: number) {
  return `${formatNumber(floorPercent(value))}%`;
}
export function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIME_ZONE }).format(
    new Date(date + 'T12:00:00Z'),
  );
}
export function formatMeters(n: number, compact = false) {
  return valid(n) ? meters(n, compact) : '—';
}
export function formatSplit(n: number) {
  return valid(n) ? split(n) : '—';
}
export function formatKm(n: number, digits = 1) {
  return valid(n)
    ? `${(n / 1000).toFixed(Math.max(0, Math.min(6, Math.trunc(digits) || 0)))} km`
    : '—';
}
export function formatEMeters(n: number, compact = false) {
  return valid(n)
    ? compact
      ? meters(n, true)
      : `${Math.round(n).toLocaleString('en-US')} E-meters`
    : '—';
}
/** Compact volume: 950, 142.5k, 1.84M. */
export function formatCompactMeters(n: number) {
  if (!valid(n)) return '—';
  if (n >= 999_950) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
export function formatDuration(seconds: number) {
  if (!valid(seconds)) return '—';
  const n = Math.round(seconds);
  const s = String(n % 60).padStart(2, '0');
  const m = Math.floor(n / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
export function parseDuration(input: string): number | null {
  return parseTimeInput(input, 'duration')?.seconds ?? null;
}
export function parseSplit(input: string): number | null {
  return parseTimeInput(input, 'split')?.seconds ?? null;
}
export function parseTimeInput(input: string, kind: 'split' | 'duration' | 'elapsed') {
  const value = input.trim();
  let seconds: number;
  let fraction: string | undefined;
  if (kind === 'split') {
    const parts =
      /^(\d+):([0-5]\d)(?:\.(\d))?$/.exec(value) ??
      /^(\d{1,2})\.([0-5]\d)(?:\.(\d))?$/.exec(value) ??
      /^(\d)([0-5]\d)(?:\.(\d)|(\d))?$/.exec(value);
    if (!parts) return null;
    fraction = parts[3] ?? parts[4];
    seconds = Number(parts[1]) * 60 + Number(parts[2]);
  } else if (/^\d+$/.test(value)) {
    seconds = Number(value);
  } else {
    const parts =
      /^(\d+):([0-5]\d)(?::([0-5]\d))?(?:\.(\d))?$/.exec(value) ??
      /^(\d+)\.([0-5]\d)(?:\.([0-5]\d))?(?:\.(\d))?$/.exec(value);
    if (!parts || (kind === 'duration' && parts[4] !== undefined)) return null;
    fraction = parts[4];
    seconds =
      parts[3] === undefined
        ? Number(parts[1]) * 60 + Number(parts[2])
        : Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
  }
  if (!Number.isSafeInteger(seconds) || !Number.isSafeInteger(seconds * 10)) return null;
  const text =
    kind === 'split'
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : formatDuration(seconds);
  return {
    seconds: seconds + Number(fraction ?? 0) / 10,
    text: fraction === undefined ? text : `${text}.${fraction}`,
  };
}
export function splitFromTime(duration_s: number, distance_m: number): number | null {
  return valid(duration_s) && valid(distance_m) && distance_m > 0
    ? (duration_s / distance_m) * 500
    : null;
}
export function formatShortDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}
export function formatEntryDate(date: string, now: Date | string = new Date()) {
  const current = typeof now === 'string' ? now : today(now);
  return date === current
    ? 'Today'
    : date === addDays(current, -1)
      ? 'Yesterday'
      : formatShortDate(date);
}
