import { expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { perceptionPuzzle, scorePerception } from '../../worker/src/games/perception';
import {
  perceptionV2Lineup as perceptionLineup,
  perceptionV2Puzzle,
  perceptionLineup as runtimeLineup,
  perceptionPuzzleForDate,
} from '../../worker/src/games/perceptionV2';
import { dailyRandom } from './daily';
import { perceptionShare, perceptionTotal } from './perception';
import {
  PERCEPTION_FIELDS,
  PERCEPTION_V2_POOL as PERCEPTION_POOL,
  PERCEPTION_POOL as RUNTIME_POOL,
  PERCEPTION_V3_FROM,
  isPerceptionV3Puzzle,
  PERCEPTION_TYPICAL,
  parsePerceptionRound,
  scorePerceptionRound,
  digitDistance,
  type PerceptionV2Puzzle,
  type PerceptionRoundAnswer,
  type PerceptionV2RoundId as PerceptionRoundId,
} from './perceptionV2';

const dateAt = (day: number) => new Date(Date.UTC(2026, 10, 10 + day)).toISOString().slice(0, 10);
const perfect = (p: PerceptionV2Puzzle): PerceptionRoundAnswer => ({
  ...p,
  reactionMs: 160,
  bisect: [
    (p.endpoints[0][0] + p.endpoints[1][0]) / 2,
    (p.endpoints[0][1] + p.endpoints[1][1]) / 2,
  ],
  contactMs: p.contact.hiddenMs,
});

it.each(Array.from({ length: 21 }, (_, day) => dateAt(day)))(
  '%s generates valid stimuli and five bounded scores with a 500 maximum',
  (date) => {
    const rounds = runtimeLineup(date);
    expect(new Set(rounds).size).toBe(5);
    const previous = dateAt(Math.round((Date.parse(date) - Date.parse(dateAt(0))) / 86400000) - 1);
    expect(
      rounds.filter((round) => runtimeLineup(previous).includes(round)).length,
    ).toBeLessThanOrEqual(2);
    const p = perceptionPuzzleForDate(date);
    expect(perceptionPuzzle(date)).toEqual(p);
    const v3 = isPerceptionV3Puzzle(p);
    expect(v3).toBe(date >= PERCEPTION_V3_FROM);
    const pool = v3 ? RUNTIME_POOL : PERCEPTION_POOL;
    expect(rounds.every((round) => pool.some((id) => id === round))).toBe(true);
    const answer = perfect(p);
    if (v3)
      answer.beatMs = [p.beatIntervalMs, p.beatIntervalMs, p.beatIntervalMs, p.beatIntervalMs];
    expect(p.clockMs).toBeGreaterThanOrEqual(3000);
    expect(p.clockMs).toBeLessThanOrEqual(8000);
    expect(p.rotation).toBeGreaterThanOrEqual(0);
    expect(p.rotation).toBeLessThanOrEqual(359);
    expect(p.reactionDelayMs).toBeGreaterThanOrEqual(1500);
    expect(p.reactionDelayMs).toBeLessThanOrEqual(5000);
    expect(p.shadeBackgrounds.slice().sort((a, b) => a - b)).toEqual([10, 90]);
    expect(p.countDots).toHaveLength(p.count);
    expect(p.count).toBeGreaterThanOrEqual(30);
    expect(p.count).toBeLessThanOrEqual(80);
    for (const [x, y] of [
      ...p.countDots,
      ...p.endpoints,
      p.dot,
      p.contact.from,
      p.contact.occlusion,
      p.contact.finish,
    ]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1000);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1000);
    }
    for (const round of pool) {
      const field = PERCEPTION_FIELDS[round];
      expect(parsePerceptionRound(round, { [field]: answer[field] }, true)).not.toBeNull();
      expect(scorePerceptionRound(round, p, answer)).toBe(100);
    }
    const scores = scorePerception(date, answer);
    expect(Object.keys(scores)).toEqual(rounds);
    expect(perceptionTotal(scores, rounds)).toBe(500);
    console.log(`${date}: ${rounds.join(', ')}; max=500`);
  },
);

it('pins pre-cutover puzzles and scores captured before changing the generator', () => {
  const fixtures = [
    [
      '2026-01-01',
      {
        clockMs: 6000,
        hue: 11,
        dot: [327, 875],
        cells: [2, 4, 9, 10, 15, 16, 20],
        reactionDelayMs: 2400,
      },
      { clock: 0, color: 0, dot: 0, pattern: 5, reaction: 76 },
    ],
    [
      '2026-07-04',
      {
        clockMs: 5800,
        hue: 55,
        dot: [123, 735],
        cells: [1, 3, 4, 10, 11, 17, 19],
        reactionDelayMs: 1700,
      },
      { clock: 1, color: 0, dot: 0, pattern: 14, reaction: 76 },
    ],
    [
      '2026-11-09',
      {
        clockMs: 3300,
        hue: 347,
        dot: [442, 760],
        cells: [6, 7, 8, 9, 11, 15, 17],
        reactionDelayMs: 3500,
      },
      { clock: 51, color: 0, dot: 0, pattern: 1, reaction: 76 },
    ],
  ] as const;
  for (const [date, puzzle, scores] of fixtures) {
    expect(perceptionPuzzle(date)).toEqual(puzzle);
    expect(
      scorePerception(date, {
        clockMs: 4000,
        hue: 180,
        dot: [500, 500],
        cells: [0, 1, 2, 3, 4, 5, 6],
        reactionMs: 300,
      }),
    ).toEqual(scores);
    expect(perceptionLineup(date)).toEqual(['clock', 'color', 'dot', 'pattern', 'reaction']);
  }
});

it('keeps cutover overlap with the last legacy day at most two types', () => {
  const legacy = perceptionLineup('2026-11-09');
  const cutover = perceptionLineup('2026-11-10');
  expect(cutover.filter((round) => legacy.includes(round)).length).toBeLessThanOrEqual(2);
});

it('provides deterministic, diverse lineups with bounded epoch work over two years', () => {
  const started = performance.now();
  const lineups = Array.from({ length: 731 }, (_, day) => perceptionLineup(dateAt(day)));
  console.log('Perception 731 lineups ms:', (performance.now() - started).toFixed(2));
  for (let day = 0; day < lineups.length; day++) {
    const rounds = lineups[day];
    expect(rounds).toEqual(perceptionLineup(dateAt(day)));
    expect(new Set(rounds).size).toBe(5);
    if (day)
      expect(rounds.filter((r) => lineups[day - 1].includes(r)).length).toBeLessThanOrEqual(2);
    if (day >= 4) expect(new Set(lineups.slice(day - 4, day + 1).flat()).size).toBe(12);
    const p = perceptionV2Puzzle(dateAt(day));
    expect(p).toEqual(perceptionV2Puzzle(dateAt(day)));
    expect(p.cells).toHaveLength(9);
    expect(p.countDots).toHaveLength(p.count);
    expect(p.count).toBeGreaterThanOrEqual(30);
    expect(p.count).toBeLessThanOrEqual(80);
    expect(
      p.countDots.every(
        (point, i) =>
          point.every((n) => n >= 35 && n <= 965) &&
          p.countDots
            .slice(i + 1)
            .every((other) => (point[0] - other[0]) ** 2 + (point[1] - other[1]) ** 2 >= 70 ** 2),
      ),
    ).toBe(true);
    expect(p.countDots.filter(([x]) => x % 100 >= 35 && x % 100 <= 65).length).toBeLessThan(
      p.count * 0.8,
    );
    expect(new Set(p.countDots.map((p) => p[0])).size).toBeGreaterThan(p.count * 0.8);
    expect(new Set(p.countDots.map((p) => p[1])).size).toBeGreaterThan(p.count * 0.8);
    expect(p.digits).toMatch(/^\d{8,9}$/);
    expect((p.contact.occlusion[0] - 100) / p.contact.visibleMs).toBeCloseTo(
      (900 - p.contact.occlusion[0]) / p.contact.hiddenMs,
    );
  }
  for (let period = 1; period < 30; period++)
    expect(
      lineups.slice(period).every((r, i) => [...r].sort().join() === [...lineups[i]].sort().join()),
    ).toBe(false);
  console.log(
    'Perception sample 7 days:',
    lineups
      .slice(0, 7)
      .map((r, i) => `${dateAt(i)} ${r.join(', ')}`)
      .join('\n'),
  );
  expect(() => perceptionV2Puzzle('bad')).toThrow('Invalid Perception puzzle date');
});

function withMiss(
  p: PerceptionV2Puzzle,
  round: PerceptionRoundId,
  units: number,
): PerceptionRoundAnswer {
  const a = perfect(p),
    t = PERCEPTION_TYPICAL[round] * units;
  switch (round) {
    case 'clock':
      a.clockMs = p.clockMs + t;
      break;
    case 'color':
      a.hue = (p.hue + t) % 360;
      break;
    case 'dot':
      a.dot = [p.dot[0] + t, p.dot[1]];
      break;
    case 'pattern': {
      const n = Math.min(9, Math.round(t));
      a.cells = [
        ...p.cells.slice(n),
        ...Array.from({ length: 25 }, (_, i) => i)
          .filter((i) => !p.cells.includes(i))
          .slice(0, n),
      ];
      break;
    }
    case 'reaction':
      a.reactionMs = 160 + t;
      break;
    case 'angle':
      a.angle = p.angle + t;
      break;
    case 'length':
      a.length = p.length * (1 + t / 100);
      break;
    case 'count':
      a.count = p.count * 2 ** (t / 100);
      break;
    case 'span':
      a.digits = p.digits.slice(Math.min(p.digits.length, Math.round(t)));
      break;
    case 'shade':
      a.shade = p.shade + t;
      break;
    case 'bisect': {
      const [u, v] = p.endpoints;
      a.bisect = [a.bisect![0] + (t * Math.hypot(v[0] - u[0], v[1] - u[1])) / 100, a.bisect![1]];
      break;
    }
    case 'contact':
      a.contactMs = p.contact.hiddenMs + t;
      break;
  }
  return a;
}

it('scores every type perfectly, monotonically and within bounds; typical miss is 61', () => {
  const p = perceptionV2Puzzle(dateAt(0));
  for (const round of PERCEPTION_POOL) {
    expect(scorePerceptionRound(round, p, perfect(p))).toBe(100);
    expect(scorePerceptionRound(round, p, withMiss(p, round, 1))).toBe(61);
    let previous = 100;
    for (const units of [0, 0.5, 1, 2, 3]) {
      const score = scorePerceptionRound(round, p, withMiss(p, round, units));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  }
  expect(scorePerceptionRound('reaction', p, { reactionMs: -1 })).toBe(0);
  expect(scorePerceptionRound('reaction', p, { reactionMs: 99 })).toBe(0);
  expect(digitDistance('1234', '1324')).toBe(2);
  expect(digitDistance('', '123')).toBe(3);
  const rounds = perceptionLineup(dateAt(0));
  const scores = Object.fromEntries(rounds.map((r) => [r, scorePerceptionRound(r, p, perfect(p))]));
  expect(perceptionTotal(scores, rounds)).toBe(500);
  expect(perceptionShare(dateAt(0), scores, rounds)).toContain('500/500');
  expect(
    perceptionShare('2026-01-01', {
      clock: 100,
      color: 100,
      dot: 100,
      pattern: 100,
      reaction: 100,
    }),
  ).toContain('500/500');
});

it('validates each single round field, rejecting empty, extra, malformed and out-of-range input', () => {
  const p = perceptionV2Puzzle(dateAt(0)),
    a = perfect(p);
  const invalid: Record<PerceptionRoundId, unknown[]> = {
    clock: [-1, 30001, 1.5],
    color: [-1, 360],
    dot: [[0], [-1, 500], [500, 1001]],
    pattern: [p.cells.slice(1), Array(9).fill(1)],
    reaction: [-2, 3001],
    angle: [-1, 181],
    length: [0, 1001],
    count: [0, 201, 1.5],
    span: ['', 'a123', '1234567890123', 123],
    shade: [-1, 101],
    bisect: [[1], [1001, 0]],
    contact: [-1, 6001],
  };
  for (const round of PERCEPTION_POOL) {
    const field = PERCEPTION_FIELDS[round],
      part = { [field]: a[field] };
    expect(parsePerceptionRound(round, part, true)).toEqual(part);
    for (const value of [
      null,
      {},
      [],
      { ...part, extra: 1 },
      { [field]: null },
      ...invalid[round].map((x) => ({ [field]: x })),
    ])
      expect(parsePerceptionRound(round, value, true)).toBeNull();
  }
  expect(parsePerceptionRound('pattern', { cells: p.cells.slice(0, 7) }, false)).not.toBeNull();
  expect(parsePerceptionRound('pattern', { cells: p.cells }, false)).toBeNull();
});

it('calibrates a fixed-seed good player and proves perfect 500s remain feasible', () => {
  const rand = dailyRandom('perception-good-player', 'simulation');
  const normal = () =>
    Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const totals: number[] = [];
  const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));
  for (let day = 0; day < 3000; day++) {
    const p = perceptionV2Puzzle(dateAt(day)),
      rounds = perceptionLineup(dateAt(day));
    const a = perfect(p);
    a.clockMs = clamp(p.clockMs + normal() * 250, 0, 30000);
    a.hue = ((Math.round(p.hue + normal() * 12) % 360) + 360) % 360;
    a.dot = [clamp(p.dot[0] + normal() * 40, 0, 1000), clamp(p.dot[1] + normal() * 40, 0, 1000)];
    a.cells = withMiss(p, 'pattern', Math.abs(normal())).cells;
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
    let total = 0;
    for (const r of rounds) {
      const field = PERCEPTION_FIELDS[r];
      expect(parsePerceptionRound(r, { [field]: a[field] }, true)).not.toBeNull();
      expect(scorePerceptionRound(r, p, perfect(p))).toBe(100);
      total += scorePerceptionRound(r, p, a);
    }
    totals.push(total);
  }
  totals.sort((a, b) => a - b);
  const median = totals[1500],
    p10 = totals[300],
    p90 = totals[2700],
    rare = totals.filter((x) => x >= 450).length / totals.length;
  console.log(
    `Perception good player n=${totals.length}: median=${median}, p10=${p10}, p90=${p90}, P>=450=${(rare * 100).toFixed(2)}%`,
  );
  expect(median).toBeGreaterThanOrEqual(250);
  expect(median).toBeLessThanOrEqual(350);
  expect(rare).toBeLessThan(0.03);
});
