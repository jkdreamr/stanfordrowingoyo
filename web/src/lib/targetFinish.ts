import type { WeekStats } from '../../../shared/types';
type Finish = { previous: number; target: number };
const pending = new Map<string, Finish>();
const key = (user: string, week: string) => `oyo-target-hit:${user}:${week}`;
export function recordTargetFinish(
  previous: WeekStats | null,
  next: WeekStats,
  user: string,
  entryWeek: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
) {
  if (
    !previous ||
    previous.week_start !== next.week_start ||
    entryWeek !== next.week_start ||
    previous.target_m !== next.target_m ||
    next.target_m <= 0 ||
    previous.total_m >= next.target_m ||
    next.total_m < next.target_m
  )
    return false;
  const id = key(user, next.week_start);
  try {
    const acknowledgement = storage ?? localStorage;
    if (acknowledgement.getItem(id)) return false;
    acknowledgement.setItem(id, '1');
  } catch {
    return false;
  }
  pending.set(id, { previous: previous.total_m, target: next.target_m });
  return true;
}
export function pendingTargetFinish(user: string, week: string) {
  return pending.get(key(user, week));
}
export function clearTargetFinish(user: string, week: string) {
  pending.delete(key(user, week));
}
