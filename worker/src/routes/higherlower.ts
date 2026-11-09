import { today } from '../../../shared/dates';
import {
  formatHigherLowerValue,
  HIGHERLOWER_ID,
  ROUNDS,
  type HigherLowerChoice,
} from '../../../shared/games/higherlower';
import type { HigherLowerDay, HigherLowerItem } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { higherLowerPuzzle, replayHigherLower, type HigherLowerFact } from '../games/higherlower';
import { progress, saveProgress, storedResult, finish } from '../db/gameProgress';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function state(ctx: Context): HigherLowerDay {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const empty: HigherLowerDay = {
    asOfLabel: null,
    date,
    access,
    question: null,
    higherLabel: null,
    lowerLabel: null,
    unit: null,
    asOf: null,
    step: 0,
    rounds: ROUNDS,
    items: [],
    next: null,
    results: [],
    finished: false,
    score: 0,
    perfect: false,
  };
  if (!access.unlocked) return empty;
  const saved = storedResult(ctx, user.id, HIGHERLOWER_ID, date);
  const choices: HigherLowerChoice[] =
    saved?.choices ?? progress(ctx, user.id, HIGHERLOWER_ID, date, []);
  const { category, chain } = higherLowerPuzzle(date);
  const replay = replayHigherLower(chain, choices);
  const item = (fact: HigherLowerFact, revealed: boolean): HigherLowerItem => ({
    ...(fact.asOf !== undefined && fact.asOf !== category.asOf ? { asOf: fact.asOf } : {}),
    name: fact.name,
    detail: fact.detail,
    value: revealed ? fact.value : null,
    display: revealed ? formatHigherLowerValue(fact.value, category.unit) : null,
  });
  return {
    ...empty,
    ...replay,
    asOfLabel: category.asOfLabel,
    question: category.question,
    higherLabel: category.higherLabel,
    lowerLabel: category.lowerLabel,
    unit: category.unit,
    asOf: category.asOf,
    items: chain.slice(0, replay.results.length + 1).map((f) => item(f, true)),
    next: replay.finished ? null : item(chain[replay.step + 1], false),
  };
}
export function current(ctx: Context) {
  return json(state(ctx));
}
export async function guess(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx),
        date = today(ctx.now);
      if (
        Object.keys(body).some((k) => !['step', 'choice', 'date'].includes(k)) ||
        !Number.isInteger(body.step) ||
        (body.step as number) < 0 ||
        (body.step as number) >= ROUNDS ||
        !['higher', 'lower'].includes(body.choice as string)
      )
        v.invalid('Invalid step or choice.');
      if (body.date !== undefined && v.date(body.date) !== date)
        throw new HttpError(409, 'DAY_CHANGED', 'A New Day Has Started. Reload to Play.');
      requireGameAccess(ctx, user, date);
      const before = state(ctx);
      if (before.finished || storedResult(ctx, user.id, HIGHERLOWER_ID, date))
        throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      if (body.step !== before.step)
        throw new HttpError(409, 'OUT_OF_ORDER', 'Play steps in order, once each.');
      const choices = [
        ...progress<HigherLowerChoice[]>(ctx, user.id, HIGHERLOWER_ID, date, []),
        body.choice as HigherLowerChoice,
      ];
      saveProgress(ctx, user.id, HIGHERLOWER_ID, date, choices);
      const after = state(ctx);
      if (after.finished) {
        const { category } = higherLowerPuzzle(date);
        finish(ctx, user.id, HIGHERLOWER_ID, date, after.score, {
          choices,
          results: after.results,
          score: after.score,
          rounds: ROUNDS,
          category: category.id,
          question: category.question,
          items: after.items,
          perfect: after.perfect,
        });
      }
      return after;
    }),
  );
}
