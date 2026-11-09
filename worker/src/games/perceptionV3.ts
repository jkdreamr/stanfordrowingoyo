import { dailyRandom, dayNumber } from '../../../shared/games/daily';
import {
  PERCEPTION_POOL,
  PERCEPTION_V2_POOL,
  PERCEPTION_V3_FROM,
  type PerceptionRoundId,
  type PerceptionV3Targets,
} from '../../../shared/games/perceptionV2';

const epochCache = new Map<number, PerceptionRoundId[][]>();
function perceptionV3Epoch(epoch: number): PerceptionRoundId[][] {
  const cached = epochCache.get(epoch);
  if (cached) return cached;
  const days = Array.from({ length: 72 }, (_, d) =>
    Array.from(
      { length: 5 },
      (_, i) => PERCEPTION_POOL[(d * 5 + i + PERCEPTION_V2_POOL.length) % PERCEPTION_POOL.length],
    ),
  );
  const rand = dailyRandom('perception-lineup-v3', String(epoch));
  const valid = (d: number) => {
    if (new Set(days[d]).size !== 5) return false;
    for (const n of [d - 1, d])
      if (n >= 0 && n < 71 && days[n].filter((r) => days[n + 1].includes(r)).length > 2)
        return false;
    for (let n = Math.max(0, d - 6); n <= Math.min(65, d); n++)
      if (new Set(days.slice(n, n + 7).flat()).size !== 18) return false;
    return true;
  };
  // Fixed boundary days preserve seven-day coverage across independent epochs.
  for (let n = 0; n < 320; n++) {
    const a = 6 + Math.floor(rand() * 60),
      b = 6 + Math.floor(rand() * 60),
      i = Math.floor(rand() * 5),
      j = Math.floor(rand() * 5);
    [days[a][i], days[b][j]] = [days[b][j], days[a][i]];
    if (!valid(a) || !valid(b)) [days[a][i], days[b][j]] = [days[b][j], days[a][i]];
  }
  if (epochCache.size >= 2) epochCache.clear();
  epochCache.set(epoch, days);
  return days;
}

export function perceptionV3Lineup(date: string): PerceptionRoundId[] {
  const day = dayNumber(date) - dayNumber(PERCEPTION_V3_FROM);
  const rounds = [...perceptionV3Epoch(Math.floor(day / 72))[day % 72]];
  const rand = dailyRandom('perception-order-v3', date);
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
  }
  return rounds;
}

export function perceptionV3Targets(date: string): PerceptionV3Targets {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid Perception puzzle date');
  const rand = dailyRandom('perception-v3', date);
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const ratio = pick(15, 85),
    diameter = pick(300, 400);
  const ratioDiameters: [number, number] = [diameter, diameter * Math.sqrt(ratio / 100)];
  if (rand() < 0.5) ratioDiameters.reverse();
  const beatIntervalMs = pick(9, 18) * 50;
  const pathY = pick(100, 900),
    from: [number, number] = [pick(80, 180), pick(100, 900)],
    x = pick(450, 600);
  const path = {
    from,
    to: [x, from[1] + ((pathY - from[1]) * (x - from[0])) / (1000 - from[0])] as [number, number],
  };
  const cells = Array.from({ length: 16 }, (_, i) => i);
  for (let i = 15; i > 0; i--) {
    const j = pick(0, i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const order = cells.slice(0, pick(6, 7)),
    durationMs = pick(16, 50) * 50;
  const count = pick(6, 9),
    cx = pick(250, 750),
    cy = pick(250, 750),
    centroidDots: [number, number][] = [];
  for (let attempt = 0; centroidDots.length < count && attempt < 1000; attempt++) {
    const point: [number, number] = [pick(cx - 200, cx + 200), pick(cy - 200, cy + 200)];
    if (centroidDots.every(([x, y]) => (x - point[0]) ** 2 + (y - point[1]) ** 2 >= 100 ** 2))
      centroidDots.push(point);
  }
  if (centroidDots.length !== count) throw new Error('Invalid Perception puzzle date');
  const centroid: [number, number] = [
    Math.round(centroidDots.reduce((sum, p) => sum + p[0], 0) / count),
    Math.round(centroidDots.reduce((sum, p) => sum + p[1], 0) / count),
  ];
  return {
    ratio,
    ratioDiameters,
    beatIntervalMs,
    pathY,
    path,
    order,
    durationMs,
    centroidDots,
    centroid,
  };
}
