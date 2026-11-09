import { today } from '../../../shared/dates';
import { ARCADE_RUNS_PER_DAY } from '../../../shared/games/arcade';
import type { ArcadeDay, ArcadeRun } from '../../../shared/types';
import { refreshUser } from '../auth/guards';
import type { Context } from '../context';
import { progress, saveProgress } from '../db/gameProgress';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { ARCADE_GAMES, arcadeSeed } from '../games/arcade';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

interface State {
  runs: (Omit<ArcadeRun, 'attempt'> & { id: string })[];
}
function game(ctx: Context) {
  const selected = Object.hasOwn(ARCADE_GAMES, ctx.params.game)
    ? ARCADE_GAMES[ctx.params.game]
    : undefined;
  if (!selected) throw new HttpError(404, 'NOT_FOUND', 'Game not found.');
  return selected;
}
function load(ctx: Context, user: string, id: string, date: string) {
  return progress<State>(ctx, user, id, date, { runs: [] });
}
function view(ctx: Context, state: State): ArcadeDay {
  const user = refreshUser(ctx),
    id = game(ctx).id,
    date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const best =
    ctx.storage.sql
      .exec<{ score: number }>(
        'SELECT score FROM game_results WHERE user_id=? AND game_id=? AND date=?',
        user.id,
        id,
        date,
      )
      .toArray()[0]?.score ?? null;
  return {
    game_id: id,
    date,
    access,
    seed: access.unlocked ? arcadeSeed(id, date) : null,
    runs_per_day: ARCADE_RUNS_PER_DAY,
    runs: state.runs.map(({ id: _id, ...run }, i) => ({ ...run, attempt: i + 1 })),
    attempts_left: Math.max(0, ARCADE_RUNS_PER_DAY - state.runs.length),
    best,
  };
}
export function current(ctx: Context) {
  return json(
    ctx.storage.transactionSync(() => {
      const id = game(ctx).id,
        user = refreshUser(ctx);
      return view(ctx, load(ctx, user.id, id, today(ctx.now)));
    }),
  );
}
function gameDate(ctx: Context, expected: unknown) {
  const date = today(ctx.now);
  if (v.date(expected) !== date)
    throw new HttpError(409, 'DAY_CHANGED', 'A New Day Has Started. Reload to Play.');
  return date;
}
export async function start(ctx: Context) {
  game(ctx);
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const selected = game(ctx),
        user = refreshUser(ctx),
        date = gameDate(ctx, body.date);
      requireGameAccess(ctx, user, date);
      const state = load(ctx, user.id, selected.id, date);
      if (state.runs.length >= ARCADE_RUNS_PER_DAY)
        throw new HttpError(409, 'NO_RUNS_LEFT', 'No runs left today.');
      const stamp = ctx.now.toISOString();
      const active = state.runs.find((run) => run.status === 'active');
      if (active) {
        active.status = 'abandoned';
        active.finished_at = stamp;
        active.score = null;
      }
      const run = crypto.randomUUID();
      state.runs.push({
        id: run,
        started_at: stamp,
        finished_at: null,
        status: 'active',
        score: null,
        stats: null,
      });
      saveProgress(ctx, user.id, selected.id, date, state);
      updatePayload(ctx, user.id, selected.id, date, state);
      return {
        ...view(ctx, state),
        run,
        attempt: state.runs.length,
        seed: arcadeSeed(selected.id, date),
      };
    }),
  );
}
function updatePayload(ctx: Context, user: string, id: string, date: string, state: State) {
  const finished = state.runs.filter((r) => r.status === 'finished');
  if (!finished.length) return;
  const best = finished.reduce((a, b) => (b.score! > a.score! ? b : a));
  const payload = {
    best_attempt: state.runs.indexOf(best) + 1,
    runs: state.runs.map((r, i) => ({ attempt: i + 1, score: r.score, status: r.status })),
  };
  const stamp = ctx.now.toISOString();
  ctx.storage.sql.exec(
    'INSERT INTO game_results VALUES (?,?,?,?,?,?,?) ON CONFLICT(game_id,date,user_id) DO UPDATE SET score=MAX(game_results.score,excluded.score),payload_json=excluded.payload_json,updated_at=excluded.updated_at',
    id,
    date,
    user,
    best.score,
    JSON.stringify(payload),
    stamp,
    stamp,
  );
}
export async function finish(ctx: Context) {
  game(ctx);
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const selected = game(ctx),
        user = refreshUser(ctx),
        date = gameDate(ctx, body.date);
      requireGameAccess(ctx, user, date);
      const state = load(ctx, user.id, selected.id, date);
      const run = state.runs.find((r) => r.id === body.run);
      if (!run) throw new HttpError(409, 'RUN_UNKNOWN', 'Run not found.');
      if (run.status !== 'active')
        throw new HttpError(409, 'RUN_FINISHED', 'Run already finished.');
      const elapsed = ctx.now.getTime() - new Date(run.started_at).getTime();
      const score = body.score;
      const stats =
        typeof score === 'number' &&
        Number.isSafeInteger(score) &&
        score >= 0 &&
        score <= selected.max &&
        elapsed >= 0
          ? selected.validate(score, body.stats, elapsed)
          : null;
      if (stats === null) v.invalid('Run is not plausible.');
      run.status = 'finished';
      run.score = score as number;
      run.stats = stats;
      run.finished_at = ctx.now.toISOString();
      saveProgress(ctx, user.id, selected.id, date, state);
      updatePayload(ctx, user.id, selected.id, date, state);
      return view(ctx, state);
    }),
  );
}
