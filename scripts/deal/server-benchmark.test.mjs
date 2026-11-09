import { expect, it } from 'vitest';
import process from 'node:process';
import console from 'node:console';
import { answer } from '../../worker/src/routes/deal';
import { serverFixture } from './server-fixture.mjs';

it('benchmarks the complete fifth-answer handler with forty full progress rows', async () => {
  const { db, ctx, resetAnswer } = serverFixture(),
    samples = [];
  try {
    for (let i = 0; i < 110; i++) {
      resetAnswer();
      const start = process.cpuUsage();
      const response = await answer(ctx);
      const cpu = process.cpuUsage(start);
      if (i >= 10) samples.push((cpu.user + cpu.system) / 1000);
      expect(response.status).toBe(200);
      const day = await response.json();
      expect(day.done).toBe(true);
      expect(day.results).toHaveLength(5);
      expect(day.results[4].teamBest?.timeMs).toBe(10000);
    }
    samples.sort((a, b) => a - b);
    console.log(
      `Deal fifth-answer handler CPU (Node + real in-memory SQLite, 40 full rows, 100 warmed calls): median ${samples[50].toFixed(3)} ms, p95 ${samples[95].toFixed(3)} ms, max ${samples[99].toFixed(3)} ms`,
    );
  } finally {
    db.close();
  }
});
