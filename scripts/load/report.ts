import { aggregate } from './stats.ts';
import type { Sample } from './stats.ts';

export function report(
  samples: Sample[],
  wallSeconds: number,
  timings: Record<string, number>,
  threshold: number,
) {
  const endpoints = aggregate(samples);
  const signup = samples.filter((s) => s.endpoint === 'POST /api/auth/signup');
  const gated = samples.filter((s) => s.endpoint !== 'POST /api/auth/signup');
  const signupEndpoints = aggregate(signup);
  const gatedEndpoints = aggregate(gated);
  const failures: string[] = [];
  for (const row of gatedEndpoints)
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
  console.log(`Total: ${samples.length} requests, ${wallSeconds.toFixed(2)} s`);
  print('Signup (latency reported, ungated)', signup, timings.signup ?? wallSeconds);
  print(`Gated (p95 <= ${threshold} ms)`, gated, wallSeconds);
  for (const scenario of new Set(samples.map((s) => s.scenario)))
    if (scenario !== 'signup')
      print(
        scenario,
        gated.filter((s) => s.scenario === scenario),
        timings[scenario] ?? wallSeconds,
      );
  for (const failure of failures) console.error(`FAILED: ${failure}`);
  return {
    samples,
    endpoints,
    signupEndpoints,
    gatedEndpoints,
    wallSeconds,
    throughput: samples.length / (wallSeconds || 1),
    timings,
    failures,
  };
}
