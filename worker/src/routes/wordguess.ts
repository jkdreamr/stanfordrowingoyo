import { today } from '../../../shared/dates';
import type { WordGuessDay } from '../../../shared/types';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import { dailyAnswer, isAllowedWord, score, TRIES, unpack } from '../games/wordGuess';
import { wordGuess } from '../games/more';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { refreshUser } from '../auth/guards';
import type { Context } from '../context';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

const allowed = new Set(unpack(GUESSES));
function state(ctx: Context, userId: string, date: string): WordGuessDay {
  const result = ctx.storage.sql
    .exec<{ payload_json: string }>(
      'SELECT payload_json FROM game_results WHERE user_id=? AND game_id=? AND date=?',
      userId,
      'wordguess',
      date,
    )
    .toArray()[0];
  const progress = ctx.storage.sql
    .exec<{ state_json: string }>(
      'SELECT state_json FROM game_progress WHERE user_id=? AND game=? AND date=?',
      userId,
      'wordguess',
      date,
    )
    .toArray()[0];
  const guesses: string[] = result
    ? JSON.parse(result.payload_json).guesses
    : progress
      ? JSON.parse(progress.state_json)
      : [];
  const answer = dailyAnswer(date);
  const won = guesses.at(-1) === answer;
  const done = Boolean(result) || won || guesses.length >= TRIES;
  const user = refreshUser(ctx);
  return {
    date,
    access: oyoGameAccess(ctx.storage, user, date),
    guesses: guesses.map((word) => ({ word, marks: score(word, answer) })),
    done,
    won,
    answer: done ? answer : null,
  };
}
export function current(ctx: Context) {
  const user = refreshUser(ctx);
  return json(state(ctx, user.id, today(ctx.now)));
}
export async function guess(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  const result = ctx.storage.transactionSync(() => {
    const user = refreshUser(ctx),
      date = today(ctx.now);
    requireGameAccess(ctx, user, date);
    const before = state(ctx, user.id, date);
    if (before.done) throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
    if (
      typeof body.guess !== 'string' ||
      !/^[a-z]{5}$/.test(body.guess) ||
      !isAllowedWord(body.guess, allowed)
    )
      v.invalid('Not in Word List');
    const guesses = [...before.guesses.map((row) => row.word), body.guess];
    const stamp = ctx.now.toISOString();
    ctx.storage.sql.exec(
      'INSERT INTO game_progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,game,date) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at',
      user.id,
      'wordguess',
      date,
      JSON.stringify(guesses),
      stamp,
    );
    if (body.guess === dailyAnswer(date) || guesses.length === TRIES) {
      const scored = wordGuess.score!({ guesses }, ctx, date);
      const payload = {
        ...(scored.payload as object),
        answer: dailyAnswer(date),
        marks: guesses.map((word) => score(word, dailyAnswer(date))),
      };
      ctx.storage.sql.exec(
        'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
        'wordguess',
        date,
        user.id,
        scored.score,
        JSON.stringify(payload),
        stamp,
        stamp,
      );
    }
    return state(ctx, user.id, date);
  });
  return json(result);
}
