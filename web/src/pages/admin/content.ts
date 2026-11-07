import type { Announcement, Preset, PresetInput, Settings } from '../../../../shared/types';
import { equivalentMeters } from '../../../../shared/math';
import { formatNumber } from '../../lib/format';
export function formatPresetFactor(value: number) {
  return formatNumber(value, 3).replace(/0{1,2}$/, '');
}
export function presetErrors(input: PresetInput) {
  return {
    name:
      !input.name.trim() || input.name.trim().length > 120
        ? 'Use a name from 1 to 120 characters.'
        : '',
    distance:
      input.distance_m !== null &&
      (!Number.isInteger(input.distance_m) || input.distance_m < 1 || input.distance_m > 200000)
        ? 'Use whole meters from 1 to 200,000.'
        : '',
  };
}
export function orderedPresets(rows: Preset[]) {
  return [...rows].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
}
export function movePreset(rows: Preset[], id: string, direction: -1 | 1) {
  const current = rows.find((row) => row.id === id);
  if (!current) return [];
  const group = orderedPresets(
    rows.filter((row) => row.modality === current.modality && row.zone === current.zone),
  );
  const index = group.findIndex((row) => row.id === id);
  const next = index + direction;
  if (next < 0 || next >= group.length) return [];
  [group[index], group[next]] = [group[next], group[index]];
  return group
    .map((row, index) => ({ id: row.id, sort: index * 10 }))
    .filter((row) => rows.find((item) => item.id === row.id)?.sort !== row.sort);
}
export function presetMeters(input: PresetInput, settings: Settings) {
  if (input.distance_m === null || presetErrors(input).distance) return null;
  return equivalentMeters(
    input.distance_m,
    input.modality,
    input.zone,
    settings.mode_factors,
    settings.zone_factors,
  );
}
export function announcementErrors(title: string, body: string) {
  return {
    title:
      !title.trim() || title.trim().length > 120 ? 'Use a title from 1 to 120 characters.' : '',
    body: !body.trim() || body.length > 5000 ? 'Use a message from 1 to 5,000 characters.' : '',
  };
}
export function orderedAnnouncements(rows: Announcement[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
}
