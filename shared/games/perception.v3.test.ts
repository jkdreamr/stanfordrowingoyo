import { expect, it } from 'vitest';
import { dailyRandom } from './daily';
import {
  PERCEPTION_POOL,
  PERCEPTION_V3_ROUNDS,
  PERCEPTION_V3_FROM,
  PERCEPTION_BEAT_FLASH_MS,
  PERCEPTION_FIELDS,
  parsePerceptionRound,
  scorePerceptionRound,
  perceptionExposure,
  perceptionContinuationPlausible,
  sequenceDistance,
  type PerceptionV3Puzzle,
  type PerceptionRoundAnswer,
} from './perceptionV2';
import {
  perceptionLineup,
  perceptionPuzzleForDate,
  perceptionV2Puzzle,
} from '../../worker/src/games/perceptionV2';
import { perceptionV3Targets } from '../../worker/src/games/perceptionV3';

const dateAt = (day: number) =>
  new Date(Date.parse(PERCEPTION_V3_FROM) + day * 86400000).toISOString().slice(0, 10);
const puzzleAt = (day: number) => perceptionPuzzleForDate(dateAt(day)) as PerceptionV3Puzzle;
function perfect(p: PerceptionV3Puzzle): PerceptionRoundAnswer {
  return {
    ...p,
    reactionMs: 160,
    contactMs: p.contact.hiddenMs,
    bisect: [
      (p.endpoints[0][0] + p.endpoints[1][0]) / 2,
      (p.endpoints[0][1] + p.endpoints[1][1]) / 2,
    ],
    beatMs: [p.beatIntervalMs, p.beatIntervalMs, p.beatIntervalMs, p.beatIntervalMs],
  };
}

it('keeps the v2 boundary and provides diverse deterministic v3 lineups across two years', () => {
  const started = performance.now();
  const lineups = Array.from({ length: 731 }, (_, day) => perceptionLineup(dateAt(day)));
  console.log('Perception v3 731 lineups ms:', (performance.now() - started).toFixed(2));
  expect(new Set(PERCEPTION_POOL).size).toBe(18);
  const previous = perceptionLineup('2026-11-11');
  expect(lineups[0].filter((r) => previous.includes(r)).length).toBeLessThanOrEqual(2);
  for (let day = 0; day < lineups.length; day++) {
    const rounds = lineups[day];
    expect(rounds).toEqual(perceptionLineup(dateAt(day)));
    expect(rounds).toHaveLength(5);
    expect(new Set(rounds).size).toBe(5);
    expect(rounds.every((r) => PERCEPTION_POOL.includes(r))).toBe(true);
    if (day)
      expect(rounds.filter((r) => lineups[day - 1].includes(r)).length).toBeLessThanOrEqual(2);
    if (day >= 6)
      expect([...new Set(lineups.slice(day - 6, day + 1).flat())].sort()).toEqual(
        [...PERCEPTION_POOL].sort(),
      );
  }
  for (const day of [-2, -1])
    expect(
      new Set(Array.from({ length: 7 }, (_, i) => perceptionLineup(dateAt(day + i))).flat()).size,
    ).toBe(18);
  const key = (rounds: readonly string[]) => [...rounds].sort().join(',');
  for (let period = 1; period < 30; period++)
    expect(
      lineups.some((rounds, i) => i >= period && key(rounds) !== key(lineups[i - period])),
    ).toBe(true);
  expect(
    [72, 144, 216].some((day) => perceptionLineup(dateAt(day)).join(',') !== lineups[0].join(',')),
  ).toBe(true);
  expect(
    [72, 144, 216].every((day) => key(perceptionLineup(dateAt(day))) === key(lineups[0])),
  ).toBe(true);
  expect(perceptionLineup(dateAt(100000))).toEqual(perceptionLineup(dateAt(100000)));
});

it('generates bounded phone-fair v3 targets without shifting any v2 random fields', () => {
  for (let day = 0; day < 731; day++) {
    const p = puzzleAt(day);
    expect(p).toEqual(puzzleAt(day));
    expect(p).toMatchObject(perceptionV2Puzzle(dateAt(day)));
    expect(p.ratio).toBeGreaterThanOrEqual(15);
    expect(p.ratio).toBeLessThanOrEqual(85);
    const [a, b] = p.ratioDiameters;
    expect(a).not.toBe(b);
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(300);
    expect(Math.max(a, b)).toBeLessThanOrEqual(400);
    expect(Math.round(100 * (Math.min(a, b) / Math.max(a, b)) ** 2)).toBe(p.ratio);
    expect(p.beatIntervalMs).toBeGreaterThanOrEqual(450);
    expect(p.beatIntervalMs).toBeLessThanOrEqual(900);
    expect(p.durationMs).toBeGreaterThanOrEqual(800);
    expect(p.durationMs).toBeLessThanOrEqual(2500);
    expect(p.order.length).toBeGreaterThanOrEqual(6);
    expect(p.order.length).toBeLessThanOrEqual(7);
    expect(new Set(p.order).size).toBe(p.order.length);
    expect(p.order.every((n) => Number.isInteger(n) && n >= 0 && n <= 15)).toBe(true);
    const { from, to } = p.path;
    expect(from[0]).toBeGreaterThanOrEqual(80);
    expect(from[0]).toBeLessThanOrEqual(180);
    expect(to[0]).toBeGreaterThanOrEqual(450);
    expect(to[0]).toBeLessThanOrEqual(600);
    expect(p.pathY).toBeGreaterThanOrEqual(100);
    expect(p.pathY).toBeLessThanOrEqual(900);
    expect(from[1]).toBeGreaterThanOrEqual(100);
    expect(from[1]).toBeLessThanOrEqual(900);
    expect(to[1]).toBeGreaterThanOrEqual(100);
    expect(to[1]).toBeLessThanOrEqual(900);
    expect(Math.round(from[1] + ((1000 - from[0]) * (to[1] - from[1])) / (to[0] - from[0]))).toBe(
      p.pathY,
    );
    expect(p.centroidDots.length).toBeGreaterThanOrEqual(6);
    expect(p.centroidDots.length).toBeLessThanOrEqual(9);
    for (const [i, point] of p.centroidDots.entries()) {
      expect(point.every((n) => Number.isInteger(n) && n >= 50 && n <= 950)).toBe(true);
      expect(
        p.centroidDots
          .slice(i + 1)
          .every((q) => Math.hypot(point[0] - q[0], point[1] - q[1]) >= 100),
      ).toBe(true);
    }
    expect(p.centroid).toEqual(
      [0, 1].map((i) =>
        Math.round(
          p.centroidDots.reduce((sum, point) => sum + point[i], 0) / p.centroidDots.length,
        ),
      ),
    );
  }
  expect(() => perceptionV3Targets('bad')).toThrow('Invalid Perception puzzle date');
  expect(() => perceptionPuzzleForDate('bad')).toThrow('Invalid Perception puzzle date');
});

it.each(PERCEPTION_V3_ROUNDS)('validates %s normal, empty and malformed answers', (round) => {
  const p = puzzleAt(0),
    a = perfect(p),
    field = PERCEPTION_FIELDS[round];
  expect(parsePerceptionRound(round, { [field]: a[field] }, true)).toEqual({ [field]: a[field] });
  const valid = {
    ratio: [1, 100],
    beat: [[100, 100, 3000, 3000]],
    path: [0, 1000],
    order: [[0], [0, 15, 0, 15, 0, 15, 0, 15, 0, 15]],
    duration: [0, 10000],
    centroid: [
      [0, 0],
      [1000, 1000],
    ],
  };
  const invalid = {
    ratio: [0, 101, -1, 1.5, '36', NaN, Infinity],
    beat: [
      [],
      [600, 600, 600],
      [600, 600, 600, 600, 600],
      [99, 600, 600, 600],
      [3001, 600, 600, 600],
      [600.5, 600, 600, 600],
      ['600', 600, 600, 600],
      [NaN, 600, 600, 600],
    ],
    path: [-1, 1001, 0.5, '500', NaN, Infinity],
    order: [[], Array(11).fill(0), [-1], [16], [0.5], ['0'], [NaN]],
    duration: [-1, 10001, 1.5, '1350', NaN, Infinity],
    centroid: [[], [0], [0, 0, 0], [-1, 500], [1001, 500], [500, 0.5], ['500', 500], [NaN, 500]],
  };
  for (const value of valid[round])
    expect(parsePerceptionRound(round, { [field]: value }, true)).not.toBeNull();
  for (const value of [...invalid[round], null, undefined, {}, true])
    expect(parsePerceptionRound(round, { [field]: value }, true)).toBeNull();
  for (const value of [
    null,
    undefined,
    [],
    {},
    false,
    { wrong: 1 },
    { [field]: a[field], extra: 1 },
  ])
    expect(parsePerceptionRound(round, value, true)).toBeNull();
});

it.each(PERCEPTION_V3_ROUNDS)('scores %s perfectly, monotonically and within bounds', (round) => {
  const p = {
    ...puzzleAt(0),
    ratio: 40,
    beatIntervalMs: 600,
    pathY: 500,
    order: [0, 1, 2, 3, 4, 5],
    durationMs: 1000,
    centroid: [500, 500] as [number, number],
  };
  const miss = (scale: number): PerceptionRoundAnswer => {
    switch (round) {
      case 'ratio':
        return { ratio: p.ratio * 2 ** (0.15 * scale) };
      case 'beat':
        return {
          beatMs: [
            600 * (1 + 0.06 * scale),
            600 * (1 + 0.06 * scale),
            600 * (1 + 0.06 * scale),
            600 * (1 + 0.06 * scale),
          ],
        };
      case 'path':
        return { pathY: 500 + 40 * scale };
      case 'order':
        return { order: p.order.slice(Math.min(6, scale)) };
      case 'duration':
        return { durationMs: 1000 + 80 * scale };
      case 'centroid':
        return { centroid: [500 + 35 * scale, 500] };
    }
  };
  const scores = [0, 1, 2, 3, 4, 5, 6].map((n) => scorePerceptionRound(round, p, miss(n)));
  expect(scores[0]).toBe(100);
  if (round === 'order') expect(scores.slice(1, 3)).toEqual([80, 42]);
  else expect(scores[1]).toBe(61);
  expect(scores[6]).toBe(0);
  expect(
    scores.every(
      (score, i) =>
        Number.isInteger(score) && score >= 0 && score <= 100 && (!i || score <= scores[i - 1]),
    ),
  ).toBe(true);
});

it('uses sequence edits, not numeric distance, for Flash Order', () => {
  expect(sequenceDistance([], [])).toBe(0);
  expect(sequenceDistance([], [1, 2])).toBe(2);
  expect(sequenceDistance([1, 2], [])).toBe(2);
  expect(sequenceDistance([1, 2, 3], [1, 3])).toBe(1);
  expect(sequenceDistance([1, 2, 3], [1, 15, 3])).toBe(1);
  expect(sequenceDistance([1, 2, 3], [1, 2, 2, 3])).toBe(1);
  expect(sequenceDistance([1, 2], [2, 1])).toBe(2);
});

it('defines complete exposures and exact inclusive continuation slack', () => {
  expect(PERCEPTION_BEAT_FLASH_MS).toBe(100);
  const p = { ...puzzleAt(0), beatIntervalMs: 600, durationMs: 1350 };
  expect(PERCEPTION_V3_ROUNDS.map((r) => perceptionExposure(r, p))).toEqual([
    1000,
    2400,
    900,
    p.order.length * 500,
    1350,
    1000,
  ]);
  const a: PerceptionRoundAnswer = { beatMs: [600, 600, 600, 600], durationMs: 1350 };
  expect(perceptionContinuationPlausible('beat', p, a, 3799)).toBe(false);
  expect(perceptionContinuationPlausible('beat', p, a, 3800)).toBe(true);
  expect(perceptionContinuationPlausible('duration', p, a, 1699)).toBe(false);
  expect(perceptionContinuationPlausible('duration', p, a, 1700)).toBe(true);
  expect(perceptionContinuationPlausible('ratio', p, a, 1000)).toBe(true);
});

it('calibrates v3 good players and proves every generated day can score 500', () => {
  const rand = dailyRandom('perception-good-player-v3', 'simulation');
  const normal = () =>
    Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));
  const totals: number[] = [];
  for (let day = 0; day < 10000; day++) {
    const p = puzzleAt(day),
      a = perfect(p),
      rounds = perceptionLineup(dateAt(day));
    a.clockMs = clamp(p.clockMs + normal() * 250, 0, 30000);
    a.hue = ((Math.round(p.hue + normal() * 12) % 360) + 360) % 360;
    a.dot = [clamp(p.dot[0] + normal() * 40, 0, 1000), clamp(p.dot[1] + normal() * 40, 0, 1000)];
    const misses = Math.min(9, Math.round(Math.abs(normal()) * 2));
    a.cells = [
      ...p.cells.slice(misses),
      ...Array.from({ length: 25 }, (_, i) => i)
        .filter((i) => !p.cells.includes(i))
        .slice(0, misses),
    ];
    a.reactionMs = clamp(260 + normal() * 40, 0, 3000);
    a.angle = clamp(p.angle + normal() * 5, 0, 180);
    a.length = clamp(p.length * (1 + normal() * 0.05), 1, 1000);
    a.count = clamp(p.count * 2 ** (normal() * 0.18), 1, 200);
    const errors = Math.min(p.digits.length, Math.round(Math.abs(normal()) * 2));
    a.digits = [...p.digits]
      .map((d, i) => (i < errors ? String((Number(d) + 1) % 10) : d))
      .join('');
    a.shade = clamp(p.shade + normal() * 4, 0, 100);
    const [u, v] = p.endpoints,
      sd = Math.hypot(v[0] - u[0], v[1] - u[1]) * 0.02;
    a.bisect = [
      clamp((u[0] + v[0]) / 2 + normal() * sd, 0, 1000),
      clamp((u[1] + v[1]) / 2 + normal() * sd, 0, 1000),
    ];
    a.contactMs = clamp(p.contact.hiddenMs + normal() * 110, 0, 6000);
    a.ratio = clamp(p.ratio * 2 ** (normal() * 0.15), 1, 100);
    a.beatMs = [
      clamp(p.beatIntervalMs * (1 + normal() * 0.06), 100, 3000),
      clamp(p.beatIntervalMs * (1 + normal() * 0.06), 100, 3000),
      clamp(p.beatIntervalMs * (1 + normal() * 0.06), 100, 3000),
      clamp(p.beatIntervalMs * (1 + normal() * 0.06), 100, 3000),
    ];
    a.pathY = clamp(p.pathY + normal() * 40, 0, 1000);
    a.order = p.order.slice(Math.min(p.order.length - 1, Math.round(Math.abs(normal()) * 1.5)));
    a.durationMs = clamp(p.durationMs * (1 + normal() * 0.08), 0, 10000);
    a.centroid = [
      clamp(p.centroid[0] + normal() * 35, 0, 1000),
      clamp(p.centroid[1] + normal() * 35, 0, 1000),
    ];
    expect(rounds.reduce((sum, r) => sum + scorePerceptionRound(r, p, perfect(p)), 0)).toBe(500);
    for (const round of rounds) {
      const field = PERCEPTION_FIELDS[round];
      expect(parsePerceptionRound(round, { [field]: a[field] }, true)).not.toBeNull();
    }
    totals.push(rounds.reduce((sum, r) => sum + scorePerceptionRound(r, p, a), 0));
    if (day === 2999 || day === 9999) {
      const sorted = [...totals].sort((a, b) => a - b),
        n = sorted.length,
        median = sorted[n / 2],
        rare = sorted.filter((x) => x >= 450).length / n;
      console.log(
        `Perception v3 good player n=${n}: median=${median}, p10=${sorted[n / 10]}, p90=${sorted[n * 0.9]}, P>=450=${(rare * 100).toFixed(2)}%`,
      );
      expect(median).toBeGreaterThanOrEqual(250);
      expect(median).toBeLessThanOrEqual(350);
      expect(rare).toBeLessThan(0.03);
    }
  }
});
