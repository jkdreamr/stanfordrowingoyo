import type { AuditLog } from '../../../../shared/types';
import { formatNumber } from '../../lib/format';
import { groupLabels, roleLabels } from './roster';

type Detail = Record<string, unknown>;
const object = (value: unknown): Detail =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Detail) : {};
function details(json: string) {
  try {
    const value = object(JSON.parse(json));
    return { before: object(value.before), after: object(value.after) };
  } catch {
    return { before: {}, after: {} };
  }
}
function name(value: Detail): string | undefined {
  for (const key of ['name', 'title'])
    if (typeof value[key] === 'string' && value[key]) return value[key] as string;
  for (const key of ['roster', 'user']) {
    if (!value[key] || typeof value[key] !== 'object') continue;
    const found = name(object(value[key]));
    if (found) return found;
  }
}
const labels: Record<string, string> = {
  name: 'Name',
  title: 'Title',
  role: 'Role',
  group_key: 'Group',
  side: 'Side',
  class_year: 'Class year',
  email: 'Email',
  active: 'Active',
  on_leaderboard: 'On leaderboard',
  pinned: 'Pinned',
  modality: 'Modality',
  zone: 'Zone',
  distance_m: 'Distance',
  season_start: 'Season start',
};
function display(key: string, value: unknown) {
  if (value == null || value === '') return 'Not Set';
  if (['active', 'on_leaderboard', 'pinned'].includes(key)) return value ? 'Yes' : 'No';
  if (key === 'role' && typeof value === 'string')
    return roleLabels[value as keyof typeof roleLabels] ?? value;
  if (key === 'group_key' && typeof value === 'string')
    return groupLabels[value as keyof typeof groupLabels] ?? value;
  if (typeof value === 'string' && ['side', 'modality'].includes(key))
    return value.charAt(0).toUpperCase() + value.slice(1);
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 3);
  return String(value).slice(0, 120);
}
export function auditEntry(
  row: Pick<AuditLog, 'action' | 'target' | 'detail_json'>,
  names: ReadonlyMap<string, string>,
) {
  const { before, after } = details(row.detail_json);
  const [entity, action] = row.action.split('.');
  const target = names.get(row.target) ?? name(after) ?? name(before);
  const fallback = `a ${entity === 'user' ? 'team member' : entity === 'roster' ? 'roster name' : entity} (ID ${row.target.slice(0, 8)})`;
  const subject = target ?? fallback;
  const sentences: Record<string, string> = {
    'settings.update': 'updated team settings',
    'entries.recalculate': 'recalculated training entries',
    'user.reset-password': `reset the password for ${subject}`,
    'roster.unlink': `unlinked ${subject}’s account`,
    'user.update': `updated ${subject}’s account`,
    'user.remove': 'permanently removed a rower account',
    'roster.create': `added ${subject} to the roster`,
    'roster.delete': `removed ${subject} from the roster`,
    'roster.update': `updated ${subject} on the roster`,
    'roster.import': target ? `imported ${subject} to the roster` : 'imported roster names',
    'preset.create': `created the preset “${subject}”`,
    'preset.update': `updated the preset “${subject}”`,
    'preset.delete': `deleted the preset “${subject}”`,
    'announcement.create': `posted “${subject}”`,
    'announcement.update': `updated “${subject}”`,
    'announcement.delete': `deleted “${subject}”`,
    'plan.replace': 'updated the team training plan',
    'plan.upsert': before.group_key ? 'updated a team plan session' : 'added a team plan session',
    'plan.delete': 'deleted a team plan session',
    'entry.update': target ? `updated the workout “${target}”` : 'updated a workout',
    'entry.delete': target ? `deleted the workout “${target}”` : 'deleted a workout',
    'comment.delete': 'deleted a comment',
    'report.dismiss': 'dismissed a report',
    'report.delete': 'removed reported content',
  };
  const changes: string[] = [];
  if (row.action === 'user.remove') {
    const removed = object(after.removed);
    for (const [key, label] of [
      ['workouts', 'workout'],
      ['erg_tests', 'erg test'],
      ['challenges', 'team challenge'],
      ['images', 'photo'],
      ['comments', 'comment'],
      ['kudos', 'kudos'],
      ['plans', 'private plan'],
      ['weekly_targets', 'weekly target'],
    ]) {
      const count = removed[key];
      if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0)
        changes.push(`${formatNumber(count)} ${label}${count === 1 || key === 'kudos' ? '' : 's'}`);
    }
  }
  if (typeof after.imported === 'number')
    changes.push(`Imported ${formatNumber(after.imported)} names`);
  if (typeof after.updated === 'number')
    changes.push(`Updated ${formatNumber(after.updated)} entries`);
  if (after.team_code_changed === true) changes.push('Regenerated the join code');
  if (action === 'update') {
    for (const key of Object.keys(labels)) {
      if (!(key in after) || JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
      changes.push(`${labels[key]}: ${display(key, before[key])} → ${display(key, after[key])}`);
    }
    for (const key of ['mode_factors', 'zone_factors', 'group_targets']) {
      for (const [field, value] of Object.entries(object(after[key]))) {
        const previous = object(before[key])[field];
        if (previous === value) continue;
        const label =
          key === 'group_targets'
            ? `${groupLabels[field as keyof typeof groupLabels] ?? field} target`
            : `${key === 'zone_factors' ? 'Zone ' : ''}${field} factor`;
        changes.push(`${label}: ${display(field, previous)} → ${display(field, value)}`);
      }
    }
    if (typeof after.body === 'string' && before.body !== after.body)
      changes.push('Updated the message');
    if (before.sort !== after.sort && 'sort' in after) changes.push('Changed the preset order');
  }
  return { sentence: sentences[row.action] ?? `changed ${target ?? 'a team record'}`, changes };
}
