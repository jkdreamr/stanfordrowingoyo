import { today } from '../../../shared/dates';
import {
  DEAL_MIN_STEP_MS,
  DEAL_ROUND_CAP_MS,
  DEAL_ROUNDS,
  DEAL_SKIP_PENALTY_MS,
  replayDeal,
} from '../../../shared/games/deal';
import type { DealDay, DealRoundResult } from '../../../shared/types';
import { refreshUser } from '../auth/guards';
import type { Context } from '../context';
import { finish, progress, saveProgress, storedResult } from '../db/gameProgress';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { dealProfile, dealRound } from '../games/deal/generate';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

type Round = Omit<DealRoundResult, 'round' | 'solution' | 'teamBest'>;
interface State {
  rounds: Round[];
  active: { round: number; started_at: string } | null;
}
function load(ctx: Context, user: string, date: string): State {
  const result = storedResult(ctx, user, 'deal', date);
  return result
    ? { rounds: result.rounds, active: null }
    : progress(ctx, user, 'deal', date, { rounds: [], active: null });
}
function elapsed(ctx: Context, state: State) {
  return ctx.now.getTime() - Date.parse(state.active!.started_at);
}
function persist(ctx: Context, user: string, date: string, state: State) {
  saveProgress(ctx, user, 'deal', date, state);
  if (state.rounds.length === DEAL_ROUNDS && !storedResult(ctx, user, 'deal', date))
    finish(
      ctx,
      user,
      'deal',
      date,
      Math.floor(state.rounds.reduce((sum, r) => sum + r.timeMs, 0) / 100),
      { rounds: state.rounds },
    );
}
function complete(
  ctx: Context,
  user: string,
  date: string,
  state: State,
  timeMs: number,
  skipped: boolean,
) {
  const { cards, goal, parMs } = dealRound(date, state.rounds.length);
  state.rounds.push({ cards, goal, parMs, timeMs, skipped });
  state.active = null;
  persist(ctx, user, date, state);
}
function view(
  ctx: Context,
  user: ReturnType<typeof refreshUser>,
  date: string,
  state: State,
): DealDay {
  const access = oyoGameAccess(ctx.storage, user, date);
  const best: DealRoundResult['teamBest'][] = [];
  if (state.rounds.length) {
    const rows = ctx.storage.sql
      .exec<{ user_id: string; name: string; state_json: string }>(
        'SELECT p.user_id,u.name,p.state_json FROM game_progress p JOIN users u ON u.id=p.user_id WHERE p.game=? AND p.date=? AND u.active=1 ORDER BY u.name,u.id',
        'deal',
        date,
      )
      .toArray();
    for (const row of rows) {
      const other = JSON.parse(row.state_json) as State;
      for (let i = 0; i < state.rounds.length; i++) {
        const result = other.rounds[i];
        if (result && !result.skipped && (!best[i] || result.timeMs < best[i]!.timeMs))
          best[i] = { timeMs: result.timeMs, name: row.name, me: row.user_id === user.id };
      }
    }
  }
  const done = state.rounds.length === DEAL_ROUNDS;
  const active =
    state.active && access.unlocked
      ? (() => {
          const { cards, goal, parMs } = dealRound(date, state.active!.round);
          return {
            round: state.active!.round,
            cards,
            goal,
            parMs,
            elapsedMs: Math.max(0, elapsed(ctx, state)),
          };
        })()
      : null;
  return {
    date,
    access,
    round: state.rounds.length,
    counts: dealProfile(date),
    results: state.rounds.map((r, round) => ({
      ...r,
      round,
      solution: dealRound(date, round).solution,
      teamBest: best[round] ?? null,
    })),
    active,
    done,
    totalMs: done ? state.rounds.reduce((sum, r) => sum + r.timeMs, 0) : null,
  };
}
export function current(ctx: Context) {
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now),
        state = load(ctx, user.id, date);
      if (state.active && elapsed(ctx, state) >= DEAL_ROUND_CAP_MS)
        complete(ctx, user.id, date, state, DEAL_ROUND_CAP_MS, true);
      return view(ctx, user, date, state);
    }),
  );
}
function gameDate(ctx: Context, expected: unknown) {
  const date = today(ctx.now);
  if (expected !== undefined && v.date(expected) !== date)
    throw new HttpError(409, 'DAY_CHANGED', 'A New Day Has Started. Reload to Play.');
  return date;
}
function assertRound(value: unknown, state: State) {
  v.int(value, 'Round', 0, DEAL_ROUNDS - 1);
  if (value !== state.rounds.length)
    throw new HttpError(409, 'ROUND_ORDER', 'Play rounds in order, once each.');
}
async function write(ctx: Context, action: 'start' | 'answer' | 'skip') {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = gameDate(ctx, body.date);
      requireGameAccess(ctx, user, date);
      const allowed =
        action === 'answer' ? ['round', 'date', 'steps', 'elapsedMs'] : ['round', 'date'];
      if (Object.keys(body).some((key) => !allowed.includes(key))) v.invalid('Unexpected fields.');
      const state = load(ctx, user.id, date);
      if (state.rounds.length === DEAL_ROUNDS)
        throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      assertRound(body.round, state);
      if (action === 'start') {
        if (state.active) throw new HttpError(409, 'ROUND_STARTED', 'Round already started.');
        state.active = { round: body.round as number, started_at: ctx.now.toISOString() };
        persist(ctx, user.id, date, state);
      } else {
        if (!state.active) throw new HttpError(409, 'ROUND_NOT_STARTED', 'Start this round first.');
        const serverElapsed = elapsed(ctx, state);
        if (serverElapsed < 0) v.invalid('Timing is not plausible for this round.');
        if (action === 'skip')
          complete(
            ctx,
            user.id,
            date,
            state,
            Math.min(serverElapsed + DEAL_SKIP_PENALTY_MS, DEAL_ROUND_CAP_MS),
            true,
          );
        else {
          const clientElapsed = v.number(
            body.elapsedMs,
            'Elapsed time',
            0,
            Number.MAX_SAFE_INTEGER,
          );
          const puzzle = dealRound(date, state.rounds.length);
          if (
            !replayDeal(
              puzzle.cards.map((c) => c.value),
              body.steps,
              puzzle.goal,
            ).ok
          )
            v.invalid('Steps do not reach the goal.');
          if (serverElapsed < (puzzle.cards.length - 1) * DEAL_MIN_STEP_MS)
            v.invalid('Timing is not plausible for this round.');
          complete(
            ctx,
            user.id,
            date,
            state,
            Math.min(
              Math.max(clientElapsed, serverElapsed - 2500),
              serverElapsed,
              DEAL_ROUND_CAP_MS,
            ),
            false,
          );
        }
      }
      return view(ctx, user, date, state);
    }),
  );
}
export const start = (ctx: Context) => write(ctx, 'start');
export const answer = (ctx: Context) => write(ctx, 'answer');
export const skip = (ctx: Context) => write(ctx, 'skip');
