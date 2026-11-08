import { today } from '../../../shared/dates';
import {
  PERCEPTION_ROUNDS,
  parsePerceptionAnswer,
  perceptionTotal,
  type PerceptionAnswer,
  type PerceptionScores,
} from '../../../shared/games/perception';
import type { PerceptionDay, PerceptionStimulus } from '../../../shared/types';
import { perceptionPuzzle, scorePerception } from '../games/perception';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { progress, saveProgress, storedResult, finish } from '../db/gameProgress';
import type { Context } from '../context';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

interface State {
  scores: Partial<PerceptionScores>;
  answer: Partial<PerceptionAnswer>;
  active: { round: number; started_at: string } | null;
}
const initial = (): State => ({ scores: {}, answer: {}, active: null });
function load(ctx: Context, user: string, date: string): State {
  const result = storedResult(ctx, user, 'perception', date);
  return result
    ? { scores: result.scores, answer: result.answer, active: null }
    : progress(ctx, user, 'perception', date, initial());
}
function view(ctx: Context, state: State): PerceptionDay {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  const round = Object.keys(state.scores).length;
  return {
    date,
    access: oyoGameAccess(ctx.storage, user, date),
    round,
    scores: state.scores,
    done: round === 5 || Boolean(storedResult(ctx, user.id, 'perception', date)),
  };
}
function persist(ctx: Context, user: string, date: string, state: State) {
  saveProgress(ctx, user, 'perception', date, state);
  if (Object.keys(state.scores).length === 5 && !storedResult(ctx, user, 'perception', date))
    finish(ctx, user, 'perception', date, perceptionTotal(state.scores as PerceptionScores), {
      answer: state.answer,
      scores: state.scores,
    });
}
export function current(ctx: Context) {
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now),
        state = load(ctx, user.id, date);
      if (state.active) {
        state.scores[PERCEPTION_ROUNDS[state.active.round]] = 0;
        state.active = null;
        persist(ctx, user.id, date, state);
      }
      return view(ctx, state);
    }),
    200,
  );
}
function assertRound(round: unknown, state: State) {
  if (!Number.isInteger(round) || (round as number) < 0 || (round as number) > 4)
    v.invalid('Invalid round.');
  if (round !== Object.keys(state.scores).length)
    throw new HttpError(409, 'ROUND_ORDER', 'Play rounds in order, once each.');
}
export async function start(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now);
      requireGameAccess(ctx, user, date);
      const state = load(ctx, user.id, date);
      if (storedResult(ctx, user.id, 'perception', date))
        throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      assertRound(body.round, state);
      if (state.active) throw new HttpError(409, 'ROUND_STARTED', 'Round already started.');
      const puzzle = perceptionPuzzle(date);
      const stimuli: PerceptionStimulus[] = [
        { clockMs: puzzle.clockMs },
        { hue: puzzle.hue },
        { dot: puzzle.dot },
        { cells: puzzle.cells },
        { reactionDelayMs: puzzle.reactionDelayMs },
      ];
      state.active = { round: body.round as number, started_at: ctx.now.toISOString() };
      persist(ctx, user.id, date, state);
      return { ...view(ctx, state), stimulus: stimuli[body.round as number] };
    }),
  );
}
export async function answer(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now);
      requireGameAccess(ctx, user, date);
      const state = load(ctx, user.id, date);
      if (storedResult(ctx, user.id, 'perception', date))
        throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      assertRound(body.round, state);
      if (!state.active) throw new HttpError(409, 'ROUND_NOT_STARTED', 'Start this round first.');
      const field = ['clockMs', 'hue', 'dot', 'cells', 'reactionMs'][body.round as number];
      const part =
        body.answer && typeof body.answer === 'object'
          ? (body.answer as Record<string, unknown>)
          : {};
      const parsed = parsePerceptionAnswer({
        clockMs: 0,
        hue: 0,
        dot: [0, 0],
        cells: [0, 1, 2, 3, 4, 5, 6],
        reactionMs: -1,
        [field]: part[field],
      });
      if (!parsed) v.invalid('Invalid round answer.');
      const elapsed = ctx.now.getTime() - Date.parse(state.active.started_at);
      const puzzle = perceptionPuzzle(date);
      if (
        elapsed < 0 ||
        (body.round === 0 && parsed.clockMs > elapsed + 1000) ||
        (body.round === 4 &&
          parsed.reactionMs >= 0 &&
          (elapsed < puzzle.reactionDelayMs ||
            parsed.reactionMs > elapsed - puzzle.reactionDelayMs + 1000))
      )
        v.invalid('Timing is not plausible for this round.');
      const round = PERCEPTION_ROUNDS[body.round as number];
      state.scores[round] = scorePerception(date, parsed)[round];
      Object.assign(state.answer, { [field]: parsed[field as keyof PerceptionAnswer] });
      state.active = null;
      persist(ctx, user.id, date, state);
      return view(ctx, state);
    }),
  );
}
