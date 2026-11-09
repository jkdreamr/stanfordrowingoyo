import { worldleNames } from './worldleNames';

export const WORLDLE_ID = 'worldle';
export const TRIES = 6;

export function normalizeCountry(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst\b\.?/g, 'saint ')
    .replace(/[.,'’\-()]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the /, '');
}

const countryIndices = new Map<string, number>();
worldleNames.forEach((country, index) => {
  for (const name of [country.name, ...country.aliases]) {
    countryIndices.set(normalizeCountry(name), index);
  }
});

export function resolveCountry(input: string): number | null {
  return countryIndices.get(normalizeCountry(input)) ?? null;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = radians(lat1);
  const b = radians(lat2);
  const d = radians(lon2 - lon1);
  return (
    ((Math.atan2(
      Math.sin(d) * Math.cos(b),
      Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(d),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function compass8(bearing: number): (typeof directions)[number] {
  return directions[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function proximity(km: number): number {
  return Math.floor((Math.max(20000 - km, 0) / 20000) * 100);
}

export function worldleShare(
  date: string,
  rows: readonly { proximity: number; direction: (typeof directions)[number]; correct: boolean }[],
  solved: boolean,
  tries: number,
): string {
  const arrows = { N: '⬆️', NE: '↗️', E: '➡️', SE: '↘️', S: '⬇️', SW: '↙️', W: '⬅️', NW: '↖️' };
  return [
    `OYO Worldle ${date} ${solved ? tries : 'X'}/${TRIES}`,
    '',
    ...rows.map((row) => {
      const percent = Math.max(0, Math.min(100, row.proximity));
      const green = Math.floor(percent / 20);
      const yellow = percent % 20 >= 10 ? 1 : 0;
      return (
        '🟩'.repeat(green) +
        '🟨'.repeat(yellow) +
        '⬜'.repeat(5 - green - yellow) +
        (row.correct ? '🎉' : arrows[row.direction])
      );
    }),
  ].join('\n');
}
