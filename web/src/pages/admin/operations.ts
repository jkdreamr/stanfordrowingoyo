import type { ComplianceRow, Settings } from '../../../../shared/types';
import { addDays, seasonRange } from '../../../../shared/dates';

export function complianceSummary(rows: ComplianceRow[], sort: 'percent' | 'name' = 'percent') {
  return {
    rows: [...rows].sort(
      (a, b) =>
        (sort === 'percent' ? a.percent - b.percent : 0) ||
        a.user.name.localeCompare(b.user.name) ||
        a.user.id.localeCompare(b.user.id),
    ),
    onTarget: rows.filter((row) => row.percent >= 100).length,
    notLogged: rows
      .filter((row) => row.entry_count === 0)
      .map((row) => row.user)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  };
}
export function validDate(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function factorError(value: string) {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) && n >= 0.01 && n <= 100
    ? ''
    : 'Use a factor from 0.01 to 100.';
}
export function targetError(value: string) {
  const n = Number(value);
  return value.trim() && Number.isInteger(n) && n >= 1000 && n <= 1000000
    ? ''
    : 'Use whole meters from 1,000 to 1,000,000.';
}
export function seasonError(value: string) {
  return validDate('2000-' + value) ? '' : 'Choose a real month and day.';
}
export function settingsErrors(settings: Settings) {
  return [
    ...Object.values(settings.zone_factors).map((v) => factorError(String(v))),
    ...Object.values(settings.mode_factors).map((v) => factorError(String(v))),
    ...Object.values(settings.group_targets).map((v) => targetError(String(v))),
    seasonError(settings.season_start),
  ].filter(Boolean);
}
export function exportError(start: string, end: string) {
  return !validDate(start) || !validDate(end)
    ? 'Choose valid start and end dates.'
    : start > end
      ? 'End date must be on or after the start date.'
      : '';
}
export function exportRange(
  kind: 'week' | 'month' | 'season',
  today: string,
  week: string,
  season: string,
) {
  if (kind === 'week') return { start: week, end: today };
  if (kind === 'month') return { start: addDays(today, -29), end: today };
  // February 29 is allowed by settings; non-leap seasons start on March 1.
  const range = seasonRange(today, season);
  return { start: addDays(range.start, 0), end: today };
}
export function humanizeAction(action: string) {
  const labels: Record<string, string> = {
    'settings.update': 'Updated Team Settings',
    'entries.recalculate': 'Recalculated Entries',
    'user.reset-password': 'Reset Password',
    'user.remove': 'Removed Account',
    'roster.unlink': 'Unlinked Account',
  };
  const [entity, verb] = action.split('.');
  const verbs: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    import: 'Imported',
    unlink: 'Unlinked',
  };
  if (!labels[action] && verbs[verb])
    return `${verbs[verb]} ${entity.charAt(0).toUpperCase() + entity.slice(1)}`;
  return (
    labels[action] ??
    action
      .split(/[.\-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
export function auditSummary(detail: string) {
  try {
    const value = JSON.parse(detail);
    const before = value.before && typeof value.before === 'object' ? value.before : {};
    const after = value.after && typeof value.after === 'object' ? value.after : {};
    if (typeof after.updated === 'number')
      return { updated: after.updated, fields: [] as string[] };
    return {
      fields: [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(
          (key) =>
            !/password|salt|hash|team_code$/.test(key) &&
            JSON.stringify(before[key]) !== JSON.stringify(after[key]),
        )
        .map((key) => key.replaceAll('_', ' ')),
    };
  } catch {
    return { fields: [] as string[] };
  }
}
export function relativeAuditTime(value: string, now = Date.now()) {
  const seconds = (Date.parse(value) - now) / 1000;
  if (!Number.isFinite(seconds)) return 'Unknown time';
  const unit =
    Math.abs(seconds) < 60
      ? 'second'
      : Math.abs(seconds) < 3600
        ? 'minute'
        : Math.abs(seconds) < 86400
          ? 'hour'
          : 'day';
  const divisor = { second: 1, minute: 60, hour: 3600, day: 86400 }[unit];
  return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(
    Math.round(seconds / divisor),
    unit,
  );
}
