import type { GameScoreDirection } from '../../../shared/types';
import type { Context } from '../context';
import { connections, perception, wordGuess } from './more';

export interface ServerGame {
  id: string;
  direction: GameScoreDirection;
  score?: (payload: unknown, ctx: Context, date: string) => { score: number; payload: unknown };
}
export const GAMES: Record<string, ServerGame> = {
  dive: { id: 'dive', direction: 'higher' },
  wordguess: wordGuess,
  perception,
  connections,
};
