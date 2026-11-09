import { today } from '../../../shared/dates';
import { boardWords, replayConnections } from '../../../shared/games/connections';
import type { ConnectionsDay } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { connectionsPuzzleFor } from '../games/connectionsPuzzles';
import { connections } from '../games/more';
import { progress, saveProgress, storedResult, finish } from '../db/gameProgress';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';

function state(ctx: Context): ConnectionsDay {
  const user = refreshUser(ctx),
    date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const saved = storedResult(ctx, user.id, 'connections', date);
  const guesses: string[][] = saved?.guesses ?? progress(ctx, user.id, 'connections', date, []);
  const puzzle = connectionsPuzzleFor(date);
  const replay = replayConnections(puzzle, guesses)!;
  return {
    date,
    access,
    words: access.unlocked ? boardWords(date, puzzle) : [],
    guesses,
    outcomes: replay.outcomes,
    outcome: replay.outcomes.at(-1) ?? null,
    mistakes: replay.mistakes,
    solved: replay.solved.map((level) => puzzle.groups[level]),
    finished: Boolean(saved) || replay.finished,
    won: replay.won,
    groups: saved || replay.finished ? puzzle.groups : null,
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
      const before = state(ctx);
      if (before.finished) throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
      const guesses = [...before.guesses, body.guess];
      const replay = replayConnections(connectionsPuzzleFor(date), guesses);
      if (!replay) v.invalid('Repeated guess or words do not fit today’s board.');
      saveProgress(ctx, user.id, 'connections', date, guesses);
      if (replay.finished) {
        const scored = connections.score!({ guesses }, ctx, date);
        finish(ctx, user.id, 'connections', date, scored.score, scored.payload);
      }
      return state(ctx);
    }),
  );
}
export function check(): never {
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use the single-guess endpoint.');
}
