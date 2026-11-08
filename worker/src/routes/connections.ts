import { today } from '../../../shared/dates';
import {
  boardWords,
  replayConnections,
  type ConnectionsPuzzle,
} from '../../../shared/games/connections';
import type { ConnectionsCheck, ConnectionsDay } from '../../../shared/types';
import type { Context } from '../context';
import { refreshUser } from '../auth/guards';
import { oyoGameAccess, requireGameAccess } from '../games/access';
import { connectionsPuzzleFor } from '../games/connectionsPuzzles';
import { json, readJson } from '../http';
import * as v from '../validate';

const revealGroup = (puzzle: ConnectionsPuzzle, level: number) => {
  const { name, words } = puzzle.groups[level];
  return { name, words, level };
};

export function current(ctx: Context) {
  const user = refreshUser(ctx);
  const date = today(ctx.now);
  const access = oyoGameAccess(ctx.storage, user, date);
  const body: ConnectionsDay = {
    date,
    access,
    words: access.unlocked ? boardWords(date, connectionsPuzzleFor(date)) : [],
  };
  return json(body);
}

/** Replays the whole on-device guess log; groups are revealed only once solved or finished. */
export async function check(ctx: Context) {
  const user = refreshUser(ctx);
  const date = today(ctx.now);
  requireGameAccess(ctx, user, date);
  const body = await readJson(ctx.request);
  const puzzle = connectionsPuzzleFor(date);
  const replay = replayConnections(puzzle, body.guesses);
  if (!replay || !replay.outcomes.length) v.invalid('Guesses do not fit today’s board.');
  const result: ConnectionsCheck = {
    outcome: replay.outcomes.at(-1)!,
    mistakes: replay.mistakes,
    finished: replay.finished,
    won: replay.won,
    solved: replay.solved.map((level) => revealGroup(puzzle, level)),
    groups: replay.finished ? puzzle.groups.map((g) => revealGroup(puzzle, g.level)) : null,
  };
  return json(result);
}
