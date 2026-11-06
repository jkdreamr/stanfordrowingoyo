import { addDays } from '../../../shared/dates';
import { distanceForTarget } from '../../../shared/math';
import type { Config, Modality } from '../../../shared/types';
export function daysLeft(today: string, start: string) {
  return Math.max(
    0,
    Math.min(7, Math.round((Date.parse(addDays(start, 7)) - Date.parse(today)) / 86400000)),
  );
}
export function finishWeek(total: number, target: number, config: Config) {
  const remaining = Math.max(0, target - total);
  return (['erg', 'bike', 'run'] as Modality[]).map((modality) => ({
    modality,
    distance: distanceForTarget(remaining, modality, 'E', config.mode_factors, config.zone_factors),
  }));
}
