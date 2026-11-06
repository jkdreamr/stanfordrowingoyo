export interface Sample {
  scenario: string;
  endpoint: string;
  ms: number;
  status: number;
  expected?: boolean;
}
export function routeTemplate(method: string, path: string): string {
  const url = new URL(path, 'http://localhost');
  const route = url.pathname.replace(
    /^(\/api\/(?:entries|images|comments|users|admin\/(?:users|roster)))\/[^/]+/,
    '$1/:id',
  );
  const metric = url.pathname === '/api/leaderboard' ? url.searchParams.get('metric') : null;
  return `${method} ${route}${metric ? `?metric=${metric}` : ''}`;
}
export function percentile(sorted: number[], p: number): number {
  return sorted.length ? sorted[Math.max(0, Math.ceil((sorted.length * p) / 100) - 1)] : 0;
}
export function aggregate(samples: Sample[]) {
  const groups = new Map<string, Sample[]>();
  for (const sample of samples)
    groups.set(sample.endpoint, [...(groups.get(sample.endpoint) ?? []), sample]);
  return [...groups].map(([endpoint, items]) => {
    const times = items.map((s) => s.ms).sort((a, b) => a - b);
    return {
      endpoint,
      count: items.length,
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      p99: percentile(times, 99),
      max: times.at(-1) ?? 0,
      errors: items.filter((s) => s.status === 0 || s.status >= 400).length,
    };
  });
}
