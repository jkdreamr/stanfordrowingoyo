import { closeness, isIntIn } from './daily';
import type { PerceptionRoundId } from './perceptionV2';

export const PERCEPTION_ID = 'perception';
export const PERCEPTION_ROUNDS = ['clock', 'color', 'dot', 'pattern', 'reaction'] as const;
export type PerceptionRound = (typeof PERCEPTION_ROUNDS)[number];
export const PERCEPTION_MAX = PERCEPTION_ROUNDS.length * 100;
export const GRID = 5;
export const PATTERN_CELLS = 7;
export const COLOR_SHOW_MS = 1500;
export const DOT_SHOW_MS = 900;
export const PATTERN_SHOW_MS = 1600;
/** Taps faster than this after the signal are treated as anticipation. */
export const MIN_REACTION_MS = 100;
export const MAX_REACTION_MS = 3000;

export interface PerceptionPuzzle {
  clockMs: number;
  hue: number;
  /** Dot centre in thousandths of the board width and height. */
  dot: [number, number];
  cells: number[];
  reactionDelayMs: number;
}

export interface PerceptionAnswer {
  clockMs: number;
  hue: number;
  dot: [number, number];
  cells: number[];
  /** Milliseconds from the signal to the tap, or -1 for a false start. */
  reactionMs: number;
}

export type PerceptionScores = Record<PerceptionRound, number>;

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function scoreClock(puzzle: PerceptionPuzzle, heldMs: number): number {
  return closeness(heldMs - puzzle.clockMs, 600);
}

export function scoreColor(puzzle: PerceptionPuzzle, hue: number): number {
  return closeness(hueDistance(hue, puzzle.hue), 25);
}

export function scoreDot(puzzle: PerceptionPuzzle, dot: [number, number]): number {
  const miss = Math.hypot(dot[0] - puzzle.dot[0], dot[1] - puzzle.dot[1]) / 10;
  return closeness(miss, 8);
}

export function scorePattern(puzzle: PerceptionPuzzle, cells: number[]): number {
  const target = new Set(puzzle.cells);
  const hits = cells.filter((c) => target.has(c)).length;
  return closeness(PATTERN_CELLS - hits, 2);
}

export function scoreReaction(reactionMs: number): number {
  if (reactionMs < MIN_REACTION_MS) return 0;
  return closeness(Math.max(0, reactionMs - 150), 200);
}

export function perceptionTotal(
  scores: Partial<Record<PerceptionRoundId, number>>,
  rounds: readonly PerceptionRoundId[] = PERCEPTION_ROUNDS,
): number {
  return rounds.reduce((sum, r) => sum + (scores[r] ?? 0), 0);
}

/** Narrows untrusted input to a well-formed answer, or null. */
export function parsePerceptionAnswer(value: unknown): PerceptionAnswer | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!isIntIn(v.clockMs, 0, 30_000) || !isIntIn(v.hue, 0, 359)) return null;
  if (!Array.isArray(v.dot) || v.dot.length !== 2 || !v.dot.every((n) => isIntIn(n, 0, 1000)))
    return null;
  if (!Array.isArray(v.cells) || v.cells.length !== PATTERN_CELLS) return null;
  if (
    !v.cells.every((n) => isIntIn(n, 0, GRID * GRID - 1)) ||
    new Set(v.cells).size !== PATTERN_CELLS
  )
    return null;
  if (v.reactionMs !== -1 && !isIntIn(v.reactionMs, 0, MAX_REACTION_MS)) return null;
  return {
    clockMs: v.clockMs,
    hue: v.hue,
    dot: [v.dot[0], v.dot[1]],
    cells: [...v.cells],
    reactionMs: v.reactionMs as number,
  };
}

const LABEL: Record<PerceptionRoundId, string> = {
  clock: 'Clock',
  color: 'Color',
  dot: 'Spot',
  pattern: 'Pattern',
  reaction: 'React',
  angle: 'Angle',
  length: 'Length',
  count: 'Count',
  span: 'Span',
  shade: 'Shade',
  bisect: 'Bisect',
  contact: 'Contact',
};

export function perceptionShare(
  date: string,
  scores: Partial<Record<PerceptionRoundId, number>>,
  rounds: readonly PerceptionRoundId[] = PERCEPTION_ROUNDS,
): string {
  const lines = rounds.map((r) => {
    const score = scores[r] ?? 0;
    const filled = Math.max(0, Math.min(5, Math.round((score / 100) * 5)));
    return `${LABEL[r]} ${'🟩'.repeat(filled)}${'⬜'.repeat(5 - filled)} ${score}`;
  });
  return [
    `OYO Perception ${date} ${perceptionTotal(scores, rounds)}/${PERCEPTION_MAX}`,
    ...lines,
  ].join('\n');
}
