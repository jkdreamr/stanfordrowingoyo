import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dealCandidate, DealConstructionError } from '../../worker/src/games/deal/generate.ts';
import { dealSolver } from './solver.ts';

// Counts include labeled leaves. Upper thresholds for tiers 3, 2, 1;
// more solutions than the final threshold is tier 0.
export const DEAL_TIER_THRESHOLDS = [
  [4, 12, 40],
  [20, 80, 250],
  [100, 500, 2000],
  [500, 3000, 12000],
  [3000, 18000, 80000],
] as const;
export function dealTier(n: number, count: number) {
  const t = DEAL_TIER_THRESHOLDS[n - 4];
  return count <= t[0] ? 3 : count <= t[1] ? 2 : count <= t[2] ? 1 : 0;
}
export interface DealReport {
  date: string;
  round: number;
  cards: ReturnType<typeof dealCandidate>['cards'];
  goal: number;
  count: number;
  tier: number;
  needsDivision: boolean;
  k: number;
}
export function selectDeal(
  date: string,
  round: number,
  recent: Map<string, number>,
  day: number,
): DealReport {
  const hand = dealCandidate(date, round, 0).cards.map((c) => c.value);
  const solver = dealSolver(hand),
    noDivision = dealSolver(hand, false);
  const sum = hand.reduce((a, b) => a + b, 0),
    product = hand.reduce((a, b) => a * b, 1);
  const sorted = [...hand].sort((a, b) => a - b).join(',');
  const candidates: DealReport[] = [];
  for (let k = 0; k < 64; k++) {
    let candidate;
    try {
      candidate = dealCandidate(date, round, k);
    } catch (error) {
      if (error instanceof DealConstructionError) continue;
      throw error;
    }
    const { cards, goal } = candidate;
    if (
      goal === sum ||
      goal === product ||
      (recent.get(`${sorted}:${goal}`) ?? -Infinity) >= day - 365
    )
      continue;
    const count = solver.count(goal);
    if (count < 2) continue;
    candidates.push({
      date,
      round,
      cards,
      goal,
      count,
      tier: dealTier(hand.length, count),
      needsDivision: noDivision.count(goal) === 0,
      k,
    });
  }
  candidates.sort(
    (a, b) => a.count - b.count || Number(b.needsDivision) - Number(a.needsDivision) || a.k - b.k,
  );
  if (!candidates.length) throw new Error(`No valid Deal candidate: ${date} ${round}`);
  const chosen = candidates[round === 0 ? Math.floor((candidates.length - 1) * 0.4) : 0];
  recent.set(`${sorted}:${chosen.goal}`, day);
  return chosen;
}
export function generateSchedule(start = '2026-11-09', end = '2028-11-15') {
  const recent = new Map<string, number>(),
    report: DealReport[] = [],
    bytes: number[] = [];
  for (let time = Date.parse(start), day = 0; time <= Date.parse(end); time += 86400000, day++) {
    const date = new Date(time).toISOString().slice(0, 10);
    for (let round = 0; round < 5; round++) {
      const row = selectDeal(date, round, recent, day);
      report.push(row);
      bytes.push(row.k | (row.tier << 6));
    }
    if (day % 100 === 0) console.log(`Generated ${date}`);
  }
  return { encoded: Buffer.from(bytes).toString('base64'), report };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const start = performance.now(),
    { encoded, report } = generateSchedule();
  writeFileSync(
    new URL('../../worker/src/games/deal/schedule.ts', import.meta.url),
    `export const DEAL_SCHEDULE_START = '2026-11-09';\nexport const DEAL_SCHEDULE =\n  '${encoded}';\n`,
  );
  console.log(`Generator runtime: ${((performance.now() - start) / 1000).toFixed(2)}s`);
  console.log('Report omitted: large per-round dataset; summary follows.');
  for (let round = 0; round < 5; round++) {
    const rows = report.filter((r) => r.round === round),
      counts = rows.map((r) => r.count).sort((a, b) => a - b);
    console.log(
      `R${round + 1}: median ${counts[Math.floor(counts.length / 2)]}, division ${((100 * rows.filter((r) => r.needsDivision).length) / rows.length).toFixed(1)}%, tiers ${[0, 1, 2, 3].map((t) => rows.filter((r) => r.tier === t).length).join('/')}`,
    );
  }
}
