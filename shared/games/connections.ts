import { dailyRandom, dayNumber, hashSeed, mulberry32 } from './daily';

export const CONNECTIONS_ID = 'connections';
export const GROUPS = 4;
export const GROUP_SIZE = 4;
export const MAX_MISTAKES = 4;
/** A finished board can hold at most four solves and four mistakes. */
export const MAX_GUESSES = GROUPS + MAX_MISTAKES;
/** Score of a perfect board; see {@link connectionsScore}. */
export const CONNECTIONS_MAX = 8;
export const LEVEL_NAMES = ['Easiest', 'Easy', 'Hard', 'Hardest'] as const;

export interface ConnectionsGroup {
  name: string;
  words: string[];
  /** 0 is easiest, 3 hardest. */
  level: number;
}
export interface ConnectionsPuzzle {
  groups: ConnectionsGroup[];
  /** Board words that also look like they belong to another group (`group`). */
  herrings: { word: string; group: number }[];
}
export type GuessOutcome = 'correct' | 'one_away' | 'wrong';
export interface ConnectionsReplay {
  outcomes: GuessOutcome[];
  /** Solved group levels in solve order. */
  solved: number[];
  mistakes: number;
  finished: boolean;
  won: boolean;
  /** Each guess as the true group level of its four words, for sharing. */
  grid: number[][];
}

/** Parses `'Name: A, B, C, D'` groups plus trailing `'Word>n'` red herrings. */
export function parsePuzzle(raw: readonly string[]): ConnectionsPuzzle {
  const groups = raw.slice(0, GROUPS).map((text, level) => {
    const split = text.indexOf(': ');
    return {
      name: text.slice(0, split),
      words: text
        .slice(split + 2)
        .split(',')
        .map((w) => w.trim()),
      level,
    };
  });
  const herrings = raw.slice(GROUPS).map((text) => {
    const [word, group] = text.split('>');
    return { word, group: Number(group) };
  });
  return { groups, herrings };
}

/** Cycles a fixed shuffle of every puzzle, so a puzzle returns only after `count` days. */
export function puzzleIndex(date: string, count: number): number {
  const order = Array.from({ length: count }, (_, i) => i);
  const rand = mulberry32(hashSeed(`${CONNECTIONS_ID}:order:${count}`));
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const day = dayNumber(date);
  return order[((day % count) + count) % count];
}

/** The day's shared starting tile order. */
export function boardWords(date: string, puzzle: ConnectionsPuzzle): string[] {
  const words = puzzle.groups.flatMap((g) => g.words);
  const rand = dailyRandom(CONNECTIONS_ID, date);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

const guessKey = (guess: readonly string[]) => [...guess].sort().join('\n');

/**
 * Replays a guess log against the puzzle. Returns null for anything a real board
 * cannot produce: unknown or repeated words, solved words, repeated guesses, or
 * guesses after the board finished.
 */
export function replayConnections(
  puzzle: ConnectionsPuzzle,
  guesses: unknown,
): ConnectionsReplay | null {
  if (!Array.isArray(guesses) || guesses.length > MAX_GUESSES) return null;
  const levelOf = new Map<string, number>();
  for (const g of puzzle.groups) for (const w of g.words) levelOf.set(w, g.level);
  const seen = new Set<string>();
  const result: ConnectionsReplay = {
    outcomes: [],
    solved: [],
    mistakes: 0,
    finished: false,
    won: false,
    grid: [],
  };
  for (const guess of guesses) {
    if (result.finished || !Array.isArray(guess) || guess.length !== GROUP_SIZE) return null;
    if (!guess.every((w): w is string => typeof w === 'string' && levelOf.has(w))) return null;
    if (new Set(guess).size !== GROUP_SIZE) return null;
    const levels = guess.map((w) => levelOf.get(w)!);
    if (levels.some((l) => result.solved.includes(l))) return null;
    const key = guessKey(guess);
    if (seen.has(key)) return null;
    seen.add(key);
    result.grid.push(levels);
    const counts = [0, 0, 0, 0];
    for (const l of levels) counts[l]++;
    const best = Math.max(...counts);
    if (best === GROUP_SIZE) {
      result.outcomes.push('correct');
      result.solved.push(levels[0]);
    } else {
      result.outcomes.push(best === GROUP_SIZE - 1 ? 'one_away' : 'wrong');
      result.mistakes++;
    }
    result.won = result.solved.length === GROUPS;
    result.finished = result.won || result.mistakes === MAX_MISTAKES;
  }
  return result;
}

/**
 * Higher is better: a solved board scores 8 minus mistakes (8–5); an unsolved
 * board scores its solved groups (0–3), so every win outranks every loss.
 */
export function connectionsScore(replay: Pick<ConnectionsReplay, 'won' | 'solved' | 'mistakes'>) {
  return replay.won ? CONNECTIONS_MAX - replay.mistakes : replay.solved.length;
}

export function connectionsSummary(score: number) {
  const won = score > MAX_MISTAKES;
  return {
    groups: won ? GROUPS : score,
    mistakes: won ? CONNECTIONS_MAX - score : MAX_MISTAKES,
  };
}

export function formatConnectionsScore(score: number) {
  const { groups, mistakes } = connectionsSummary(score);
  return `${groups} / ${GROUPS} · ${mistakes} ${mistakes === 1 ? 'Mistake' : 'Mistakes'}`;
}

const SQUARE = ['\u{1F7E8}', '\u{1F7E9}', '\u{1F7E6}', '\u{1F7EA}'];

export function connectionsShare(date: string, score: number, grid: readonly number[][]) {
  const { groups } = connectionsSummary(score);
  return [
    `OYO Connections ${date} ${groups}/${GROUPS}`,
    '',
    ...grid.map((row) => row.map((l) => SQUARE[l] ?? '\u2B1C').join('')),
  ].join('\n');
}
