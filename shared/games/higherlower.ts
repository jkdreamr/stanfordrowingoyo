export const HIGHERLOWER_ID = 'higherlower';
export const CHAIN_LENGTH = 21;
export const ROUNDS = 20;
export const HIGHERLOWER_UNITS = [
  'm',
  'km',
  'km2',
  'people',
  'usd',
  'year',
  'kcal',
  'seats',
  'kg',
  's',
  'mph',
  'g/cm3',
  'passengers',
  'points',
] as const;
export type HigherLowerUnit = (typeof HIGHERLOWER_UNITS)[number];
export type HigherLowerChoice = 'higher' | 'lower';

const number = (value: number, decimals = 0) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
export function formatHigherLowerValue(value: number, unit: HigherLowerUnit): string {
  if (unit === 'km') return `${Math.round(value).toLocaleString('en-US')} km`;
  if (unit === 'year') return String(value);
  if (unit === 's') {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  if (unit === 'usd' || unit === 'people' || unit === 'passengers') {
    const scale = value >= 1e12 ? 1e12 : value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : 1;
    const suffix =
      scale === 1e12 ? ' trillion' : scale === 1e9 ? ' billion' : scale === 1e6 ? ' million' : '';
    return `${unit === 'usd' ? '$' : ''}${number(value / scale, scale > 1 || unit === 'usd' ? 2 : 0)}${suffix}${unit !== 'usd' ? ' ' + unit : ''}`;
  }
  if (unit === 'g/cm3')
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g/cm³`;
  return `${number(value, ['m', 'km2', 'kg', 'mph'].includes(unit) ? 1 : 0)} ${unit === 'km2' ? 'km²' : unit === 'kcal' ? 'kcal / 100 g' : unit}`;
}
export const formatHigherLowerScore = (score: number) => `${score} / ${ROUNDS}`;
export function higherLowerShare(date: string, score: number, results: readonly boolean[]) {
  return [
    `OYO Higher or Lower ${date}`,
    '',
    formatHigherLowerScore(score),
    results.map((correct) => (correct ? '🟩' : '🟥')).join(''),
  ].join('\n');
}
