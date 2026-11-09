import type { Modality, Zone } from './types';
export const MODE_FACTORS: Record<Modality, number> = { erg: 1, bike: 1 / 3, run: 1.25 };
export const ZONE_FACTORS: Record<Zone, number> = {
  R: 0.8,
  'R/E': 0.9,
  E: 1,
  'E/D': 1.15,
  D: 1.35,
  'D/C': 1.6,
  C: 2.1,
  'C/B': 3,
  B: 5,
  A: 9,
};
export const PACE_OFFSETS: Record<Zone, number> = {
  R: 20,
  'R/E': 17.5,
  E: 15,
  'E/D': 12.5,
  D: 10,
  'D/C': 7.5,
  C: 5,
  'C/B': 2.5,
  B: 0,
  A: 0,
};
export const ZONES = Object.keys(ZONE_FACTORS) as Zone[];
export function floorPercent(value: number, digits: 0 | 1 = 0): number {
  const scale = 10 ** digits;
  return Number.isFinite(value) ? Math.floor(Math.max(0, value) * scale) / scale : NaN;
}
export function equivalentMeters(
  distance: number,
  modality: Modality,
  zone: Zone,
  modes = MODE_FACTORS,
  zones = ZONE_FACTORS,
): number {
  return Math.round(distance * modes[modality] * zones[zone]);
}
export function distanceForTarget(
  target: number,
  modality: Modality,
  zone: Zone,
  modes = MODE_FACTORS,
  zones = ZONE_FACTORS,
): number {
  return target / (modes[modality] * zones[zone]);
}
export function targetPace(
  zone: Zone,
  best6k: number | null,
  best2k: number | null,
): number | null {
  const base = zone === 'A' ? best2k : best6k;
  return base === null ? null : base + PACE_OFFSETS[zone];
}
export function formatMeters(meters: number, compact = false): string {
  return compact
    ? (meters / 1000).toFixed(1) + 'k'
    : Math.round(meters).toLocaleString('en-US') + ' m';
}
export function formatSplit(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  return Math.floor(tenths / 600) + ':' + ((tenths % 600) / 10).toFixed(1).padStart(4, '0');
}
