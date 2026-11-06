import type { CurrentWeeklyTarget, User, WeeklyTarget } from '../../../shared/types';
import type { TargetVersion } from './settings';
import type { Row } from './row';
import { GROUP_TARGETS } from '../../../shared/seed';
type TargetUser = Pick<User, 'id' | 'group_key'>;
export function loadTargets(storage: DurableObjectStorage, userId?: string) {
  const history = storage.sql
    .exec<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      'group_target_history',
    )
    .toArray()[0];
  const versions = (JSON.parse(history?.value_json ?? '[]') as TargetVersion[]).sort((a, b) =>
    b.week_start.localeCompare(a.week_start),
  );
  const rows =
    userId === undefined
      ? storage.sql
          .exec<Row<WeeklyTarget>>('SELECT * FROM weekly_targets ORDER BY week_start DESC')
          .toArray()
      : storage.sql
          .exec<Row<WeeklyTarget>>(
            'SELECT * FROM weekly_targets WHERE user_id = ? ORDER BY week_start DESC',
            userId,
          )
          .toArray();
  const personal = new Map<string, WeeklyTarget[]>();
  for (const row of rows) {
    const history = personal.get(row.user_id) ?? [];
    history.push(row);
    personal.set(row.user_id, history);
  }
  return (user: TargetUser, week: string): CurrentWeeklyTarget => {
    const target = personal.get(user.id)?.find((row) => row.week_start <= week);
    if (target) return { week_start: week, target_m: target.target_m, source: 'personal' };
    const group = versions.find((row) => row.week_start <= week) ?? versions.at(-1);
    return {
      week_start: week,
      target_m: group?.targets[user.group_key] ?? GROUP_TARGETS[user.group_key],
      source: 'group',
    };
  };
}
export function effectiveTarget(
  storage: DurableObjectStorage,
  user: Pick<User, 'id' | 'group_key'>,
  week: string,
): CurrentWeeklyTarget {
  return loadTargets(storage, user.id)(user, week);
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
