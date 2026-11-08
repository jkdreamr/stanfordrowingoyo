import { unpack, verifyWordGuess, WORD_GUESS_ID } from '../../../shared/games/wordGuess';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import {
  PERCEPTION_ID,
  parsePerceptionAnswer,
  perceptionTotal,
  scorePerception,
} from '../../../shared/games/perception';
import { RATE_HOLD_ID, parseRateHoldTaps, scoreRateHold } from '../../../shared/games/rateHold';
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

export const rateHold: ServerGame = {
  id: RATE_HOLD_ID,
  direction: 'higher',
  score(payload, _ctx, date) {
    const taps = parseRateHoldTaps(field(payload, 'taps'));
    if (!taps) v.invalid('Stroke taps are out of range.');
    const { total, ...result } = scoreRateHold(date, taps);
    return { score: total, payload: { taps, ...result } };
  },
};
