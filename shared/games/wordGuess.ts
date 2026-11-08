import { dayNumber, mulberry32 } from './daily';
import { ANSWERS } from './wordGuessAnswers';

export type Mark = 'correct' | 'present' | 'absent';
export const WORD = 5;
export const TRIES = 6;
export const WORD_GUESS_ID = 'wordguess';

/** Splits a packed string of five-letter words. */
export function unpack(packed: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + WORD <= packed.length; i += WORD) out.push(packed.slice(i, i + WORD));
  return out;
}

export const ANSWER_LIST = unpack(ANSWERS);

/** Two-pass scoring: exact matches first, then leftover answer letters mark present. */
export function score(guess: string, answer: string): Mark[] {
  const out: Mark[] = new Array(WORD).fill('absent');
  const left = new Map<string, number>();
  for (let i = 0; i < WORD; i++) {
    if (guess[i] === answer[i]) out[i] = 'correct';
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < WORD; i++) {
    if (out[i] === 'correct') continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      out[i] = 'present';
      left.set(guess[i], n - 1);
    }
  }
  return out;
}

const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best mark seen for each letter, for colouring the keyboard. */
export function letterStates(guesses: string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    const marks = score(g, answer);
    for (let i = 0; i < WORD; i++) {
      const prev = out[g[i]];
      if (!prev || rank[marks[i]] > rank[prev]) out[g[i]] = marks[i];
    }
  }
  return out;
}

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

export function dailyAnswer(date: string): string {
  return ANSWER_LIST[dailyIndex(dayNumber(date), ANSWER_LIST.length)];
}

let answerSet: Set<string> | null = null;

/** True when `word` can be guessed; `extra` holds the lazily loaded guess list. */
export function isAllowedWord(word: string, extra: ReadonlySet<string>): boolean {
  answerSet ??= new Set(ANSWER_LIST);
  return answerSet.has(word) || extra.has(word);
}

export interface WordGuessResult {
  solved: boolean;
  tries: number;
  /** 6 for a first-guess solve down to 1 for a sixth-guess solve; 0 when unsolved. */
  points: number;
  marks: Mark[][];
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

const SQUARE: Record<Mark, string> = {
  correct: '\u{1F7E9}',
  present: '\u{1F7E8}',
  absent: '\u2B1C',
};

export function wordGuessShare(date: string, result: WordGuessResult): string {
  const head = `OYO Word Guess ${date} ${result.solved ? result.tries : 'X'}/${TRIES}`;
  return [head, '', ...result.marks.map((row) => row.map((m) => SQUARE[m]).join(''))].join('\n');
}
