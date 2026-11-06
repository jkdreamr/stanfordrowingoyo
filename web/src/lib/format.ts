import { formatMeters as meters, formatSplit as split } from '../../../shared/math';
import { addDays, today, TIME_ZONE } from '../../../shared/dates';
const valid = (n: number) => Number.isFinite(n) && n >= 0;
export function formatNumber(value: number, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—';
}
export function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
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
export function formatDuration(seconds: number) {
  if (!valid(seconds)) return '—';
  const n = Math.round(seconds);
  const s = String(n % 60).padStart(2, '0');
  const m = Math.floor(n / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(?::\d{2}){0,2}$/.test(text)) return null;
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  const result = parts.reduce((total, n) => total * 60 + n, 0);
  return Number.isSafeInteger(result) ? result : null;
}
export function parseSplit(input: string): number | null {
  const match = /^(\d+):([0-5]\d(?:\.\d)?)$/.exec(input.trim());
  if (!match) return null;
  const n = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(n) ? n : null;
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
