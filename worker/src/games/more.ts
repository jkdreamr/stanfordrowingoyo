import { unpack, verifyWordGuess, WORD_GUESS_ID } from './wordGuess';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import {
  PERCEPTION_ID,
  parsePerceptionAnswer,
  perceptionTotal,
  scorePerception,
} from '../../../shared/games/perception';
import {
  CONNECTIONS_ID,
  connectionsScore,
  replayConnections,
} from '../../../shared/games/connections';
import { connectionsPuzzleFor } from './connectionsPuzzles';
import * as v from '../validate';
import type { ServerGame } from './registry';

let guessSet: Set<string> | null = null;
const field = (payload: unknown, key: string) =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined;

export const wordGuess: ServerGame = {
  id: WORD_GUESS_ID,
  direction: 'higher',
  score(payload, _ctx, date) {
    guessSet ??= new Set(unpack(GUESSES));
    const result = verifyWordGuess(date, field(payload, 'guesses'), guessSet);
    if (!result) v.invalid('Guesses do not make a finished board for today.');
    const { solved, tries } = result;
    return {
      score: result.points,
      payload: { guesses: field(payload, 'guesses'), solved, tries },
    };
  },
};

export const perception: ServerGame = {
  id: PERCEPTION_ID,
  direction: 'higher',
  score(payload, _ctx, date) {
    const answer = parsePerceptionAnswer(field(payload, 'answer'));
    if (!answer) v.invalid('Perception answers are out of range.');
    const scores = scorePerception(date, answer);
    return { score: perceptionTotal(scores), payload: { answer, scores } };
  },
};

export const connections: ServerGame = {
  id: CONNECTIONS_ID,
  direction: 'higher',
  score(payload, _ctx, date) {
    const puzzle = connectionsPuzzleFor(date);
    const guesses = field(payload, 'guesses');
    const replay = replayConnections(puzzle, guesses);
    if (!replay?.finished) v.invalid('Guesses do not make a finished board for today.');
    const { solved, mistakes, won, grid } = replay;
    return {
      score: connectionsScore(replay),
      payload: { guesses, solved, mistakes, won, grid, groups: puzzle.groups },
    };
  },
};
