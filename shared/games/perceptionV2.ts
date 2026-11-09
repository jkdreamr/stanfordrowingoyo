import { closeness, isIntIn } from './daily';
import { PERCEPTION_ROUNDS, type PerceptionAnswer, type PerceptionPuzzle } from './perception';

export const PERCEPTION_V2_FROM = '2026-11-10';
export const PERCEPTION_POOL = [
  ...PERCEPTION_ROUNDS,
  'angle',
  'length',
  'count',
  'span',
  'shade',
  'bisect',
  'contact',
] as const;
export type PerceptionRoundId = (typeof PERCEPTION_POOL)[number];
export const PERCEPTION_FIELDS = {
  clock: 'clockMs',
  color: 'hue',
  dot: 'dot',
  pattern: 'cells',
  reaction: 'reactionMs',
  angle: 'angle',
  length: 'length',
  count: 'count',
  span: 'digits',
  shade: 'shade',
  bisect: 'bisect',
  contact: 'contactMs',
} as const;
export const PERCEPTION_EXPOSURE = {
  color: 700,
  dot: 400,
  pattern: 1000,
  angle: 800,
  length: 800,
  count: 600,
  shade: 800,
  span: 450,
} as const;
export const PERCEPTION_TYPICAL = {
  clock: 250,
  color: 12,
  dot: 40,
  pattern: 2,
  reaction: 110,
  angle: 5,
  length: 5,
  count: 18,
  span: 2,
  shade: 4,
  bisect: 2,
  contact: 110,
} as const;
export interface PerceptionV2Puzzle extends PerceptionPuzzle {
  angle: number;
  rotation: number;
  length: number;
  count: number;
  countDots: [number, number][];
  digits: string;
  shade: number;
  shadeBackgrounds: [number, number];
  endpoints: [[number, number], [number, number]];
  contact: {
    visibleMs: number;
    hiddenMs: number;
    from: [number, number];
    occlusion: [number, number];
    finish: [number, number];
  };
}
export interface PerceptionV2Answer {
  angle: number;
  length: number;
  count: number;
  digits: string;
  shade: number;
  bisect: [number, number];
  contactMs: number;
}
export type PerceptionRoundAnswer = Partial<PerceptionAnswer & PerceptionV2Answer>;

export function parsePerceptionRound(
  round: PerceptionRoundId,
  value: unknown,
  v2: boolean,
): PerceptionRoundAnswer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = PERCEPTION_FIELDS[round];
  const part = value as Record<string, unknown>;
  if (Object.keys(part).length !== 1 || !(field in part)) return null;
  const x = part[field];
  const pair = (n: unknown) =>
    Array.isArray(n) && n.length === 2 && n.every((v) => isIntIn(v, 0, 1000));
  let valid: boolean;
  switch (round) {
    case 'dot':
    case 'bisect':
      valid = pair(x);
      break;
    case 'pattern': {
      const size = v2 ? 9 : 7;
      valid =
        Array.isArray(x) &&
        x.length === size &&
        x.every((n) => isIntIn(n, 0, 24)) &&
        new Set(x).size === size;
      break;
    }
    case 'span':
      valid = typeof x === 'string' && /^\d{1,12}$/.test(x);
      break;
    case 'clock':
      valid = isIntIn(x, 0, 30000);
      break;
    case 'color':
      valid = isIntIn(x, 0, 359);
      break;
    case 'reaction':
      valid = x === -1 || isIntIn(x, 0, 3000);
      break;
    case 'angle':
      valid = isIntIn(x, 0, 180);
      break;
    case 'length':
      valid = isIntIn(x, 1, 1000);
      break;
    case 'count':
      valid = isIntIn(x, 1, 200);
      break;
    case 'shade':
      valid = isIntIn(x, 0, 100);
      break;
    case 'contact':
      valid = isIntIn(x, 0, 6000);
      break;
  }
  return valid ? { [field]: x } : null;
}

export function digitDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}

export function scorePerceptionRound(
  round: PerceptionRoundId,
  p: PerceptionV2Puzzle,
  a: PerceptionRoundAnswer,
): number {
  let miss: number;
  switch (round) {
    case 'clock':
      miss = a.clockMs! - p.clockMs;
      break;
    case 'color': {
      const d = Math.abs(a.hue! - p.hue);
      miss = Math.min(d, 360 - d);
      break;
    }
    case 'dot':
      miss = Math.hypot(a.dot![0] - p.dot[0], a.dot![1] - p.dot[1]);
      break;
    case 'pattern':
      miss = 9 - a.cells!.filter((c) => p.cells.includes(c)).length;
      break;
    case 'reaction':
      if (a.reactionMs! < 100) return 0;
      miss = Math.max(0, a.reactionMs! - 160);
      break;
    case 'angle':
      miss = a.angle! - p.angle;
      break;
    case 'length':
      miss = ((a.length! - p.length) / p.length) * 100;
      break;
    case 'count':
      miss = Math.log2(a.count! / p.count) * 100;
      break;
    case 'span':
      miss = digitDistance(a.digits!, p.digits);
      break;
    case 'shade':
      miss = a.shade! - p.shade;
      break;
    case 'bisect': {
      const [u, v] = p.endpoints;
      miss =
        (Math.hypot(a.bisect![0] - (u[0] + v[0]) / 2, a.bisect![1] - (u[1] + v[1]) / 2) /
          Math.hypot(v[0] - u[0], v[1] - u[1])) *
        100;
      break;
    }
    case 'contact':
      miss = a.contactMs! - p.contact.hiddenMs;
      break;
  }
  return closeness(miss, PERCEPTION_TYPICAL[round]);
}

export function perceptionExposure(round: PerceptionRoundId, p: PerceptionV2Puzzle): number {
  if (round === 'span') return p.digits.length * PERCEPTION_EXPOSURE.span;
  return round in PERCEPTION_EXPOSURE
    ? PERCEPTION_EXPOSURE[round as keyof typeof PERCEPTION_EXPOSURE]
    : 0;
}
