import { today } from '../../../shared/dates';
import type { WorldleDay } from '../../../shared/types';
import { resolveCountry, TRIES, WORLDLE_ID } from '../../../shared/games/worldle';
import { dailyCountry, guessRow } from '../games/worldle/game';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { refreshUser } from '../auth/guards';
import { finish, progress, saveProgress, storedResult } from '../db/gameProgress';
import type { UserRow } from '../db/users';
import type { Context } from '../context';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function state(ctx: Context, user: UserRow, date: string): WorldleDay {
  const country = dailyCountry(date);
  const result = storedResult(ctx, user.id, WORLDLE_ID, date);
  const indices = result
    ? (result.guesses as string[]).map((name) => resolveCountry(name)!)
    : progress<number[]>(ctx, user.id, WORLDLE_ID, date, []);
  const guesses = indices.map((index) => guessRow(index, country.index));
  const won = guesses.at(-1)?.correct ?? false;
  const done = won || guesses.length >= TRIES || Boolean(result);
  const access = oyoGameAccess(ctx.storage, user, date);
  return {
    date,
    access,
    shape: access.unlocked ? country.shape : null,
    guesses,
    done,
    won,
    answer: done ? { name: country.name, lat: country.lat, lon: country.lon } : null,
  };
}

function gameDate(ctx: Context, expected: unknown) {
  const date = today(ctx.now);
  if (expected !== undefined && v.date(expected) !== date)
    throw new HttpError(409, 'DAY_CHANGED', 'A New Day Has Started. Reload to Play.');
  return date;
}

export function current(ctx: Context) {
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx);
      return state(ctx, user, today(ctx.now));
    }),
  );
}

export async function guess(ctx: Context) {
  refreshUser(ctx);
  const body = await readJson(ctx.request);
  return json(
    ctx.storage.transactionSync(() => {
      const user = refreshUser(ctx);
      const date = gameDate(ctx, body.date);
      requireGameAccess(ctx, user, date);
      const before = state(ctx, user, date);
      if (before.done) throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      const index = typeof body.guess === 'string' ? resolveCountry(body.guess) : null;
      if (index === null) v.invalid('Unknown country');
      const indices = progress<number[]>(ctx, user.id, WORLDLE_ID, date, []);
      if (indices.includes(index)) v.invalid('Already guessed');
      indices.push(index);
      saveProgress(ctx, user.id, WORLDLE_ID, date, indices);
      const after = state(ctx, user, date);
      if (after.done) {
        finish(ctx, user.id, WORLDLE_ID, date, after.won ? 7 - indices.length : 0, {
          guesses: after.guesses.map((row) => row.name),
          solved: after.won,
          tries: indices.length,
          answer: after.answer!.name,
          rows: after.guesses.map(({ km, direction, proximity }) => ({ km, direction, proximity })),
        });
      }
      return after;
    }),
  );
}
