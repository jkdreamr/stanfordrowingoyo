import type { Context } from '../context';

export function progress<T>(ctx: Context, user: string, game: string, date: string, initial: T): T {
  const row = ctx.storage.sql
    .exec<{ state_json: string }>(
      'SELECT state_json FROM game_progress WHERE user_id=? AND game=? AND date=?',
      user,
      game,
      date,
    )
    .toArray()[0];
  return row ? JSON.parse(row.state_json) : initial;
}
export function saveProgress(
  ctx: Context,
  user: string,
  game: string,
  date: string,
  state: unknown,
) {
  ctx.storage.sql.exec(
    'INSERT INTO game_progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,game,date) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at',
    user,
    game,
    date,
    JSON.stringify(state),
    ctx.now.toISOString(),
  );
}
export function storedResult(ctx: Context, user: string, game: string, date: string) {
  const row = ctx.storage.sql
    .exec<{ payload_json: string }>(
      'SELECT payload_json FROM game_results WHERE user_id=? AND game_id=? AND date=?',
      user,
      game,
      date,
    )
    .toArray()[0];
  return row ? JSON.parse(row.payload_json) : null;
}
export function finish(
  ctx: Context,
  user: string,
  game: string,
  date: string,
  score: number,
  payload: unknown,
) {
  const stamp = ctx.now.toISOString();
  ctx.storage.sql.exec(
    'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
    game,
    date,
    user,
    score,
    JSON.stringify(payload),
    stamp,
    stamp,
  );
}
