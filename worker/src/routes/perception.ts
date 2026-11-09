import { today } from '../../../shared/dates';
import {
  perceptionTotal,
  type PerceptionAnswer,
  type PerceptionScores,
} from '../../../shared/games/perception';
import {
  PERCEPTION_V2_FROM,
  PERCEPTION_FIELDS,
  parsePerceptionRound,
  scorePerceptionRound,
  perceptionExposure,
  perceptionContinuationPlausible,
  isPerceptionV3Puzzle,
  type PerceptionRoundId,
  type PerceptionRoundAnswer,
} from '../../../shared/games/perceptionV2';
import { perceptionLineup, perceptionPuzzleForDate } from '../games/perceptionV2';
import type { PerceptionDay, PerceptionStimulus } from '../../../shared/types';
import { perceptionPuzzle, scorePerception } from '../games/perception';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { progress, saveProgress, storedResult, finish } from '../db/gameProgress';
import type { Context } from '../context';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

interface State {
  scores: Partial<Record<PerceptionRoundId, number>>;
  answer: PerceptionRoundAnswer;
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
    rounds: perceptionLineup(date),
    scores: state.scores,
    done: round === 5 || Boolean(storedResult(ctx, user.id, 'perception', date)),
  };
}
function persist(ctx: Context, user: string, date: string, state: State) {
  saveProgress(ctx, user, 'perception', date, state);
  if (Object.keys(state.scores).length === 5 && !storedResult(ctx, user, 'perception', date))
    finish(ctx, user, 'perception', date, perceptionTotal(state.scores, perceptionLineup(date)), {
      answer: state.answer,
      scores: state.scores,
      rounds: perceptionLineup(date),
    });
}
export function current(ctx: Context) {
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now),
        state = load(ctx, user.id, date);
      if (state.active) {
        state.scores[perceptionLineup(date)[state.active.round]] = 0;
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
      const extra = date >= PERCEPTION_V2_FROM ? perceptionPuzzleForDate(date) : null;
      const puzzle = extra ?? perceptionPuzzle(date);
      const round = perceptionLineup(date)[body.round as number];
      const stimuli: Partial<Record<PerceptionRoundId, PerceptionStimulus>> = {
        clock: { clockMs: puzzle.clockMs },
        color: { hue: puzzle.hue },
        dot: { dot: puzzle.dot },
        pattern: { cells: puzzle.cells },
        reaction: { reactionDelayMs: puzzle.reactionDelayMs },
        ...(extra
          ? {
              angle: { angle: extra.angle, rotation: extra.rotation },
              length: { length: extra.length },
              count: { countDots: extra.countDots },
              span: { digits: extra.digits },
              shade: { shade: extra.shade, shadeBackgrounds: extra.shadeBackgrounds },
              bisect: { endpoints: extra.endpoints },
              contact: { contact: extra.contact },
            }
          : {}),
        ...(extra && isPerceptionV3Puzzle(extra)
          ? {
              ratio: { ratioDiameters: extra.ratioDiameters },
              beat: { beatIntervalMs: extra.beatIntervalMs },
              path: { path: extra.path },
              order: { order: extra.order },
              duration: { durationMs: extra.durationMs },
              centroid: { centroidDots: extra.centroidDots },
            }
          : {}),
      };
      state.active = { round: body.round as number, started_at: ctx.now.toISOString() };
      persist(ctx, user.id, date, state);
      return { ...view(ctx, state), stimulus: stimuli[round] };
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
      const round = perceptionLineup(date)[body.round as number];
      const field = PERCEPTION_FIELDS[round];
      const v2 = date >= PERCEPTION_V2_FROM;
      const parsed = parsePerceptionRound(round, body.answer, v2);
      if (!parsed) v.invalid('Invalid round answer.');
      const elapsed = ctx.now.getTime() - Date.parse(state.active.started_at);
      const extra = v2 ? perceptionPuzzleForDate(date) : null;
      const puzzle = extra ?? perceptionPuzzle(date);
      if (
        elapsed < 0 ||
        (round === 'clock' && parsed.clockMs! > elapsed + 1000) ||
        (round === 'reaction' &&
          parsed.reactionMs! >= 0 &&
          (elapsed < puzzle.reactionDelayMs ||
            parsed.reactionMs! > elapsed - puzzle.reactionDelayMs + 1000))
      )
        v.invalid('Timing is not plausible for this round.');
      if (extra) {
        if (
          elapsed < perceptionExposure(round, extra) ||
          !perceptionContinuationPlausible(round, extra, parsed, elapsed) ||
          (round === 'contact' &&
            (elapsed < extra.contact.visibleMs ||
              parsed.contactMs! > elapsed - extra.contact.visibleMs + 1000))
        )
          v.invalid('Timing is not plausible for this round.');
        state.scores[round] = scorePerceptionRound(round, extra, parsed);
      } else {
        const legacy: PerceptionAnswer = {
          clockMs: 0,
          hue: 0,
          dot: [0, 0],
          cells: [0, 1, 2, 3, 4, 5, 6],
          reactionMs: -1,
          ...parsed,
        };
        state.scores[round] = scorePerception(date, legacy)[round as keyof PerceptionScores];
      }
      Object.assign(state.answer, { [field]: parsed[field] });
      state.active = null;
      persist(ctx, user.id, date, state);
      return view(ctx, state);
    }),
  );
}
