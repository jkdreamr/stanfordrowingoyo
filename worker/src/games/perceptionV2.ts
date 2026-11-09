import { dailyRandom, dayNumber } from '../../../shared/games/daily';
import { PERCEPTION_ROUNDS } from '../../../shared/games/perception';
import {
  PERCEPTION_V2_POOL,
  PERCEPTION_V2_FROM,
  PERCEPTION_V3_FROM,
  type PerceptionRoundId,
  type PerceptionV2Puzzle,
  type PerceptionV2RoundId,
  type PerceptionV3Puzzle,
} from '../../../shared/games/perceptionV2';
import { perceptionV3Lineup, perceptionV3Targets } from './perceptionV3';

const epochCache = new Map<number, PerceptionV2RoundId[][]>();
function perceptionEpoch(epoch: number): PerceptionV2RoundId[][] {
  const cached = epochCache.get(epoch);
  if (cached) return cached;
  const days = Array.from({ length: 60 }, (_, d) =>
    Array.from(
      { length: 5 },
      (_, i) => PERCEPTION_V2_POOL[(d * 5 + i + PERCEPTION_ROUNDS.length) % 12],
    ),
  );
  const rand = dailyRandom('perception-lineup-v2', String(epoch));
  const valid = (d: number) => {
    if (new Set(days[d]).size !== 5) return false;
    for (const n of [d - 1, d])
      if (n >= 0 && n < 59 && days[n].filter((r) => days[n + 1].includes(r)).length > 2)
        return false;
    for (let n = Math.max(0, d - 4); n <= Math.min(55, d); n++)
      if (new Set(days.slice(n, n + 5).flat()).size !== 12) return false;
    return true;
  };
  // Fixed boundary days preserve every constraint across independently generated epochs.
  for (let n = 0; n < 320; n++) {
    const a = 4 + Math.floor(rand() * 52),
      b = 4 + Math.floor(rand() * 52);
    const i = Math.floor(rand() * 5),
      j = Math.floor(rand() * 5);
    [days[a][i], days[b][j]] = [days[b][j], days[a][i]];
    if (!valid(a) || !valid(b)) [days[a][i], days[b][j]] = [days[b][j], days[a][i]];
  }
  if (epochCache.size >= 2) epochCache.clear();
  epochCache.set(epoch, days);
  return days;
}

export function perceptionV2Lineup(date: string): PerceptionV2RoundId[] {
  if (date < PERCEPTION_V2_FROM) return [...PERCEPTION_ROUNDS];
  const day = dayNumber(date) - dayNumber(PERCEPTION_V2_FROM);
  const rounds = [...perceptionEpoch(Math.floor(day / 60))[day % 60]];
  const rand = dailyRandom('perception-order-v2', date);
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
  }
  return rounds;
}

export function perceptionLineup(date: string): PerceptionRoundId[] {
  return date >= PERCEPTION_V3_FROM ? perceptionV3Lineup(date) : perceptionV2Lineup(date);
}

export function perceptionPuzzleForDate(date: string): PerceptionV2Puzzle | PerceptionV3Puzzle {
  const puzzle = perceptionV2Puzzle(date);
  return date >= PERCEPTION_V3_FROM ? { ...puzzle, ...perceptionV3Targets(date) } : puzzle;
}

export function perceptionV2Puzzle(date: string): PerceptionV2Puzzle {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid Perception puzzle date');
  const rand = dailyRandom('perception-v2', date);
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const clockMs = pick(30, 80) * 100,
    hue = pick(0, 359);
  const dot: [number, number] = [pick(100, 900), pick(100, 900)];
  const cells = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 24; i > 0; i--) {
    const j = pick(0, i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const reactionDelayMs = pick(15, 50) * 100;
  const angle = pick(15, 165),
    rotation = pick(0, 359),
    length = pick(250, 800),
    count = pick(30, 80);
  const countDots: [number, number][] = [];
  for (let attempt = 0; countDots.length < count && attempt < 5000; attempt++) {
    const point: [number, number] = [pick(35, 965), pick(35, 965)];
    if (countDots.every(([x, y]) => (x - point[0]) ** 2 + (y - point[1]) ** 2 >= 70 ** 2))
      countDots.push(point);
  }
  if (countDots.length !== count) throw new Error('Invalid Perception puzzle date');
  const digits = Array.from({ length: pick(8, 9) }, () => String(pick(0, 9))).join('');
  const shade = pick(20, 80),
    shadeBackgrounds: [number, number] = rand() < 0.5 ? [10, 90] : [90, 10];
  const theta = rand() * Math.PI * 2,
    half = pick(251, 449);
  const dx = Math.round(Math.cos(theta) * half),
    dy = Math.round(Math.sin(theta) * half);
  const cx = pick(Math.abs(dx) + 30, 970 - Math.abs(dx)),
    cy = pick(Math.abs(dy) + 30, 970 - Math.abs(dy));
  const endpoints: [[number, number], [number, number]] = [
    [cx - dx, cy - dy],
    [cx + dx, cy + dy],
  ];
  const visibleMs = pick(1000, 1800),
    hiddenMs = pick(700, 1800);
  const contact: PerceptionV2Puzzle['contact'] = {
    visibleMs,
    hiddenMs,
    from: [100, 500],
    occlusion: [500, 500],
    finish: [500 + (400 * hiddenMs) / visibleMs, 500],
  };
  // Fit the trajectory in the board while retaining constant speed and exact timing.
  const scale = 800 / (contact.finish[0] - 100);
  contact.occlusion[0] = 100 + 400 * scale;
  contact.finish[0] = 900;
  return {
    clockMs,
    hue,
    dot,
    cells: cells.slice(0, 9).sort((a, b) => a - b),
    reactionDelayMs,
    angle,
    rotation,
    length,
    count,
    countDots,
    digits,
    shade,
    shadeBackgrounds,
    endpoints,
    contact,
  };
}
