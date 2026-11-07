import { addDays, today, weekStart } from '../../../shared/dates';
import type { SeasonStats } from '../../../shared/types';

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
export function chartPath(points: ChartPoint[], domain: [number, number], pace = false) {
  const [min, max] = domain;
  if (!points.length) return '';
  const path = points
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${((i * 1000) / Math.max(1, points.length - 1)).toFixed(2)},${(188 - (((pace ? (p.pace ?? 0) : p.total) - min) / (max - min)) * 156).toFixed(2)}`,
    )
    .join(' ');
  return points.length === 1
    ? `${path} L1000,${(188 - (((pace ? (points[0].pace ?? 0) : points[0].total) - min) / (max - min)) * 156).toFixed(2)}`
    : path;
}
