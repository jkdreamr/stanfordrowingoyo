import { aggregate } from './stats.ts';
import type { Sample } from './stats.ts';

export function report(
  samples: Sample[],
  wallSeconds: number,
  timings: Record<string, number>,
  threshold: number,
) {
  const endpoints = aggregate(samples);
  const failures: string[] = [];
  for (const row of endpoints)
    if (row.p95 > threshold)
      failures.push(`${row.endpoint} p95 ${row.p95.toFixed(1)} ms > ${threshold} ms`);
  if (samples.some((s) => s.status >= 500)) failures.push('5xx responses occurred');
  if (samples.some((s) => s.status === 0)) failures.push('Network errors occurred');
  function print(label: string, subset: Sample[], seconds: number) {
    console.log(
      `\n${label}: ${subset.length} requests, ${seconds.toFixed(2)} s, ${(subset.length / (seconds || 1)).toFixed(2)} req/s`,
    );
    console.table(
      aggregate(subset).map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === 'number' ? Math.round(v * 100) / 100 : v,
          ]),
        ),
      ),
    );
    const errors: Record<string, number> = {};
    for (const s of subset)
      if (s.status === 0 || s.status >= 400)
        errors[s.status || 'network'] = (errors[s.status || 'network'] ?? 0) + 1;
    console.log('Errors by status:', JSON.stringify(errors));
  }
  print('Total', samples, wallSeconds);
  for (const scenario of new Set(samples.map((s) => s.scenario)))
    print(
      scenario,
      samples.filter((s) => s.scenario === scenario),
      timings[scenario] ?? wallSeconds,
    );
  for (const failure of failures) console.error(`FAILED: ${failure}`);
  return {
    samples,
    endpoints,
    wallSeconds,
    throughput: samples.length / (wallSeconds || 1),
    timings,
    failures,
  };
}
