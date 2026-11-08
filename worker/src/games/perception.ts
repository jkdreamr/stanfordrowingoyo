import { dailyRandom } from '../../../shared/games/daily';
import {
  PERCEPTION_ID,
  GRID,
  PATTERN_CELLS,
  scoreClock,
  scoreColor,
  scoreDot,
  scorePattern,
  scoreReaction,
  type PerceptionPuzzle,
  type PerceptionAnswer,
  type PerceptionScores,
} from '../../../shared/games/perception';
export function perceptionPuzzle(date: string): PerceptionPuzzle {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid Perception puzzle date');
  const rand = dailyRandom(PERCEPTION_ID, date);
  const pick = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const clockMs = pick(25, 60) * 100;
  const hue = pick(0, 359);
  const dot: [number, number] = [pick(120, 880), pick(120, 880)];
  const pool = Array.from({ length: GRID * GRID }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cells = pool.slice(0, PATTERN_CELLS).sort((a, b) => a - b);
  const reactionDelayMs = pick(15, 45) * 100;
  return { clockMs, hue, dot, cells, reactionDelayMs };
}

export function scorePerception(date: string, answer: PerceptionAnswer): PerceptionScores {
  const puzzle = perceptionPuzzle(date);
  return {
    clock: scoreClock(puzzle, answer.clockMs),
    color: scoreColor(puzzle, answer.hue),
    dot: scoreDot(puzzle, answer.dot),
    pattern: scorePattern(puzzle, answer.cells),
    reaction: scoreReaction(answer.reactionMs),
  };
}
