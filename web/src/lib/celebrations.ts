import { addDays } from '../../../shared/dates';
import type { EntryDetail, SeasonStats, User, WeekSummary } from '../../../shared/types';

export type Achievement = {
  kind: 'split-2k' | 'split-6k' | 'longest-streak' | 'best-week' | 'target-hit' | 'streak';
  title: string;
  value: number;
  week: string;
  entry?: string;
};
const priority: Achievement['kind'][] = [
  'split-2k',
  'split-6k',
  'longest-streak',
  'best-week',
  'target-hit',
  'streak',
];
const ordered = (items: Achievement[]) =>
  items.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind));

export function longestRun(weeks: WeekSummary[]) {
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const week of [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start))) {
    if (previous && week.week_start !== addDays(previous, 7)) run = 0;
    run = week.hit_target ? run + 1 : 0;
    longest = Math.max(longest, run);
    previous = week.week_start;
  }
  return longest;
}

export function detectBests(
  before: SeasonStats | null,
  after: SeasonStats | null,
  saved: EntryDetail,
  me: User,
): Achievement[] {
  if (
    !before ||
    !after ||
    before.start !== after.start ||
    before.end !== after.end ||
    saved.date < after.start ||
    saved.date > after.end ||
    saved.user_id !== me.id
  )
    return [];
  const results: Achievement[] = [];
  const week = saved.week_start;
  const split =
    saved.avg_split_s ??
    (saved.duration_s !== null ? (saved.duration_s * 500) / saved.distance_m : null);
  const benchmark = saved.distance_m === 2000 ? me.best2k_split_s : me.best6k_split_s;
  if (
    saved.modality === 'erg' &&
    [2000, 6000].includes(saved.distance_m) &&
    split !== null &&
    Number.isFinite(split) &&
    split > 0 &&
    benchmark !== null &&
    split < benchmark
  ) {
    const distance = saved.distance_m === 2000 ? '2k' : '6k';
    results.push({
      kind: `split-${distance}`,
      title: `New ${distance} Best`,
      value: split,
      week,
      entry: saved.id,
    });
  }
  if (after.streak > before.streak && after.streak >= 2) {
    const longest = after.streak > longestRun(before.weeks);
    results.push({
      kind: longest ? 'longest-streak' : 'streak',
      title: longest ? 'Longest Streak' : `${after.streak}-Week Streak`,
      value: after.streak,
      week,
    });
  }
  if (
    before.best_week &&
    after.best_week?.week_start === week &&
    after.best_week.total_m > before.best_week.total_m
  ) {
    results.push({
      kind: 'best-week',
      title: 'New Best Week',
      value: after.best_week.total_m,
      week,
    });
  }
  return ordered(results);
}

const pending = new Map<string, Achievement>();
const key = (user: string, item: Achievement) => {
  const milestone = item.kind.startsWith('split-') ? item.entry : item.week;
  const kind = item.kind === 'longest-streak' ? 'streak' : item.kind;
  return `oyo-celebration:${user}:${kind}:${milestone}`;
};
export function recordCelebration(
  user: string,
  achievements: Achievement[],
  target?: Achievement,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
) {
  pending.delete(user);
  try {
    const acknowledgement = storage ?? localStorage;
    const candidates = ordered([...achievements, ...(target ? [target] : [])]);
    const selected = candidates.find((item) => !acknowledgement.getItem(key(user, item)));
    for (const item of candidates) acknowledgement.setItem(key(user, item), '1');
    if (selected && selected.kind !== 'target-hit') pending.set(user, selected);
    return selected;
  } catch {
    return undefined;
  }
}
export const pendingCelebration = (user: string) => pending.get(user);
export const clearCelebration = (user: string) => {
  pending.delete(user);
};
