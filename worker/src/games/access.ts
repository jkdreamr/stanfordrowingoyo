import type { GameAccess } from '../../../shared/types';
import { addDays } from '../../../shared/dates';
import type { UserRow } from '../db/users';
import type { Context } from '../context';
import { HttpError } from '../http';

/** THE OYO game access rule. Change it here only. */
export function oyoGameAccess(
  storage: DurableObjectStorage,
  user: UserRow,
  date: string,
): GameAccess {
  let reason: GameAccess['reason'] = 'locked';
  if (user.role !== 'rower') reason = 'staff';
  else if (
    storage.sql
      .exec('SELECT 1 FROM entries WHERE user_id=? AND date=? LIMIT 1', user.id, date)
      .toArray().length
  )
    reason = 'workout';
  else {
    const plan = storage.sql
      .exec<{ start_date: string; rest_days_json: string }>(
        'SELECT start_date,rest_days_json FROM my_plans WHERE user_id=? AND start_date BETWEEN ? AND ? ORDER BY start_date DESC LIMIT 1',
        user.id,
        addDays(date, -13),
        date,
      )
      .toArray()[0];
    if (
      plan &&
      (JSON.parse(plan.rest_days_json) as { week: number; day: number }[]).some(
        ({ week, day }) => addDays(plan.start_date, (week - 1) * 7 + day) === date,
      )
    )
      reason = 'rest_day';
  }
  return { date, unlocked: reason !== 'locked', reason };
}
export function requireGameAccess(ctx: Context, user: UserRow, date: string) {
  const access = oyoGameAccess(ctx.storage, user, date);
  if (!access.unlocked) throw new HttpError(403, 'GAME_LOCKED', 'Log a workout today to play.');
  return access;
}
