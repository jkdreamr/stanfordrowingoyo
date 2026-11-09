import { today } from '../../../shared/dates';
import { pinpointScore } from '../../../shared/games/pinpoint';
import type { PinpointDay } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { pinpointPuzzleFor } from '../games/pinpoint/puzzles';
import { matchesPinpoint, normalizePinpoint } from '../games/pinpoint/match';
import { progress, saveProgress, storedResult, finish } from '../db/gameProgress';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function state(ctx: Context): PinpointDay {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const saved = storedResult(ctx, user.id, 'pinpoint', date);
  const raw: string[] =
    saved?.guesses.map((g: { text: string }) => g.text) ??
    progress(ctx, user.id, 'pinpoint', date, []);
  const puzzle = pinpointPuzzleFor(date);
  const guesses = raw.map((text) => ({ text, correct: matchesPinpoint(text, puzzle) }));
  const won = guesses.at(-1)?.correct ?? false;
  const finished = Boolean(saved) || won || guesses.length >= 5;
  const cluesUsed = Math.min(5, guesses.length + (finished ? 0 : 1));
  return {
    date,
    access,
    clues: access.unlocked ? puzzle.clues.slice(0, cluesUsed) : [],
    guesses,
    cluesUsed,
    finished,
    won,
    category: finished ? puzzle.category : null,
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
      requireGameAccess(ctx, user, date);
      if (body.date !== undefined && body.date !== date)
        throw new HttpError(409, 'DAY_CHANGED', 'The day changed. Reload to play today.');
      const before = state(ctx);
      if (before.finished) throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      if (typeof body.guess !== 'string' || body.guess.length > 60)
        v.invalid('Guess must be a string of at most 60 characters.');
      const normalized = normalizePinpoint(body.guess);
      if (
        body.guess !== '' &&
        (!normalized ||
          before.guesses.some((g) => g.text !== '' && normalizePinpoint(g.text) === normalized))
      )
        v.invalid('Empty or repeated guess.');
      saveProgress(ctx, user.id, 'pinpoint', date, [
        ...before.guesses.map((g) => g.text),
        body.guess,
      ]);
      const after = state(ctx);
      if (after.finished)
        finish(ctx, user.id, 'pinpoint', date, pinpointScore(after.won, after.cluesUsed), {
          guesses: after.guesses,
          won: after.won,
          cluesUsed: after.cluesUsed,
          category: after.category,
          clues: pinpointPuzzleFor(date).clues,
        });
      return after;
    }),
  );
}
