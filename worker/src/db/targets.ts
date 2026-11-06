import type { CurrentWeeklyTarget, User, WeeklyTarget } from '../../../shared/types';
import { getSetting, type TargetVersion } from './settings';
import type { Row } from './row';
export function effectiveTarget(
  storage: DurableObjectStorage,
  user: Pick<User, 'id' | 'group_key'>,
  week: string,
): CurrentWeeklyTarget {
  const personal = storage.sql
    .exec<Row<WeeklyTarget>>(
      'SELECT * FROM weekly_targets WHERE user_id = ? AND week_start <= ? ORDER BY week_start DESC LIMIT 1',
      user.id,
      week,
    )
    .toArray()[0];
  if (personal) return { week_start: week, target_m: personal.target_m, source: 'personal' };
  const versions = getSetting<TargetVersion[]>(storage, 'group_target_history')
    .filter((row) => row.week_start <= week)
    .sort((a, b) => b.week_start.localeCompare(a.week_start));
  return { week_start: week, target_m: versions[0].targets[user.group_key], source: 'group' };
}
export function setTarget(
  storage: DurableObjectStorage,
  userId: string,
  week: string,
  target: number,
): WeeklyTarget {
  storage.transactionSync(() => {
    storage.sql.exec(
      'INSERT INTO weekly_targets VALUES (?, ?, ?) ON CONFLICT(user_id,week_start) DO UPDATE SET target_m=excluded.target_m',
      userId,
      week,
      target,
    );
    storage.sql.exec(
      'DELETE FROM weekly_targets WHERE user_id = ? AND week_start > ?',
      userId,
      week,
    );
  });
  return { user_id: userId, week_start: week, target_m: target };
}
