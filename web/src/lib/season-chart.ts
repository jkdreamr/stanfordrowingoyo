import { addDays, today, weekStart } from '../../../shared/dates';
import type { SeasonStats } from '../../../shared/types';
import { formatCompactMeters } from './format';

export const CHART_RANGES = ['1W', '1M', '3M', 'Season', 'All'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
export interface ChartPoint {
  date: string;
  total: number;
  pace: number | null;
  day: number;
}
export function cumulativeSeries(
  stats: SeasonStats[],
  end: string,
  coxswain = false,
  createdAt?: string,
): ChartPoint[] {
  const ordered = [...stats].sort((a, b) => a.start.localeCompare(b.start));
  if (!ordered.length || ordered[0].start > end) return [];
  const days = new Map(ordered.flatMap((s) => s.days.map((d) => [d.date, d.equiv_m] as const)));
  const targets = new Map(
    ordered.map((s) => [s.start, new Map(s.weeks.map((w) => [w.week_start, w.target_m]))]),
  );
  const hasPace = !coxswain && ordered.some((s) => s.weeks.some((w) => w.target_m > 0));
  const created = createdAt ? new Date(createdAt) : null;
  const joined = created && Number.isFinite(created.getTime()) ? today(created) : undefined;
  const paceStarts = new Map(
    ordered.map((s) => {
      const firstEntry = s.days.reduce<string | undefined>(
        (first, day) => (!first || day.date < first ? day.date : first),
        undefined,
      );
      const participation = joined ?? firstEntry ?? s.start;
      return [s.start, participation > s.start ? participation : s.start];
    }),
  );
  let total = 0;
  let pace = 0;
  const result: ChartPoint[] = [];
  for (let date = ordered[0].start; date <= end; date = addDays(date, 1)) {
    const day = days.get(date) ?? 0;
    total += day;
    const season = ordered.find((s) => date >= s.start && date <= s.end);
    if (season && date >= paceStarts.get(season.start)!) {
      pace += (targets.get(season.start)?.get(weekStart(date)) ?? 0) / 7;
    }
    result.push({ date, total, pace: hasPace ? pace : null, day });
  }
  return result;
}
export function rangeStart(range: ChartRange, seasonStart: string, today: string, monday: string) {
  const start =
    range === '1W'
      ? monday
      : range === '1M'
        ? addDays(monday, -28)
        : range === '3M'
          ? addDays(monday, -84)
          : seasonStart;
  return start < seasonStart ? seasonStart : start > today ? today : start;
}
export function sampleWeekly(points: ChartPoint[]) {
  if (points.length <= 400) return points;
  return points.filter((_, i) => i % 7 === 0 || i === points.length - 1);
}
export function selectRange(points: ChartPoint[], range: ChartRange, start: string) {
  const selected = points.filter((p) => p.date >= start);
  return range === 'All' ? sampleWeekly(selected) : selected;
}
export function yDomain(points: ChartPoint[], range: ChartRange): [number, number] {
  const values = points.flatMap((p) => (p.pace === null ? [p.total] : [p.total, p.pace]));
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(max - min, max * 0.01, 1) * 0.08;
  return [range === 'All' || range === 'Season' ? 0 : Math.max(0, min - pad), max + pad];
}
export const paceGap = (point: ChartPoint) =>
  point.pace === null ? null : Math.round(point.total - point.pace);
/** Plot geometry lives in a 1000 × 200 viewBox: values map from FLOOR (domain min) up to TOP. */
export const FLOOR = 188;
const RISE = 156;
/** Every range is resampled to this many evenly spaced points so any two shapes can morph. */
export const MORPH_SAMPLES = 160;
export interface Curve {
  xs: number[];
  ys: number[];
  /** Hermite tangents (dy/dx) at each knot. */
  m: number[];
}
export function plotCurve(points: ChartPoint[], domain: [number, number], pace = false): Curve {
  const [min, max] = domain;
  const value = (p: ChartPoint) => (pace ? (p.pace ?? 0) : p.total);
  const ys = points.map((p) => FLOOR - ((value(p) - min) / (max - min)) * RISE);
  const xs = points.map((_, i) => (i * 1000) / Math.max(1, points.length - 1));
  if (points.length === 1) {
    xs.push(1000);
    ys.push(ys[0]);
  }
  return { xs, ys, m: monotoneTangents(xs, ys) };
}
/**
 * Steffen's monotone tangents: every tangent is at most twice the smaller adjacent secant
 * and zero at any local extremum or flat run, so the cubic never overshoots the data. A
 * cumulative (non-decreasing) series therefore draws as a line that never dips.
 */
export function monotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n < 2) return ys.map(() => 0);
  const secant = (i: number) => (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1);
  const m = new Array<number>(n);
  m[0] = secant(0);
  m[n - 1] = secant(n - 2);
  for (let i = 1; i < n - 1; i++) {
    const s0 = secant(i - 1);
    const s1 = secant(i);
    const h0 = xs[i] - xs[i - 1];
    const h1 = xs[i + 1] - xs[i];
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    m[i] =
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  }
  return m;
}
const f = (n: number) => (Math.round(n * 100) / 100).toString();
/** A smooth SVG path through the knots: one cubic Bézier per interval (Hermite form). */
export function curvePath({ xs, ys, m }: Curve): string {
  if (!xs.length) return '';
  let d = `M${f(xs[0])},${f(ys[0])}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    d += `C${f(xs[i] + h)},${f(ys[i] + m[i] * h)} ${f(xs[i + 1] - h)},${f(ys[i + 1] - m[i + 1] * h)} ${f(xs[i + 1])},${f(ys[i + 1])}`;
  }
  return d;
}
/** The shaded region under a line path, closed along the baseline. */
export const areaPath = (line: string) => (line ? `${line}L1000,${FLOOR}L0,${FLOOR}Z` : '');
/** The curve's height at viewBox x, so the scrub dot sits exactly on the drawn line. */
export function curveAt({ xs, ys, m }: Curve, x: number): number {
  const n = xs.length;
  if (!n) return FLOOR;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const h = xs[hi] - xs[lo];
  const t = (x - xs[lo]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[lo] +
    (t3 - 2 * t2 + t) * h * m[lo] +
    (-2 * t3 + 3 * t2) * ys[hi] +
    (t3 - t2) * h * m[hi]
  );
}
/** Heights at `count` evenly spaced x positions across the plot, read off the smooth curve. */
export function resample(curve: Curve, count = MORPH_SAMPLES): number[] {
  return Array.from({ length: count }, (_, i) => curveAt(curve, (i * 1000) / (count - 1)));
}
/** A morph frame: blends two resampled shapes and smooths the result. Monotone in, monotone out. */
export function morphCurve(from: number[], to: number[], t: number): Curve {
  const ys = to.map((y, i) => from[i] + (y - from[i]) * t);
  const xs = ys.map((_, i) => (i * 1000) / (ys.length - 1));
  return { xs, ys, m: monotoneTangents(xs, ys) };
}
export function chartPath(points: ChartPoint[], domain: [number, number], pace = false) {
  return curvePath(plotCurve(points, domain, pace));
}
/** Compact delta for the line under the figure: 300 m, 12.4k, 1.84M. */
export function formatDelta(meters: number) {
  const n = Math.max(0, meters);
  return n < 1000 ? `${Math.round(n).toLocaleString('en-US')} m` : formatCompactMeters(n);
}
export function paceLabel(gap: number | null) {
  if (gap === null) return '';
  if (gap === 0) return 'On pace';
  return gap < 0 ? `Behind pace by ${formatDelta(-gap)}` : `Ahead of pace by ${formatDelta(gap)}`;
}
/** `--ease-out` (cubic-bezier(0.16, 1, 0.3, 1)) for rAF-driven motion that must match CSS. */
export function easeOut(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const [x1, y1, x2, y2] = [0.16, 1, 0.3, 1];
  const bezier = (u: number, a: number, b: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, y1, y2);
}
