import { distanceForTarget, targetPace } from '../../../../shared/math';
import type { Config, Modality, Zone } from '../../../../shared/types';
import { formatKm, formatSplit } from '../../lib/format';
export function formulaFactor(mode: Modality, zone: Zone, config: Config) {
  const factor = 1 / distanceForTarget(1, mode, zone, config.mode_factors, config.zone_factors);
  const rounded = Number(factor.toFixed(3));
  return '× ' + (Number.isInteger(rounded) ? rounded.toFixed(1) : rounded);
}
export function targetDistance(eKm: number, mode: Modality, zone: Zone, config: Config) {
  if (!Number.isFinite(eKm) || eKm <= 0) return '—';
  const meters = distanceForTarget(
    eKm * 1000,
    mode,
    zone,
    config.mode_factors,
    config.zone_factors,
  );
  return formatKm(meters, meters >= 10000 ? 1 : 2);
}
export function zonePace(zone: Zone, six: number | null, two: number | null) {
  const pace = targetPace(zone, six, two);
  return pace === null ? '—' : formatSplit(pace) + '/500m';
}
