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

export interface WordGuessResult {
  solved: boolean;
  tries: number;
  /** 6 for a first-guess solve down to 1 for a sixth-guess solve; 0 when unsolved. */
  points: number;
  marks: Mark[][];
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
