import { mulberry32 } from '../../../shared/games/daily';
import {
  TRIES,
  unpack,
  score,
  type Mark,
  type WordGuessResult,
} from '../../../shared/games/wordGuess';
import { ANSWERS } from './wordGuessAnswers';
import { NEW_ANSWERS } from './wordGuessExpansion';
import { contentRotation } from './contentSchedule';
export * from '../../../shared/games/wordGuess';

export const ANSWER_LIST = unpack(ANSWERS);
export const NEW_ANSWER_LIST = unpack(NEW_ANSWERS);
export const ALL_ANSWERS = [...ANSWER_LIST, ...NEW_ANSWER_LIST];

const orders = new Map<number, number[]>();

/** Index into a list of `count` answers for a day; cycles through a fixed shuffle so no word repeats early. */
export function dailyIndex(day: number, count: number): number {
  let order = orders.get(count);
  if (!order) {
    const rand = mulberry32(0x6a6f7368);
    order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    orders.set(count, order);
  }
  return order[((day % count) + count) % count];
}

const answerIndex = contentRotation(
  'wordguess',
  ANSWER_LIST.length,
  ALL_ANSWERS.length,
  (day) => dailyIndex(day, ANSWER_LIST.length),
  (index) => ALL_ANSWERS[index],
);

export function dailyAnswer(date: string): string {
  return ALL_ANSWERS[answerIndex(date)];
}

let answerSet: Set<string> | null = null;

/** True when `word` can be guessed; `extra` holds the lazily loaded guess list. */
export function isAllowedWord(word: string, extra: ReadonlySet<string>): boolean {
  answerSet ??= new Set(ALL_ANSWERS);
  return answerSet.has(word) || extra.has(word);
}

/** Re-scores a finished board against the date's answer, or returns null if it is not a legal finished game. */
export function verifyWordGuess(
  date: string,
  guesses: unknown,
  extra: ReadonlySet<string>,
): WordGuessResult | null {
  if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > TRIES) return null;
  const answer = dailyAnswer(date);
  const marks: Mark[][] = [];
  for (let i = 0; i < guesses.length; i++) {
    const g = guesses[i];
    if (typeof g !== 'string' || !/^[a-z]{5}$/.test(g) || !isAllowedWord(g, extra)) return null;
    if (i < guesses.length - 1 && g === answer) return null;
    marks.push(score(g, answer));
  }
  const solved = guesses[guesses.length - 1] === answer;
  if (!solved && guesses.length !== TRIES) return null;
  return { solved, tries: guesses.length, points: solved ? TRIES + 1 - guesses.length : 0, marks };
}
