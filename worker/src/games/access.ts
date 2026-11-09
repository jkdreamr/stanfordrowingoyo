import type { GameAccess } from '../../../shared/types';
import { DIVE_PROMPTS_PER_DAY } from '../../../shared/games/dive';
import { addDays, weekStart } from '../../../shared/dates';
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
    else {
      const start = weekStart(date);
      const day = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
      const rows = storage.sql
        .exec<{ day: number; kind: string }>(
          'SELECT day,kind FROM team_plan_slots WHERE week_start=?',
          start,
        )
        .toArray();
      if (rows.length && !rows.some((row) => row.day === day && row.kind === 'oyo'))
        reason = 'no_oyo';
    }
  }
  return { date, unlocked: reason !== 'locked', reason };
}
export function requireGameAccess(ctx: Context, user: UserRow, date: string) {
  const access = oyoGameAccess(ctx.storage, user, date);
  if (!access.unlocked) throw new HttpError(403, 'GAME_LOCKED', 'Log a workout today to play.');
  return access;
}

export function requireGameFinished(ctx: Context, user: UserRow, game: string, date: string) {
  if (user.role === 'admin') return;
  const complete =
    game === 'dive'
      ? ctx.storage.sql
          .exec<{ answered: number }>(
            'SELECT COUNT(*) AS answered FROM dive_answers WHERE user_id=? AND date=?',
            user.id,
            date,
          )
          .toArray()[0].answered === DIVE_PROMPTS_PER_DAY
      : ctx.storage.sql
          .exec(
            'SELECT 1 FROM game_results WHERE user_id=? AND game_id=? AND date=?',
            user.id,
            game,
            date,
          )
          .toArray().length > 0;
  if (!complete) throw new HttpError(403, 'PLAY_FIRST', 'Finish this day’s game first.');
}
