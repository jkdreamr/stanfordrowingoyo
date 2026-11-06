import { addDays } from '../../../shared/dates';
import { equivalentMeters } from '../../../shared/math';
import type {
  Config,
  EntryDetail,
  EntryInput,
  Modality,
  Preset,
  Zone,
} from '../../../shared/types';
import {
  formatDuration,
  formatKm,
  formatMeters,
  formatSplit,
  parseDuration,
  parseSplit,
  splitFromTime,
} from './format';
export type LogDraft = {
  modality: Modality;
  zone: Zone;
  distance: string;
  unit: 'm' | 'km';
  date: string;
  duration: string;
  split: string;
  rate: string;
  hr: string;
  title: string;
  notes: string;
  private: boolean;
  preset: string | null;
};
export function logDraft(today: string, entry?: EntryDetail, preset?: Preset): LogDraft {
  return {
    modality: entry?.modality ?? preset?.modality ?? 'erg',
    zone: entry?.zone ?? preset?.zone ?? 'E',
    distance: String(entry?.distance_m ?? preset?.distance_m ?? ''),
    unit: 'm',
    date: entry?.date ?? today,
    duration: entry?.duration_s ? formatDuration(entry.duration_s) : '',
    split: entry?.avg_split_s ? formatSplit(entry.avg_split_s) : '',
    rate: entry?.stroke_rate ? String(entry.stroke_rate) : '',
    hr: entry?.avg_hr ? String(entry.avg_hr) : '',
    title: entry?.title ?? preset?.name ?? '',
    notes: entry?.notes ?? '',
    private: entry?.visibility === 'private',
    preset: entry?.preset_id ?? preset?.id ?? null,
  };
}
export function distanceMeters(draft: LogDraft) {
  return Number(draft.distance) * (draft.unit === 'km' ? 1000 : 1);
}
export function suggestedTitle(draft: LogDraft) {
  const meters = distanceMeters(draft);
  if (!Number.isFinite(meters) || meters <= 0) return 'e.g. 3x6k E';
  return `${draft.unit === 'km' ? formatKm(meters) : formatMeters(meters)} ${draft.zone} ${draft.modality === 'erg' ? 'Erg' : draft.modality === 'bike' ? 'Bike' : 'Run'}`;
}
export function logValues(
  draft: LogDraft,
  config: Config,
  photos: readonly { key: string; id?: string; file?: File }[] = [],
) {
  const distance = distanceMeters(draft);
  const duration = draft.duration ? parseDuration(draft.duration) : null;
  const derivedSplit =
    draft.modality === 'erg' && duration !== null && distance > 0
      ? splitFromTime(duration, distance)
      : null;
  const errors: Record<string, string> = {};
  if (!Number.isInteger(distance) || distance < 1 || distance > 200000)
    errors.distance = 'Enter 1–200,000 whole meters';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(Date.parse(draft.date)) ||
    new Date(draft.date).toISOString().slice(0, 10) !== draft.date ||
    draft.date < '2020-01-01' ||
    draft.date > addDays(config.today, 1)
  )
    errors.date = 'Choose a date between 2020 and tomorrow';
  if (!config.zones.includes(draft.zone)) errors.zone = 'Choose a valid zone';
  if (
    draft.duration &&
    (duration === null || !Number.isInteger(duration) || duration < 1 || duration > 86400)
  )
    errors.duration = 'Enter a duration from 1 second to 24 hours';
  const split = draft.split ? parseSplit(draft.split) : derivedSplit;
  if (
    (draft.split && split === null) ||
    (split !== null && (!Number.isFinite(split) || split < 60 || split > 600))
  )
    errors.split = 'Enter a split from 1:00.0 to 10:00.0';
  for (const key of ['rate', 'hr'] as const)
    if (
      draft[key] &&
      (!Number.isInteger(Number(draft[key])) ||
        Number(draft[key]) < (key === 'rate' ? 10 : 30) ||
        Number(draft[key]) > (key === 'rate' ? 60 : 240))
    )
      errors[key] =
        key === 'rate'
          ? 'Enter a whole stroke rate from 10 to 60'
          : 'Enter a whole heart rate from 30 to 240';
  if (draft.title.trim().length > 120) errors.title = 'Keep the title to 120 characters';
  if (draft.notes.length > 2000) errors.notes = 'Keep notes to 2,000 characters';
  if (
    photos.length > 4 ||
    new Set(photos.map((photo) => photo.id ?? photo.file ?? photo.key)).size !== photos.length ||
    photos.some((photo) => photo.id !== undefined && (photo.id.length < 1 || photo.id.length > 200))
  )
    errors.photos = 'Choose up to four unique photos';
  const input: EntryInput = {
    date: draft.date,
    modality: draft.modality,
    zone: draft.zone,
    distance_m: distance,
    duration_s: duration,
    avg_split_s: split,
    stroke_rate: draft.rate ? Number(draft.rate) : null,
    avg_hr: draft.hr ? Number(draft.hr) : null,
    title: draft.title.trim() || suggestedTitle(draft),
    notes: draft.notes,
    visibility: draft.private ? 'private' : 'team',
    preset_id: draft.preset,
  };
  return {
    errors,
    input,
    derivedSplit,
    equivalent: equivalentMeters(
      distance,
      draft.modality,
      draft.zone,
      config.mode_factors,
      config.zone_factors,
    ),
  };
}
