import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dealRound } from '../../worker/src/games/deal/generate.ts';
import { DEAL_SCHEDULE, DEAL_SCHEDULE_START } from '../../worker/src/games/deal/schedule.ts';
import { dealSolver } from './solver.ts';

for (let n = 4; n <= 8; n++) {
  const hand = [4, 7, 8, 8, 11, 12, 13, 9].slice(0, n),
    start = performance.now();
  const solver = dealSolver(hand);
  console.log(
    `${n} cards: ${(performance.now() - start).toFixed(3)} ms; count(24)=${solver.count(24)}`,
  );
}
const bytes = Buffer.from(DEAL_SCHEDULE, 'base64');
const source = readFileSync(new URL('../../worker/src/games/deal/schedule.ts', import.meta.url));
console.log(
  `Schedule: ${bytes.length / 5} days, ${bytes.length} rounds, ${source.length} bytes source, ${gzipSync(source).length} bytes gzip`,
);
// Per-deal CPU averages across 30 calls include allocation/GC overhead without
// confusing a process scheduling delay with a rules-engine cost.
for (let i = 0; i < 2000; i++) dealRound(DEAL_SCHEDULE_START, i % 5);
let worst = 0,
  worstKey = '',
  total = 0;
for (let day = 0; day < bytes.length / 5; day++)
  for (let round = 0; round < 5; round++) {
    const date = new Date(Date.parse(DEAL_SCHEDULE_START) + day * 86400000)
      .toISOString()
      .slice(0, 10);
    const start = process.cpuUsage();
    for (let repeat = 0; repeat < 30; repeat++) dealRound(date, round);
    const cpu = process.cpuUsage(start),
      ms = (cpu.user + cpu.system) / 30000;
    total += ms;
    if (ms > worst) {
      worst = ms;
      worstKey = `${date} R${round + 1}`;
    }
  }
console.log(
  `dealRound CPU: worst ${worst.toFixed(4)} ms (${worstKey}), mean ${(total / bytes.length).toFixed(4)} ms; 30 calls per scheduled deal`,
);
for (const date of ['2026-11-09', '2026-11-16', '2027-03-28', '2028-02-29', '2028-11-15']) {
  console.log(date);
  for (let r = 0; r < 5; r++) {
    const p = dealRound(date, r),
      live = new Map(p.cards.map((c, i) => [i, c.value]));
    const steps = p.solution.map((s, i) => {
      const a = live.get(s.a)!,
        b = live.get(s.b)!;
      const value = s.op === '+' ? a + b : s.op === '-' ? a - b : s.op === '*' ? a * b : a / b;
      live.set(p.cards.length + i, value);
      return `${a} ${{ '+': '+', '-': '−', '*': '×', '/': '÷' }[s.op]} ${b} = ${value}`;
    });
    console.log(
      `R${r + 1} [${p.cards.map((c) => `${c.value}${c.suit}`).join(', ')}] → ${p.goal}, par ${p.parMs / 1000}s: ${steps.join('; ')}`,
    );
  }
}
